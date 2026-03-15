/**
 * RAG Search - Hybrid (Vectorize + FTS5) with result caching
 */

import { json } from './worker.js';

const SCORE_THRESHOLD = 0.35;
const VECTOR_WEIGHT = 0.7;
const CACHE_TTL = 3600; // 1 hour
const RAG_CACHE_TTL = 1800; // 30 minutes for full RAG results

/**
 * Parse JSON metadata string safely
 */
function parseMetadata(metaStr) {
  if (!metaStr) return null;
  try { return JSON.parse(metaStr); } catch { return null; }
}

/**
 * Generate or retrieve cached embedding for a query
 */
async function getEmbedding(query, env) {
  // Check KV cache first
  const cacheKey = `emb:${query.slice(0, 128)}`;
  if (env.KV) {
    try {
      const cached = await env.KV.get(cacheKey, 'json');
      if (cached) return cached;
    } catch {}
  }

  const resp = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
  let embedding;
  if (resp?.data) {
    const raw = resp.data[0] || resp.data;
    embedding = Array.from(raw).map(x => Number(x));
  }
  if (!embedding || embedding.length === 0) {
    throw new Error('Embedding generation failed');
  }

  // Cache the result
  if (env.KV) {
    try {
      await env.KV.put(cacheKey, JSON.stringify(embedding), { expirationTtl: CACHE_TTL });
    } catch {}
  }

  return embedding;
}

/**
 * Vector search via Vectorize
 */
async function vectorSearch(embedding, topK, env) {
  const vectorResults = await env.VECTORIZE.query(embedding, {
    topK: topK * 2, // fetch extra for hybrid merge
    returnMetadata: 'all'
  });
  return vectorResults?.matches || [];
}

/**
 * Full-text search via FTS5 with relevance scoring
 * Falls back to LIKE if FTS5 table doesn't exist
 */
