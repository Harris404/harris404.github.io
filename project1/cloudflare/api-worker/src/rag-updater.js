/**
 * RAG Auto-Updater Engine
 * 
 * Runs on Cloudflare Cron triggers to:
 * 1. Crawl government/commercial websites
 * 2. Compare content hash with existing data
 * 3. Update D1 + regenerate Vectorize embeddings when changed
 * 4. Log update status to KV
 */

import { getSourcesBySchedule, RAG_SOURCES } from './rag-sources.js';

const MAX_CONTENT_LENGTH = 4000; // Trim to fit D1 + embedding limits
const BATCH_SIZE = 5; // Process 5 sources in parallel

/**
 * Main entry point — called by scheduled() in worker.js
 * @param {string} scheduleType - weekly|monthly|quarterly|annual
 * @param {object} env - Cloudflare bindings (DB, VECTORIZE, AI, KV, BROWSER)
 * @returns {object} Update report
 */
export async function runScheduledUpdate(scheduleType, env) {
  const categories = getSourcesBySchedule(scheduleType);
  if (!categories.length) {
    return { schedule: scheduleType, message: 'No categories for this schedule', updated: 0 };
  }

  console.log(`[RAG Updater] Starting ${scheduleType} update for ${categories.length} categories`);

  const report = {
    schedule: scheduleType,
    timestamp: new Date().toISOString(),
    categories: [],
    total_updated: 0,
    total_skipped: 0,
    total_errors: 0,
  };

  // Process categories sequentially to avoid overwhelming APIs
  for (const cat of categories) {
    const catReport = await updateCategory(cat, env);
    report.categories.push(catReport);
    report.total_updated += catReport.updated;
    report.total_skipped += catReport.skipped;
    report.total_errors += catReport.errors;
  }

  // Save report to KV
  if (env.KV) {
    try {
      await env.KV.put(
        `rag-update::${scheduleType}::last`,
        JSON.stringify(report),
        { expirationTtl: 86400 * 90 } // Keep 90 days
      );
      await env.KV.put(
        `rag-update::last`,
        JSON.stringify({ schedule: scheduleType, timestamp: report.timestamp, summary: `${report.total_updated} updated, ${report.total_skipped} skipped, ${report.total_errors} errors` }),
        { expirationTtl: 86400 * 90 }
      );
    } catch (e) {
      console.error('[RAG Updater] Failed to save report:', e.message);
    }
  }

  console.log(`[RAG Updater] ${scheduleType} complete: ${report.total_updated} updated, ${report.total_skipped} unchanged, ${report.total_errors} errors`);
  return report;
}

/**
 * Update a single RAG category
 */
async function updateCategory(cat, env) {
  const catReport = {
    key: cat.key,
    category: cat.category,
    title: cat.title,
    sources: [],
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  // Process sources in batches
  for (let i = 0; i < cat.sources.length; i += BATCH_SIZE) {
    const batch = cat.sources.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(source => processSource(source, cat, env))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        catReport.sources.push(result.value);
        if (result.value.action === 'updated') catReport.updated++;
        else if (result.value.action === 'skipped') catReport.skipped++;
      } else {
        catReport.errors++;
        catReport.sources.push({ error: result.reason?.message || 'Unknown error' });
      }
    }
  }

  // Update category last-updated timestamp in KV
  if (env.KV) {
    try {
      await env.KV.put(
        `rag-update::${cat.key}::last`,
        JSON.stringify({ timestamp: new Date().toISOString(), ...catReport }),
        { expirationTtl: 86400 * 365 }
      );
    } catch {}
  }

  return catReport;
}

/**
 * Process a single source URL
 */
async function processSource(source, cat, env) {
  const { url, label, type } = source;

  try {
    // 1. Fetch content
    const content = await fetchContent(url, type, env);
    if (!content || content.length < 50) {
      return { url, label, action: 'skipped', reason: 'Content too short or empty' };
    }

    // 2. Compute hash to detect changes
    const contentHash = await hashContent(content);
    const docId = generateDocId(cat.category, url);

    // 3. Check existing hash in D1
    const existing = await getExistingDoc(docId, env);
    if (existing?.content_hash === contentHash) {
      return { url, label, action: 'skipped', reason: 'Content unchanged' };
    }

    // 4. Trim content for storage
    const trimmedContent = content.slice(0, MAX_CONTENT_LENGTH);

    // 5. Generate embedding via Cloudflare AI
    const embedding = await generateEmbedding(trimmedContent, env);

    // 6. Upsert to D1
    await upsertDocument({
      id: docId,
      title: label,
      section: cat.title,
      content: trimmedContent,
      category: cat.category,
      source_url: url,
      content_hash: contentHash,
      metadata: JSON.stringify({
        last_updated: new Date().toISOString(),
        source_label: label,
        schedule: cat.schedule,
      }),
    }, env);

    // 7. Upsert to Vectorize
    await upsertVector(docId, embedding, {
      title: label,
      section: cat.title,
      category: cat.category,
    }, env);

    return { url, label, action: 'updated', contentLength: trimmedContent.length };
  } catch (err) {
    console.error(`[RAG Updater] Error processing ${url}:`, err.message);
    return { url, label, action: 'error', error: err.message };
  }
}

