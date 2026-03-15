/**
 * Web Search Tool — Tavily (primary) + DuckDuckGo (fallback)
 * 
 * Optimizations:
 *  - In-flight dedup: two parallel tools calling same query → one actual API call
 *  - KV cache: 5-min TTL per query to save credits across requests
 */

import { ToolCache, CACHE_TTL } from '../cache.js';

const TAVILY_API = 'https://api.tavily.com/search';

// In-flight dedup: Map<cacheKey, Promise<result>>
// Lives for the duration of one Worker invocation (cleared automatically between requests)
const _inflight = new Map();

/**
 * Generate a stable cache key for dedup (normalize query + key options)
 */
function _tavilyCacheKey(query, opts) {
  const parts = [
    query.toLowerCase().trim(),
    opts.maxResults || 5,
    opts.depth || 'basic',
    (opts.includeDomains || []).sort().join(','),
  ];
  return `tv:${parts.join('|')}`;
}

/**
 * Tavily Search — with dedup + KV cache
 */
async function tavilySearch(query, apiKey, opts = {}) {
  const cacheKey = _tavilyCacheKey(query, opts);

  // 1. Check in-flight dedup (same Worker invocation, parallel calls)
  if (_inflight.has(cacheKey)) {
    return _inflight.get(cacheKey);
  }

  // Create the actual request promise
  const requestPromise = _tavilySearchRaw(query, apiKey, opts);
  
  // Store in inflight map so parallel callers share the same promise
  _inflight.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up after resolution (though it auto-clears between requests)
    _inflight.delete(cacheKey);
  }
}

/**
 * Raw Tavily API call (no dedup layer)
 */
async function _tavilySearchRaw(query, apiKey, opts = {}) {
  const maxResults = opts.maxResults || 5;
  const depth = opts.depth || 'basic';
  const rawContent = opts.rawContent !== false;
  const answer = opts.answer ?? 'basic';
  const topic = opts.topic || 'general';
  const includeDomains = opts.includeDomains || [];
  const excludeDomains = opts.excludeDomains || [];

  const body = {
    api_key: apiKey,
    query,
    max_results: maxResults,
    search_depth: depth,
    include_raw_content: rawContent,
    include_answer: answer,
    include_domains: includeDomains,
    exclude_domains: excludeDomains,
  };

  if (includeDomains.length === 0) {
    body.topic = topic;
    if (topic === 'general') body.country = 'au';
  }

  const resp = await fetch(TAVILY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Tavily ${resp.status}: ${errText.substring(0, 120)}`);
  }

  const data = await resp.json();
  const results = (data.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    source: 'Tavily',
    score: r.score ?? 0,
  }));

  const response = { results, source: 'Tavily' };

  if (data.answer) {
    response.ai_answer = data.answer;
  }

  if (rawContent) {
    response.deep_content = (data.results || [])
      .filter(r => r.raw_content && r.raw_content.length > 300)
      .slice(0, 3)
      .map(r => ({
        title: r.title || '',
        url: r.url || '',
        content: r.raw_content.substring(0, 4000),
      }));
  }

  return response;
}

/**
 * Use Jina Reader to fetch full page content as markdown (DDG fallback)
 */
async function jinaDeepRead(url, apiKey) {
  try {
    const resp = await fetch(JINA_READER_BASE + url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data?.data?.content || data?.content || '';
    const title = data?.data?.title || data?.title || '';
    if (content.length < 200) return null;
    // Truncate to fit LLM context
    return { title, content: content.substring(0, 3000), url };
  } catch {
    return null;
  }
}

/**
 * Core DuckDuckGo search — returns { results, source }
 */
async function duckDuckGoSearch(query, maxResults) {
  // Try DuckDuckGo Instant Answer API first
  try {
    const iaUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const iaResp = await fetch(iaUrl, {
      headers: { 'User-Agent': 'AustralianAssistant/1.0' }
    });

    if (iaResp.ok) {
      const iaData = await iaResp.json();
      const results = [];

      if (iaData.Abstract) {
        results.push({
          title: iaData.Heading || query,
          url: iaData.AbstractURL || '',
          snippet: iaData.Abstract,
          source: iaData.AbstractSource || 'DuckDuckGo'
        });
      }

      if (iaData.RelatedTopics) {
        for (const topic of iaData.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text) {
            results.push({
              title: topic.Text.split(' - ')[0] || '',
              url: topic.FirstURL || '',
              snippet: topic.Text,
              source: 'DuckDuckGo'
            });
          }
          if (topic.Topics) {
            for (const sub of topic.Topics.slice(0, 2)) {
              if (sub.Text) {
                results.push({
                  title: sub.Text.split(' - ')[0] || '',
                  url: sub.FirstURL || '',
                  snippet: sub.Text,
                  source: 'DuckDuckGo'
                });
              }
            }
          }
        }
      }

      if (results.length > 0) {
        return { results: results.slice(0, maxResults), source: 'DuckDuckGo Instant Answer' };
      }
    }
  } catch (e) {
    console.error('DDG IA failed:', e.message);
  }

  // Fallback: DuckDuckGo HTML lite search
  try {
    const htmlUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + ' australia')}&kl=au-en`;
    const htmlResp = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });

    if (htmlResp.ok) {
      const html = await htmlResp.text();
      const results = [];
      const linkRegex = /<a[^>]*class=["']result-link["'][^>]*?href=["']([^"']*)["'][^>]*>([^<]*)<\/a>|<a[^>]*href=["']([^"']*)["'][^>]*?class=["']result-link["'][^>]*>([^<]*)<\/a>/gi;
      const snippetRegex = /<td[^>]*class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/gi;

      let linkMatch;
      const links = [];
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        const url = linkMatch[1] || linkMatch[3];
        const title = linkMatch[2] || linkMatch[4];
        if (url && title) {
          links.push({ url: url.trim(), title: title.trim() });
        }
      }

      let snippetMatch;
      const snippets = [];
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippets.push(snippetMatch[1].replace(/<[^>]*>/g, '').trim());
      }

      for (let i = 0; i < Math.min(links.length, maxResults); i++) {
        results.push({
          title: links[i].title,
          url: links[i].url,
          snippet: snippets[i] || '',
          source: 'DuckDuckGo'
        });
      }

      if (results.length > 0) {
        return { results, source: 'DuckDuckGo Lite' };
      }
    }
  } catch (e) {
    console.error('DDG Lite failed:', e.message);
  }

  return { results: [], source: 'none' };
}