async function ftsSearch(query, topK, categories, env) {
  const terms = query.split(/\s+/).filter(t => t.length > 1).slice(0, 5);
  if (!terms.length) return [];

  try {
    // Try FTS5 first
    const ftsQuery = terms.map(t => `"${t}"`).join(' OR ');
    let sql = `SELECT r.id, r.title, r.section, r.content, r.category, r.source_url, r.metadata,
               bm25(rag_fts, 5.0, 1.0, 2.0) AS rank
               FROM rag_fts f
               JOIN rag_documents r ON r.rowid = f.rowid
               WHERE rag_fts MATCH ?`;
    const params = [ftsQuery];

    if (categories?.length) {
      const catCond = categories.map(() => `r.category LIKE ?`).join(' OR ');
      sql += ` AND (${catCond})`;
      categories.forEach(c => params.push(`${c}%`));
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(topK * 2);

    const result = await env.DB.prepare(sql).bind(...params).all();

    // Normalize BM25 scores to 0-1 range (BM25 returns negative values, lower = better)
    const rows = result.results || [];
    if (!rows.length) return [];
    const minRank = Math.min(...rows.map(r => r.rank));
    const maxRank = Math.max(...rows.map(r => r.rank));
    const range = maxRank - minRank || 1;

    return rows.map(r => ({
      chunk_id: r.id,
      title: r.title || '',
      section: r.section || '',
      content: r.content || '',
      category: r.category || '',
      source_url: r.source_url || '',
      last_updated: parseMetadata(r.metadata)?.last_updated || '',
      score: 1 - (r.rank - minRank) / range // normalize: best match → highest score
    }));
  } catch (ftsErr) {
    // FTS5 table might not exist yet; fall back to LIKE search
    console.warn('FTS5 unavailable, falling back to LIKE:', ftsErr.message);
    return await likeSearch(terms, topK, categories, env);
  }
}

/**
 * LIKE fallback search (used only when FTS5 is unavailable)
 */
async function likeSearch(terms, topK, categories, env) {
  let sql = `SELECT id, title, section, content, category, source_url FROM rag_documents WHERE `;
  const params = [];

  const conditions = terms.flatMap(t => [`title LIKE ?`, `content LIKE ?`]);
  sql += `(${conditions.join(' OR ')})`;
  terms.forEach(t => { params.push(`%${t}%`, `%${t}%`); });

  if (categories?.length) {
    const catCond = categories.map(() => `category LIKE ?`).join(' OR ');
    sql += ` AND (${catCond})`;
    categories.forEach(c => params.push(`${c}%`));
  }

  sql += ` LIMIT ?`;
  params.push(topK);

  const result = await env.DB.prepare(sql).bind(...params).all();

  // Score by title/content match count
  return (result.results || []).map(r => {
    let score = 0;
    const titleLower = (r.title || '').toLowerCase();
    const contentLower = (r.content || '').toLowerCase();
    for (const t of terms) {
      const tl = t.toLowerCase();
      if (titleLower.includes(tl)) score += 0.3;
      const matches = (contentLower.match(new RegExp(tl, 'gi')) || []).length;
      score += Math.min(matches * 0.1, 0.4);
    }
    return {
      chunk_id: r.id, title: r.title, section: r.section,
      content: r.content, category: r.category, source_url: r.source_url,
      score: Math.min(score, 1.0)
    };
  });
}

/**
 * Main search: hybrid vector + FTS5 with result caching
 */
export async function searchRAG(query, topK, categories, env) {
  try {
    const k = topK || 5;
    
    // Check RAG result cache first
    const ragCacheKey = `rag:${query.slice(0, 100)}:${k}:${(categories || []).join(',')}`;
    if (env.KV) {
      try {
        const cached = await env.KV.get(ragCacheKey, 'json');
        if (cached) {
          console.log('[RAG Cache Hit]', ragCacheKey);
          return cached;
        }
      } catch {}
    }

    // Run vector and FTS search in parallel
    const embedding = await getEmbedding(query, env);

    const [vectorMatches, ftsResults] = await Promise.all([
      vectorSearch(embedding, k, env),
      ftsSearch(query, k, categories, env)
    ]);

    // Fetch full docs for vector matches
    let vectorDocs = [];
    if (vectorMatches.length > 0) {
      const ids = vectorMatches.map(m => m.id);
      const placeholders = ids.map(() => '?').join(',');
      const docs = await env.DB.prepare(
        `SELECT id, title, section, content, category, source_url, metadata FROM rag_documents WHERE id IN (${placeholders})`
      ).bind(...ids).all();
      const docMap = new Map(docs.results.map(d => [d.id, d]));

      vectorDocs = vectorMatches.map(m => {
        const doc = docMap.get(m.id);
        const meta = parseMetadata(doc?.metadata);
        return {
          chunk_id: m.id,
          score: m.score,
          title: m.metadata?.title || doc?.title || '',
          section: m.metadata?.section || doc?.section || '',
          category: m.metadata?.category || doc?.category || '',
          content: doc?.content || '',
          source_url: doc?.source_url || '',
          last_updated: meta?.last_updated || ''
        };
      });
    }

    // Merge results with weighted scoring
    const merged = new Map();

    for (const doc of vectorDocs) {
      merged.set(doc.chunk_id, {
        ...doc,
        vector_score: doc.score,
        fts_score: 0,
        score: doc.score * VECTOR_WEIGHT
      });
    }

    for (const doc of ftsResults) {
      if (merged.has(doc.chunk_id)) {
        const existing = merged.get(doc.chunk_id);
        existing.fts_score = doc.score;
        existing.score = existing.vector_score * VECTOR_WEIGHT + doc.score * (1 - VECTOR_WEIGHT);
      } else {
        merged.set(doc.chunk_id, {
          ...doc,
          vector_score: 0,
          fts_score: doc.score,
          score: doc.score * (1 - VECTOR_WEIGHT)
        });
      }
    }

    // Filter by score threshold, sort, and limit
    let results = Array.from(merged.values())
      .filter(r => r.score >= SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    // Apply category filter if specified
    if (categories?.length) {
      const filtered = results.filter(r => categories.some(c => r.category.startsWith(c)));
      if (filtered.length > 0) results = filtered;
    }

    // Cache the final results
    if (env.KV) {
      try {
        await env.KV.put(ragCacheKey, JSON.stringify(results), { expirationTtl: RAG_CACHE_TTL });
      } catch {}
    }

    return results;
  } catch (err) {
    console.error('RAG search error:', err.message);
    // Last resort: simple keyword fallback
    const terms = query.split(/\s+/).filter(t => t.length > 1).slice(0, 3);
    if (!terms.length) return [];
    return await likeSearch(terms, topK || 5, categories, env);
  }
}

export async function handleRAGSearch(request, env, cors) {
  const { query, top_k = 5, categories = [] } = await request.json();
  if (!query) return json({ error: 'query required' }, cors, 400);
  const results = await searchRAG(query, top_k, categories, env);
  return json({ query, results, count: results.length }, cors);
}