// ═══════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════

/**
 * Fetch content from a URL using Cloudflare Browser Rendering or fetch
 */
async function fetchContent(url, type, env) {
  if (type === 'crawl' && env.BROWSER) {
    // Use Browser Rendering for JS-rendered pages
    try {
      const { crawlPage } = await import('./tools/cf-crawl.js');
      const result = await crawlPage(url, env, { maxLength: MAX_CONTENT_LENGTH + 500 });
      return result?.content || result?.markdown || '';
    } catch (e) {
      console.warn(`[RAG Updater] Browser crawl failed for ${url}, trying fetch:`, e.message);
    }
  }

  // Fallback: simple fetch + HTML text extraction
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'AoZhi-RAG-Updater/1.0 (+https://aozhi.ai)' },
      cf: { cacheTtl: 3600 },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    return extractTextFromHTML(html);
  } catch (e) {
    throw new Error(`Fetch failed: ${e.message}`);
  }
}

/**
 * Simple HTML → text extraction (removes tags, scripts, styles)
 */
function extractTextFromHTML(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * SHA-256 hash of content for change detection
 */
async function hashContent(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content.slice(0, 2000)); // Hash first 2000 chars
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a stable document ID from category + URL
 */
function generateDocId(category, url) {
  // Create a deterministic ID so updates overwrite the same record
  const clean = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
  return `rag_${category.replace(/\//g, '_')}_${clean}`;
}

/**
 * Get existing document from D1
 */
async function getExistingDoc(docId, env) {
  if (!env.DB) return null;
  try {
    const result = await env.DB.prepare(
      'SELECT id, content_hash FROM rag_documents WHERE id = ?'
    ).bind(docId).first();
    return result;
  } catch {
    return null;
  }
}

/**
 * Generate embedding via Cloudflare AI
 */
async function generateEmbedding(text, env) {
  if (!env.AI) throw new Error('AI binding not available');
  const resp = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text.slice(0, 512)] });
  const raw = resp?.data?.[0] || resp?.data;
  if (!raw) throw new Error('Embedding generation failed');
  return Array.from(raw).map(x => Number(x));
}

/**
 * Upsert document to D1
 */
async function upsertDocument(doc, env) {
  if (!env.DB) throw new Error('DB binding not available');

  // Try UPDATE first, then INSERT
  const updateResult = await env.DB.prepare(
    `UPDATE rag_documents SET title=?, section=?, content=?, category=?, source_url=?, metadata=?, content_hash=?
     WHERE id=?`
  ).bind(doc.title, doc.section, doc.content, doc.category, doc.source_url, doc.metadata, doc.content_hash, doc.id).run();

  if (!updateResult.meta?.changes || updateResult.meta.changes === 0) {
    await env.DB.prepare(
      `INSERT INTO rag_documents (id, title, section, content, category, source_url, metadata, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(doc.id, doc.title, doc.section, doc.content, doc.category, doc.source_url, doc.metadata, doc.content_hash).run();
  }
}

/**
 * Upsert vector to Vectorize
 */
async function upsertVector(id, embedding, metadata, env) {
  if (!env.VECTORIZE) throw new Error('VECTORIZE binding not available');
  await env.VECTORIZE.upsert([{
    id,
    values: embedding,
    metadata,
  }]);
}

/**
 * Get update status for all categories
 */
export async function getUpdateStatus(env) {
  const status = {};

  for (const [key, cfg] of Object.entries(RAG_SOURCES)) {
    const kvKey = `rag-update::${key}::last`;
    let lastUpdate = null;
    if (env.KV) {
      try {
        lastUpdate = await env.KV.get(kvKey, 'json');
      } catch {}
    }

    // Count documents in D1 for this category
    let docCount = 0;
    if (env.DB) {
      try {
        const result = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM rag_documents WHERE category = ? OR category LIKE ?'
        ).bind(cfg.category, `${cfg.category}%`).first();
        docCount = result?.count || 0;
      } catch {}
    }

    status[key] = {
      category: cfg.category,
      title: cfg.title,
      schedule: cfg.schedule,
      sourceCount: cfg.sources.length,
      documentCount: docCount,
      lastUpdate: lastUpdate?.timestamp || 'never',
      lastStatus: lastUpdate ? `${lastUpdate.updated || 0} updated, ${lastUpdate.skipped || 0} skipped` : 'no data',
    };
  }

  return status;
}

/**
 * Manually trigger an update for a specific category
 */
export async function triggerCategoryUpdate(categoryKey, env) {
  const cfg = RAG_SOURCES[categoryKey];
  if (!cfg) throw new Error(`Unknown category: ${categoryKey}`);

  return await updateCategory({ key: categoryKey, ...cfg }, env);
}
