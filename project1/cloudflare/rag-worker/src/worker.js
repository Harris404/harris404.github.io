/**
 * Australian RAG Worker
 * 
 * Cloudflare Worker for RAG search using Vectorize and D1
 * 
 * Endpoints:
 *   POST /search - Vector similarity search
 *   POST /search/keyword - Keyword search in D1
 *   GET  /health - Health check
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Route handling
      if (url.pathname === '/health') {
        return jsonResponse({ status: 'ok', service: 'australian-rag-worker' }, corsHeaders);
      }
      
      if (url.pathname === '/search' && request.method === 'POST') {
        return await handleVectorSearch(request, env, corsHeaders);
      }
      
      if (url.pathname === '/search/keyword' && request.method === 'POST') {
        return await handleKeywordSearch(request, env, corsHeaders);
      }
      
      if (url.pathname === '/search/hybrid' && request.method === 'POST') {
        return await handleHybridSearch(request, env, corsHeaders);
      }
      
      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
      
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message }, corsHeaders, 500);
    }
  }
};

/**
 * Vector similarity search using Cloudflare AI for embeddings + Vectorize
 */
async function handleVectorSearch(request, env, corsHeaders) {
  const body = await request.json();
  const { query, top_k = 5, category = null, embedding = null } = body;
  
  if (!query && !embedding) {
    return jsonResponse({ error: 'query or embedding required' }, corsHeaders, 400);
  }
  
  let queryEmbedding = embedding;
  
  // Generate embedding if not provided
  if (!queryEmbedding) {
    try {
      // Use Cloudflare AI to generate embedding
      // The API expects: { text: "string" } or { text: ["array", "of", "strings"] }
      const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: query  // Single string
      });
      
      // Handle different response formats
      if (embeddingResponse && embeddingResponse.data) {
        // Format: { data: [[...768 floats]] } or { data: [...768 floats] }
        queryEmbedding = Array.isArray(embeddingResponse.data[0]) 
          ? embeddingResponse.data[0] 
          : embeddingResponse.data;
      } else if (Array.isArray(embeddingResponse)) {
        queryEmbedding = embeddingResponse;
      } else {
        // Return error with debug info
        return jsonResponse({ 
          error: 'Embedding generation failed',
          debug: {
            responseType: typeof embeddingResponse,
            responseKeys: Object.keys(embeddingResponse || {}),
            responsePreview: JSON.stringify(embeddingResponse).slice(0, 200)
          }
        }, corsHeaders, 500);
      }
      
      // Validate embedding dimensions
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        return jsonResponse({
          error: `Invalid embedding dimensions: got ${queryEmbedding?.length || 0}, expected 768`,
          debug: { embeddingLength: queryEmbedding?.length }
        }, corsHeaders, 500);
      }
      
      // Ensure it's a proper array of numbers (not Float32Array or other typed array)
      queryEmbedding = Array.from(queryEmbedding).map(x => Number(x));
      
    } catch (aiError) {
      return jsonResponse({
        error: 'AI embedding error: ' + aiError.message,
        debug: { stack: aiError.stack }
      }, corsHeaders, 500);
    }
  }
  
  // Query Vectorize
  // Vectorize.query expects: query(vector, options) not query({ vector, ...options })
  const vectorizeOptions = {
    topK: top_k,
    returnMetadata: 'all'
  };
  
  // Add category filter if specified
  if (category) {
    vectorizeOptions.filter = { category: { $eq: category } };
  }
  
  let vectorResults;
  try {
    vectorResults = await env.VECTORIZE.query(queryEmbedding, vectorizeOptions);
  } catch (vecError) {
    return jsonResponse({
      error: 'Vectorize query error: ' + vecError.message,
      debug: {
        embeddingLength: queryEmbedding?.length,
        embeddingType: typeof queryEmbedding,
        isArray: Array.isArray(queryEmbedding),
        sample: queryEmbedding?.slice(0, 5)
      }
    }, corsHeaders, 500);
  }
  
  if (!vectorResults.matches || vectorResults.matches.length === 0) {
    return jsonResponse({ results: [], query }, corsHeaders);
  }
  
  // Get document IDs
  const docIds = vectorResults.matches.map(m => m.id);
  
  // Fetch full documents from D1
  const placeholders = docIds.map(() => '?').join(',');
  const docs = await env.DB.prepare(
    `SELECT id, title, section, content, category, source, source_url, tags, metadata 
     FROM rag_documents WHERE id IN (${placeholders})`
  ).bind(...docIds).all();
  
  // Create a map for quick lookup
  const docMap = new Map(docs.results.map(d => [d.id, d]));
  
  // Combine vector scores with document content
  const results = vectorResults.matches.map(match => {
    const doc = docMap.get(match.id);
    return {
      id: match.id,
      score: match.score,
      title: match.metadata?.title || doc?.title || '',
      section: match.metadata?.section || doc?.section || '',
      category: match.metadata?.category || doc?.category || '',
      content: doc?.content || '',
      source: doc?.source || '',
      source_url: doc?.source_url || ''
    };
  });
  
  return jsonResponse({ 
    results, 
    query,
    total: results.length 
  }, corsHeaders);
}