export { tavilySearch };

export async function webSearch(args, env) {
  const query = args.query || '';
  if (!query) return { error: 'Please provide a search query' };

  const maxResults = args.max_results || 5;
  const tavilyKey = env?.TAVILY_API_KEY;
  const jinaKey = env?.JINA_API_KEY;
  const cache = new ToolCache(env);

  // Check cache first
  const cached = await cache.get('web_search', query);
  if (cached) return { query, ...cached };

  // Primary: Tavily — returns full page raw_content, no extra fetch needed
  if (tavilyKey) {
    try {
      const result = await tavilySearch(query, tavilyKey, {
        maxResults,
        depth: 'basic',       // basic=1 credit (vs advanced=2)
        rawContent: true,     // full page content for deep reading
        answer: 'basic',      // AI-generated answer summary
      });
      // Cache the result
      await cache.set('web_search', query, [], result, CACHE_TTL.WEB_SEARCH);
      return { query, ...result };
    } catch (e) {
      console.error('Tavily failed, falling back to DuckDuckGo:', e.message);
    }
  }

  // Fallback: DuckDuckGo + optional Jina Deep Read
  const { results, source } = await duckDuckGoSearch(query, maxResults);

  if (results.length === 0) {
    return { query, results: [], message: 'No search results found. Try refining your query.' };
  }

  if (jinaKey) {
    const urlsToRead = results
      .filter(r => r.url && r.url.startsWith('http'))
      .slice(0, 2);

    if (urlsToRead.length > 0) {
      try {
        const deepReads = await Promise.allSettled(
          urlsToRead.map(r => jinaDeepRead(r.url, jinaKey))
        );
        const deep_content = deepReads
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value);

        if (deep_content.length > 0) {
          return { query, results: results.slice(0, maxResults), deep_content, source: source + ' + Jina' };
        }
      } catch (e) {
        console.error('Jina deep read failed:', e.message);
      }
    }
  }

  return { query, results: results.slice(0, maxResults), source };
}
