/**
 * Chinese Australian Forums Search — 澳洲中文论坛搜索
 * 
 * 数据来源：
 * 1. 今日澳洲 (ozchinese.com) — 最大澳洲华人社区
 * 2. 澳洲中文网 (acnw.com.au) — 新闻+论坛
 * 3. 新足迹 (oursteps.com.au) — 老牌华人论坛
 * 4. 亿忆网 (yeeyi.com) — 综合资讯
 * 5. 澳洲生活网 (auliving.com.au) — 生活指南
 * 
 * 使用 Cloudflare /markdown 抓取 + Tavily 搜索双策略
 */

// 论坛配置
const FORUMS = {
  ozchinese: {
    name: '今日澳洲',
    base: 'https://www.ozchinese.com',
    search: 'https://www.ozchinese.com/search?q=',
    sections: {
      visa: '/forum/immigration/',
      rental: '/forum/property/',
      study: '/forum/education/',
      work: '/forum/career/',
      life: '/forum/lifestyle/',
      finance: '/forum/finance/',
      news: '/news/',
    },
  },
  oursteps: {
    name: '新足迹',
    base: 'https://www.oursteps.com.au',
    search: 'https://www.oursteps.com.au/bbs/search.php?searchsubmit=yes&srchtxt=',
    sections: {
      visa: '/bbs/forum-29-1.html',
      rental: '/bbs/forum-65-1.html',
      study: '/bbs/forum-82-1.html',
      finance: '/bbs/forum-330-1.html',
      life: '/bbs/forum-48-1.html',
    },
  },
  acnw: {
    name: '澳洲中文网',
    base: 'https://www.acnw.com.au',
    sections: {
      news: '/',
      life: '/life/',
      property: '/property/',
    },
  },
  yeeyi: {
    name: '亿忆网',
    base: 'https://www.yeeyi.com',
    sections: {
      news: '/news/',
      life: '/bbs/',
    },
  },
};

// 话题到版块映射
const TOPIC_MAP = {
  visa: ['visa', '签证', '移民', 'immigration', 'PR'],
  rental: ['rental', '租房', '买房', 'property', 'rent', 'lease', 'bond'],
  study: ['study', '留学', '大学', 'university', 'course', 'IELTS', '学校'],
  work: ['work', '工作', '打工', 'job', 'salary', '找工作', 'resume'],
  finance: ['finance', '理财', '投资', 'tax', '报税', 'super', '银行', 'ETF'],
  life: ['life', '生活', '超市', '美食', '驾照', '搬家', '宠物', '快递'],
  news: ['news', '新闻', '最新', '消息', '政策'],
};

function detectTopic(query) {
  const q = query.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_MAP)) {
    if (keywords.some(k => q.includes(k))) return topic;
  }
  return 'life';
}

