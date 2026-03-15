/**
 * Cloudflare Browser Rendering — /markdown & /crawl utility
 * 
 * /markdown — 同步单页面抓取，返回 Markdown（替代 Tavily fallback）
 * /crawl   — 异步多页面爬取，用于 RAG 数据批量构建
 * 
 * 需要环境变量:
 *   CF_ACCOUNT_ID     — Cloudflare Account ID
 *   CF_API_TOKEN      — API Token (需要 Browser Rendering - Edit 权限)
 * 
 * 或者直接用 BROWSER binding (Puppeteer) 作为后备
 */

const CF_BR_BASE = 'https://api.cloudflare.com/client/v4/accounts';

/**
 * 获取单个网页的 Markdown 内容（同步，通常 3-10 秒）
 * 替代 Tavily 搜索 fallback — 直接获取第一手页面数据
 * 
 * @param {string} url - 要抓取的网页 URL
 * @param {object} env - Cloudflare Worker env
 * @param {object} options - 可选参数
 * @returns {string|null} Markdown 内容或 null
 */
export async function fetchMarkdown(url, env, options = {}) {
  const accountId = env?.CF_ACCOUNT_ID;
  const apiToken = env?.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    // 没有配置 → 回退到直接 fetch + 简单 HTML→text
    return await simpleFetch(url);
  }

  try {
    const endpoint = `${CF_BR_BASE}/${accountId}/browser-rendering/markdown`;
    const body = { url };
    
    // 可选: 等待动态内容加载
    if (options.waitFor) {
      body.render = { wait: options.waitFor };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`CF /markdown returned ${res.status}`);
      return await simpleFetch(url);
    }

    const data = await res.json();
    if (data.success && data.result) {
      return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    }

    return await simpleFetch(url);
  } catch (err) {
    console.error(`CF /markdown error: ${err.message}`);
    return await simpleFetch(url);
  }
}

/**
 * 启动异步爬取任务（用于 RAG 数据构建）
 * 返回 job ID，需要轮询获取结果
 * 
 * @param {string} url - 起始 URL
 * @param {object} env - Cloudflare Worker env
 * @param {object} options - 爬取选项
 * @returns {object} { jobId, error }
 */
export async function startCrawl(url, env, options = {}) {
  const accountId = env?.CF_ACCOUNT_ID;
  const apiToken = env?.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return { error: 'CF_ACCOUNT_ID and CF_API_TOKEN required for /crawl' };
  }

  try {
    const endpoint = `${CF_BR_BASE}/${accountId}/browser-rendering/crawl`;
    const body = {
      url,
      limit: options.maxPages || 10,
      depth: options.depth || 2,
      formats: options.formats || ['markdown'],
    };

    // Optional: include/exclude patterns
    if (options.includePatterns) {
      body.options = body.options || {};
      body.options.includePatterns = options.includePatterns;
    }
    if (options.excludePatterns) {
      body.options = body.options || {};
      body.options.excludePatterns = options.excludePatterns;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { error: `CF /crawl returned ${res.status}` };
    }

    const data = await res.json();
    if (data.success && data.result) {
      return { jobId: data.result };
    }

    return { error: 'Unexpected crawl response' };
  } catch (err) {
    return { error: `CF /crawl error: ${err.message}` };
  }
}

/**
 * 获取爬取任务结果
 */
export async function getCrawlResults(jobId, env, options = {}) {
  const accountId = env?.CF_ACCOUNT_ID;
  const apiToken = env?.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return { error: 'CF_ACCOUNT_ID and CF_API_TOKEN required' };
  }

  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.status) params.set('status', options.status);
    if (options.cursor) params.set('cursor', options.cursor);

    const endpoint = `${CF_BR_BASE}/${accountId}/browser-rendering/crawl/${jobId}?${params}`;
    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      return { error: `GET crawl results returned ${res.status}` };
    }

    const data = await res.json();
    return data.result || { error: 'No result' };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * 高层封装: 抓取单个页面内容并提取关键信息
 * 适用于工具 fallback（替代 Tavily）
 * 
 * @param {string} url - 要抓取的 URL
 * @param {object} env - Worker env
 * @param {object} options - { maxLength, extractTitle }
 * @returns {object} { title, content, url, source }
 */
export async function crawlPage(url, env, options = {}) {
  const maxLength = options.maxLength || 3000;
  
  try {
    const markdown = await fetchMarkdown(url, env, options);
    if (!markdown || markdown.trim().length < 50) {
      return {
        url,
        error: 'Failed to fetch or page content is empty',
        _DO_NOT_FABRICATE: true,
        instruction: '页面抓取失败或内容为空。严禁编造页面内容。请告知用户无法获取该页面数据，建议直接访问链接。',
      };
    }

    // Extract title from first heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : '';

    // Truncate content
    const content = markdown.length > maxLength
      ? markdown.substring(0, maxLength) + '...'
      : markdown;

    return {
      title,
      content,
      url,
      source: 'Cloudflare Browser Rendering',
      content_length: markdown.length,
    };
  } catch (err) {
    return {
      url,
      error: err.message,
      _DO_NOT_FABRICATE: true,
      instruction: '页面抓取失败。严禁编造页面内容。请告知用户无法获取该页面数据，建议直接访问链接。',
    };
  }
}

/**
 * 高层封装: 搜索式抓取多个 URL
 * 替代 Tavily 搜索 — 直接抓取已知的官方URL列表
 * 
 * @param {string[]} urls - 要抓取的 URL 列表
 * @param {object} env - Worker env
 * @param {object} options - { maxLength, maxUrls }
 */
export async function crawlPages(urls, env, options = {}) {
  const maxUrls = Math.min(options.maxUrls || 3, 5);
  const results = [];

  for (const url of urls.slice(0, maxUrls)) {
    try {
      const result = await crawlPage(url, env, { maxLength: options.maxLength || 1500 });
      if (result && !result.error) {
        results.push(result);
      }
    } catch {}
  }

  return results;
}

/**
 * 简单 HTML fetch 后备方案（不需要 API token）
 */
async function simpleFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AustralianAssistant/1.0)',
        'Accept': 'text/html,text/plain',
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    // Basic HTML → text conversion
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000);
  } catch {
    return null;
  }
}