/**
 * Keyword search in D1 database
 */
async function handleKeywordSearch(request, env, corsHeaders) {
  const body = await request.json();
  const { query, top_k = 5, categories = [] } = body;
  
  if (!query) {
    return jsonResponse({ error: 'query required' }, corsHeaders, 400);
  }
  
  // Build search query - simple LIKE search
  // For Chinese, we search content directly
  const searchTerms = query.split(/\s+/).filter(t => t.length > 0);
  
  let sql = `SELECT id, title, section, content, category, source, source_url 
             FROM rag_documents WHERE 1=1`;
  const params = [];
  
  // Add category filter
  if (categories && categories.length > 0) {
    const catPlaceholders = categories.map(() => '?').join(',');
    sql += ` AND category IN (${catPlaceholders})`;
    params.push(...categories);
  }
  
  // Add search terms (OR logic for multiple terms)
  if (searchTerms.length > 0) {
    const termConditions = searchTerms.map(() => 
      `(content LIKE ? OR title LIKE ? OR section LIKE ?)`
    ).join(' OR ');
    sql += ` AND (${termConditions})`;
    searchTerms.forEach(term => {
      const likeTerm = `%${term}%`;
      params.push(likeTerm, likeTerm, likeTerm);
    });
  }
  
  sql += ` LIMIT ?`;
  params.push(top_k);
  
  const stmt = env.DB.prepare(sql);
  const results = await stmt.bind(...params).all();
  
  // Calculate simple relevance score based on term matches
  const scoredResults = results.results.map(doc => {
    let score = 0;
    const contentLower = (doc.content || '').toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();
    
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      // Title match = higher weight
      if (titleLower.includes(termLower)) score += 0.3;
      // Content matches
      const contentMatches = (contentLower.match(new RegExp(termLower, 'g')) || []).length;
      score += Math.min(contentMatches * 0.1, 0.5);
    });
    
    return { ...doc, score: Math.min(score, 1.0) };
  });
  
  // Sort by score
  scoredResults.sort((a, b) => b.score - a.score);
  
  return jsonResponse({
    results: scoredResults,
    query,
    total: scoredResults.length
  }, corsHeaders);
}

/**
 * Hybrid search: combines vector and keyword search
 */
async function handleHybridSearch(request, env, corsHeaders) {
  const body = await request.json();
  const { query, top_k = 5, categories = [], vector_weight = 0.7 } = body;
  
  if (!query) {
    return jsonResponse({ error: 'query required' }, corsHeaders, 400);
  }
  
  // Run both searches in parallel
  const [vectorResponse, keywordResponse] = await Promise.all([
    handleVectorSearch(
      new Request('http://dummy/search', {
        method: 'POST',
        body: JSON.stringify({ query, top_k: top_k * 2, category: categories[0] })
      }),
      env,
      corsHeaders
    ),
    handleKeywordSearch(
      new Request('http://dummy/search/keyword', {
        method: 'POST',
        body: JSON.stringify({ query, top_k: top_k * 2, categories })
      }),
      env,
      corsHeaders
    )
  ]);
  
  const vectorResults = await vectorResponse.json();
  const keywordResults = await keywordResponse.json();
  
  // Merge results with weighted scores
  const resultMap = new Map();
  
  (vectorResults.results || []).forEach(r => {
    resultMap.set(r.id, {
      ...r,
      vector_score: r.score,
      keyword_score: 0,
      combined_score: r.score * vector_weight
    });
  });
  
  (keywordResults.results || []).forEach(r => {
    if (resultMap.has(r.id)) {
      const existing = resultMap.get(r.id);
      existing.keyword_score = r.score;
      existing.combined_score = 
        existing.vector_score * vector_weight + 
        r.score * (1 - vector_weight);
    } else {
      resultMap.set(r.id, {
        ...r,
        vector_score: 0,
        keyword_score: r.score,
        combined_score: r.score * (1 - vector_weight)
      });
    }
  });
  
  // Sort by combined score and limit
  const mergedResults = Array.from(resultMap.values())
    .sort((a, b) => b.combined_score - a.combined_score)
    .slice(0, top_k)
    .map(r => ({
      ...r,
      score: r.combined_score
    }));
  
  return jsonResponse({
    results: mergedResults,
    query,
    total: mergedResults.length,
    method: 'hybrid'
  }, corsHeaders);
}

function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
