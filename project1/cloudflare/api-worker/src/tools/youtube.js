/**
 * YouTube Search Tool — 搜索澳洲相关视频
 * 
 * 使用 YouTube Data API v3:
 * - 免费额度：10,000 units/天
 * - Search 操作：100 units/次 = 每天100次搜索
 * - 使用 GOOGLE_PLACES_API_KEY（同一个 Google Cloud 项目需启用 YouTube Data API v3）
 * 
 * 场景：用户问澳洲生活/攻略类问题时推荐相关 YouTube 视频
 */

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

/**
 * 搜索 YouTube 视频
 */
async function searchYouTube(query, apiKey, options = {}) {
  const {
    maxResults = 5,
    language = 'zh',
    regionCode = 'AU',
    order = 'relevance',
    videoDuration = 'medium',
  } = options;

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    regionCode,
    relevanceLanguage: language,
    order,
    videoDuration,
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_API}/search?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return (data.items || []).map(item => ({
    title: item.snippet?.title || '',
    description: (item.snippet?.description || '').substring(0, 200),
    channel: item.snippet?.channelTitle || '',
    published: item.snippet?.publishedAt?.substring(0, 10) || '',
    video_id: item.id?.videoId || '',
    url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
  }));
}

/**
 * 根据话题优化搜索词
 */
function buildSearchQuery(query, category) {
  const prefixes = {
    visa: 'Australia visa',
    rental: 'Australia rent',
    tax: 'Australian tax',
    study: 'Australia university student',
    food: 'Australia Chinese food',
    travel: 'Australia travel vlog',
    driving: 'Australia driving licence',
    living: 'Australia living guide',
    work: 'Australia work job',
    finance: 'Australia finance investment',
  };

  // Auto-detect category from query
  let detectedCat = category || '';
  if (!detectedCat) {
    if (/签证|visa|移民|immigration|PR/i.test(query)) detectedCat = 'visa';
    else if (/租房|rent|lease|合租/i.test(query)) detectedCat = 'rental';
    else if (/税|tax|ATO|退税/i.test(query)) detectedCat = 'tax';
    else if (/留学|大学|college|university|学校/i.test(query)) detectedCat = 'study';
    else if (/美食|餐厅|中餐|吃/i.test(query)) detectedCat = 'food';
    else if (/旅游|旅行|景点|玩/i.test(query)) detectedCat = 'travel';
    else if (/驾照|开车|driving|road/i.test(query)) detectedCat = 'driving';
    else if (/工作|打工|job|salary/i.test(query)) detectedCat = 'work';
    else if (/投资|理财|ETF|股票|super/i.test(query)) detectedCat = 'finance';
  }

  const prefix = prefixes[detectedCat] || 'Australia';
  // Add Chinese keywords for Chinese content
  const zhQuery = /[\u4e00-\u9fff]/.test(query) ? query : `${query} 澳洲`;
  return `${prefix} ${zhQuery}`.trim();
}

export async function searchYouTubeVideos(args, env) {
  const query = args.query || args.search || '';
  const category = args.category || '';
  const maxResults = Math.min(args.max_results || 5, 10);
  const language = args.language || 'zh';

  if (!query) {
    return {
      error: 'Please provide a search query',
      examples: [
        '澳洲留学攻略',
        'Melbourne rent guide',
        '澳洲签证经验',
        'Sydney Chinese food',
        '澳洲驾照怎么考',
      ],
    };
  }

  const apiKey = env?.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    // Fallback: use Tavily to search YouTube
    try {
      const { tavilySearch } = await import('./web-search.js');
      const tavilyKey = env?.TAVILY_API_KEY;
      if (tavilyKey) {
        const data = await tavilySearch(`${query} site:youtube.com`, tavilyKey, {
          maxResults: maxResults,
          depth: 'basic',
          includeDomains: ['youtube.com'],
        });
        return {
          query,
          videos: (data.results || []).map(r => ({
            title: r.title || '',
            url: r.url || '',
            description: (r.content || r.snippet || '').substring(0, 200),
          })),
          source: 'Tavily YouTube search (YouTube API key not configured)',
        };
      }
    } catch {}
    return { error: 'YouTube search requires GOOGLE_PLACES_API_KEY with YouTube Data API v3 enabled' };
  }

  try {
    const searchQuery = buildSearchQuery(query, category);
    const videos = await searchYouTube(searchQuery, apiKey, {
      maxResults,
      language,
      regionCode: 'AU',
    });

    // Also try English search if Chinese search returns few results
    let extraVideos = [];
    if (videos.length < 3 && /[\u4e00-\u9fff]/.test(query)) {
      try {
        extraVideos = await searchYouTube(`Australia ${query}`, apiKey, {
          maxResults: 3,
          language: 'en',
          regionCode: 'AU',
        });
      } catch {}
    }

    const allVideos = [...videos, ...extraVideos]
      .filter((v, i, arr) => arr.findIndex(x => x.video_id === v.video_id) === i)
      .slice(0, maxResults);

    return {
      query: searchQuery,
      videos: allVideos,
      video_count: allVideos.length,
      tip: '点击链接观看视频。建议关注华人 YouTuber 获取最新澳洲生活资讯！',
      source: 'YouTube Data API v3',
    };
  } catch (err) {
    return { error: `YouTube search failed: ${err.message}` };
  }
}