export async function searchForums(args, env) {
  const query = args.query || args.search || '';
  const forum = (args.forum || 'all').toLowerCase();
  const topic = args.topic || detectTopic(query);
  const maxResults = Math.min(args.max_results || 8, 15);

  if (!query) {
    return {
      forums: Object.entries(FORUMS).map(([key, f]) => ({
        key,
        name: f.name,
        url: f.base,
        sections: Object.keys(f.sections || {}),
      })),
      usage: 'Search Chinese Australian forums. Provide a query like "墨尔本租房攻略" or "485签证经验".',
    };
  }

  const results = [];

  // Strategy 1: Cloudflare /markdown — 直接抓取论坛页面
  try {
    const { crawlPage } = await import('./cf-crawl.js');
    const targetForums = forum === 'all'
      ? ['ozchinese', 'oursteps']
      : [forum];

    for (const forumKey of targetForums) {
      const f = FORUMS[forumKey];
      if (!f) continue;

      // Try section-specific page
      const section = f.sections?.[topic];
      const url = section ? `${f.base}${section}` : f.base;

      try {
        const page = await crawlPage(url, env, { maxLength: 2000 });
        if (page && !page.error && page.content) {
          results.push({
            forum: f.name,
            url: url,
            title: page.title || f.name,
            content: page.content.substring(0, 500),
            source: 'direct_crawl',
          });
        }
      } catch {}

      // Try search page if available
      if (f.search && query) {
        try {
          const searchUrl = `${f.search}${encodeURIComponent(query)}`;
          const searchPage = await crawlPage(searchUrl, env, { maxLength: 2000 });
          if (searchPage && !searchPage.error && searchPage.content) {
            results.push({
              forum: f.name,
              url: searchUrl,
              title: `${f.name} 搜索: ${query}`,
              content: searchPage.content.substring(0, 500),
              source: 'forum_search',
            });
          }
        } catch {}
      }
    }
  } catch {}

  // Strategy 2: Tavily — 搜索所有论坛
  const tavilyKey = env?.TAVILY_API_KEY;
  if (tavilyKey && results.length < 3) {
    try {
      const { tavilySearch } = await import('./web-search.js');
      const forumDomains = [
        'ozchinese.com',
        'oursteps.com.au',
        'acnw.com.au',
        'yeeyi.com',
        'auliving.com.au',
      ];

      const data = await tavilySearch(
        `${query} 澳洲`,
        tavilyKey,
        {
          maxResults: maxResults,
          depth: 'basic',
          rawContent: false,
          includeDomains: forumDomains,
        }
      );

      for (const r of (data.results || [])) {
        // Deduplicate
        if (results.some(x => x.url === r.url)) continue;
        const forumName = Object.values(FORUMS).find(f =>
          r.url?.includes(new URL(f.base).hostname)
        )?.name || 'Chinese Forum';

        results.push({
          forum: forumName,
          url: r.url || '',
          title: r.title || '',
          content: (r.content || r.snippet || '').substring(0, 300),
          source: 'tavily_search',
        });
      }
    } catch (err) {
      console.error('Forum Tavily search failed:', err.message);
    }
  }

  // Strategy 3: Tavily general search with site: operator
  if (results.length < 2 && tavilyKey) {
    try {
      const { tavilySearch } = await import('./web-search.js');
      const data = await tavilySearch(
        `site:ozchinese.com OR site:oursteps.com.au ${query}`,
        tavilyKey,
        { maxResults: 5, depth: 'basic' }
      );
      for (const r of (data.results || [])) {
        if (results.some(x => x.url === r.url)) continue;
        results.push({
          forum: 'Chinese Forum',
          url: r.url || '',
          title: r.title || '',
          content: (r.content || r.snippet || '').substring(0, 300),
          source: 'tavily_site_search',
        });
      }
    } catch {}
  }

  return {
    query,
    topic,
    results: results.slice(0, maxResults),
    result_count: Math.min(results.length, maxResults),
    forums_searched: Object.values(FORUMS).map(f => f.name),
    tip: '💡 华人论坛经验分享仅供参考，重要事项请以官方信息为准。',
    official_sources: {
      visa: 'homeaffairs.gov.au',
      tax: 'ato.gov.au',
      rental: 'fairtrading.nsw.gov.au',
      work: 'fairwork.gov.au',
    },
    source: 'Chinese Australian Forums + Tavily',
  };
}

/**
 * Lightweight forum enrichment — 供其他工具附加华人经验
 * 
 * 质量筛选：
 *  1. 垃圾/广告过滤 — 排除微信群、中介广告、代办推广
 *  2. 时效性评分 — 优先近期内容，>2年前的降权
 *  3. 相关性评分 — 内容必须匹配查询话题关键词
 *  4. 内容质量 — 排除过短、纯链接、纯表情的帖子
 *  5. 去重 — 按标题相似度去重
 */

// Spam/ad patterns
const SPAM_PATTERNS = [
  /加微信|加我微信|微信号|加V|扫码|二维码/,
  /代办|代写|代购|代理|包过|包下|免费咨询/,
  /中介推荐|诚信中介|优质中介|专业代理/,
  /广告|推广|赞助|特价优惠|限时(?:折扣|优惠)/,
  /招聘.*兼职.*日结|日赚\d+|躺赚|在家赚钱/,
  /澳洲论文|assignment代写|essay代写/,
  /赌.*博|色.*情|约.*炮/,
  /关注公众号|点击链接|立即注册/,
];

// Low-quality patterns
const LOW_QUALITY_PATTERNS = [
  /^.{0,30}$/, // Too short
  /^(顶|沙发|mark|收藏|感谢分享|谢谢|好的|哈哈|呵呵)+$/i, // Low-effort replies
  /^\[.*\]$/, // Just bracketed text (like [image])
];

// Relevance keywords per topic
const TOPIC_KEYWORDS = {
  visa: ['签证', 'visa', '审理', '等待', '下签', '拒签', '补料', '体检', '移民', 'EOI', '邀请', '获邀', 'grant'],
  rental: ['租房', '租金', '房东', '合同', 'bond', '搬家', '退租', '看房', 'inspection', '中介', '涨租', '合租'],
  study: ['留学', '大学', '课程', '选课', '挂科', '毕业', '学费', '奖学金', 'assignment', 'lecture'],
  work: ['工作', '面试', '简历', '薪水', '老板', '被炒', '报税', '兼职', '打工', '时薪'],
  finance: ['投资', '报税', '退税', '股票', 'super', 'ETF', '贷款', '利率', '理财', '汇率'],
  life: ['生活', '超市', '快递', '搬家', '宠物', '驾照', '看病', 'GP', '二手'],
  insurance: ['保险', 'CTP', 'OSHC', '车险', '理赔', 'claim', '保费'],
};

function isSpam(text) {
  return SPAM_PATTERNS.some(p => p.test(text));
}

function isLowQuality(text) {
  if (!text || text.length < 30) return true;
  if (LOW_QUALITY_PATTERNS.some(p => p.test(text.trim()))) return true;
  // Mostly links or URLs
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 2 && text.length < 100) return true;
  return false;
}

function relevanceScore(text, title, topic) {
  const keywords = TOPIC_KEYWORDS[topic] || TOPIC_KEYWORDS.life;
  const combined = `${title} ${text}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (combined.includes(kw.toLowerCase())) score += 1;
  }
  return Math.min(score, 5); // Cap at 5
}

function recencyScore(text, title) {
  // Try to extract year from content
  const yearMatch = `${title} ${text}`.match(/20(2[3-9]|[3-9]\d)/);
  if (yearMatch) {
    const year = parseInt(`20${yearMatch[1]}`);
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    if (age <= 0) return 3; // Current year
    if (age === 1) return 2;
    if (age === 2) return 1;
    return 0; // >2 years old
  }
  return 1; // Unknown date = neutral
}

function titleSimilar(a, b) {
  if (!a || !b) return false;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  return intersection.length / Math.min(wordsA.size, wordsB.size) > 0.7;
}

export async function forumEnrich(query, topic, env) {
  if (!query || !env?.TAVILY_API_KEY) return [];

  try {
    const { tavilySearch } = await import('./web-search.js');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const forumDomains = [
      'ozchinese.com',
      'oursteps.com.au',
      'acnw.com.au',
      'yeeyi.com',
    ];

    // Fetch more results to allow filtering
    const data = await tavilySearch(
      `${query} 澳洲 经验`,
      env.TAVILY_API_KEY,
      {
        maxResults: 8,
        depth: 'basic',
        rawContent: false,
        includeDomains: forumDomains,
      }
    );

    clearTimeout(timeout);

    const candidates = (data.results || []).map(r => {
      const content = r.content || r.snippet || '';
      const title = r.title || '';
      const forumName = Object.values(FORUMS).find(f =>
        r.url?.includes(new URL(f.base).hostname)
      )?.name || 'Chinese Forum';

      return {
        title: title.substring(0, 80),
        url: r.url || '',
        snippet: content.substring(0, 200),
        forum: forumName,
        _content: content,
        _relevance: relevanceScore(content, title, topic),
        _recency: recencyScore(content, title),
        _isSpam: isSpam(`${title} ${content}`),
        _isLowQuality: isLowQuality(content),
      };
    });

    // Filter and score
    const filtered = candidates
      .filter(r => !r._isSpam)
      .filter(r => !r._isLowQuality)
      .filter(r => r._relevance >= 1)  // At least 1 keyword match
      .filter(r => r.snippet.length >= 30)
      .sort((a, b) => {
        // Score = relevance * 2 + recency
        const scoreA = a._relevance * 2 + a._recency;
        const scoreB = b._relevance * 2 + b._recency;
        return scoreB - scoreA;
      });

    // Deduplicate by title similarity
    const deduped = [];
    for (const item of filtered) {
      if (!deduped.some(d => titleSimilar(d.title, item.title))) {
        deduped.push(item);
      }
      if (deduped.length >= 3) break;
    }

    // Clean up internal scoring fields
    return deduped.map(({ _content, _relevance, _recency, _isSpam, _isLowQuality, ...clean }) => clean);
  } catch {
    return [];
  }
}

