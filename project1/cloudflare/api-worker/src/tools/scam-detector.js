/**
 * Anti-Scam Identifier — 反诈骗识别器
 * 识别澳洲常见诈骗短信/邮件/电话/链接
 * 数据来源：Scamwatch.gov.au 模式库 + Tavily 实时搜索
 */

import { tavilySearch } from './web-search.js';

// ── 内置诈骗模式知识库 ──────────────────────────────────────────────

const SCAM_PATTERNS = {
  ato_tax: {
    keywords: ['ato', 'tax refund', 'tax return', 'tax office', 'tax debt', 'tax file number', 'tfn'],
    description: '🚨 ATO 税务诈骗',
    detail: '澳洲税务局(ATO)绝不会通过短信/邮件要求你提供银行信息或用礼品卡缴税。真正的ATO通知只会通过myGov。',
    risk: 'high',
    action: [
      '不要点击任何链接',
      '不要提供个人信息',
      '直接拨打ATO官方电话 13 28 61 核实',
      '向Scamwatch举报: scamwatch.gov.au',
    ],
  },
  toll_road: {
    keywords: ['toll', 'linkt', 'etoll', 'e-toll', 'road fee', 'unpaid toll', 'overdue toll'],
    description: '🚨 过路费/Toll 诈骗',
    detail: '假冒Linkt/E-Toll发送"未缴费"短信，链接指向钓鱼网站。真正的通知会通过你注册的邮箱。',
    risk: 'high',
    action: [
      '不要点击短信中的链接',
      '直接登录 Linkt/E-Toll 官网查看欠款',
      '向Scamwatch举报',
    ],
  },
  delivery: {
    keywords: ['auspost', 'australia post', 'package', 'parcel', 'delivery', 'tracking', 'missed delivery', 'redelivery fee'],
    description: '🚨 快递包裹诈骗',
    detail: '假冒Australia Post的"包裹需缴关税"或"重新投递费"。Australia Post从不通过短信要求付款。',
    risk: 'high',
    action: [
      '不要点击链接',
      '通过 auspost.com.au 官网追踪包裹',
      '拨打 Australia Post 13 13 18',
    ],
  },
  immigration: {
    keywords: ['visa', 'immigration', 'home affairs', 'department', 'cancelled', 'deport', 'overstay', 'immi'],
    description: '🚨 移民签证诈骗',
    detail: '冒充Home Affairs威胁签证取消/遣返。真正的移民通知通过VEVO或ImmiAccount。诈骗者可能用中文打电话冒充"大使馆"。',
    risk: 'critical',
    action: [
      '挂断电话，不要提供护照号等信息',
      '通过VEVO在线查签证状态: immi.homeaffairs.gov.au/visas/already-have-a-visa/check-visa-details',
      '中国驻澳大使馆绝不会电话索要钱财',
      '举报: scamwatch.gov.au 或 cyber.gov.au',
    ],
  },
  embassy: {
    keywords: ['大使馆', '领事馆', 'embassy', 'consulate', '公安', '公安局', '国际刑警', '通缉', '涉嫌犯罪', '洗钱'],
    description: '🚨 假冒使馆/公安诈骗 (华人第一大骗局)',
    detail: '这是专门针对华人的高频骗局！骗子用中文打电话自称"中国大使馆"或"上海公安局"，声称你涉嫌犯罪/洗钱，要求转账"保证金"。100%是骗局！',
    risk: 'critical',
    action: [
      '立即挂断！中国使馆/公安绝不会电话要钱',
      '不要转账、不要提供银行信息',
      '向澳洲警察报案: 131 444 (非紧急) 或 000 (紧急)',
      '中国驻澳大使馆领事保护: 02-6228 3999',
      '已经转账？立即联系银行冻结 + 报警',
    ],
  },
  banking: {
    keywords: ['bank', 'westpac', 'commbank', 'commonwealth', 'anz', 'nab', 'account', 'suspicious activity', 'blocked', 'verify', '银行'],
    description: '🚨 银行钓鱼诈骗',
    detail: '假冒银行发"账户异常活动"短信/邮件。真正的银行绝不会通过短信要求你提供密码。',
    risk: 'high',
    action: [
      '不要点击链接',
      '直接拨打银行卡背面的官方电话核实',
      'CommBank: 13 22 21, ANZ: 13 13 14, Westpac: 13 20 32',
    ],
  },
  rental: {
    keywords: ['rent', 'rental', 'bond', 'lease', '租房', '押金', 'deposit', 'inspection', 'flatmate'],
    description: '⚠️ 租房诈骗',
    detail: '假房东在Facebook/Gumtree发低价假房源，要求先付押金"锁定"。或冒充现有租客收取"接手费"。',
    risk: 'high',
    action: [
      '未看房前绝不打钱',
      '正规Bond必须交给State Bond Authority，不是房东个人',
      '使用正规中介(Ray White, LJ Hooker等)的房源',
      '核实房产地址是否真实存在',
    ],
  },
  job: {
    keywords: ['job', 'work from home', 'earn money', '代购', '兼职', 'part time', '刷单', '佣金', 'commission'],
    description: '⚠️ 工作/兼职诈骗',
    detail: '"高薪居家兼职"、"代购刷单"骗局在华人群中极为常见。先让你付"入会费"或"保证金"，承诺高额回报。',
    risk: 'high',
    action: [
      '天上不会掉馅饼，高回报=高风险',
      '正规工作不会要求预付费用',
      '查雇主是否注册: abr.business.gov.au',
      'Fair Work最低工资: $24.10/小时 (2025)',
      '求职用正规网站: Seek, Indeed, LinkedIn',
    ],
  },
  crypto_investment: {
    keywords: ['bitcoin', 'crypto', 'invest', 'trading', '投资', '理财', 'forex', 'guaranteed return', '保本', '高收益'],
    description: '🚨 投资/加密货币诈骗',
    detail: '"保本高收益"100%是骗局。杀猪盘(romance + investment scam)在澳洲华人中损失惨重。',
    risk: 'critical',
    action: [
      '任何"保证回报"的投资都是骗局',
      '查投资平台是否有ASIC牌照: moneysmart.gov.au/check-and-report-scams',
      '不要通过社交媒体或约会App接受投资建议',
      'ASIC举报: asic.gov.au',
    ],
  },
};

// ── 主函数 ──────────────────────────────────────────────────────────

export async function analyzeScam(args, env) {
  const text = (args.text || args.message || args.query || '').toLowerCase();
  const url = (args.url || '').toLowerCase();
  const input = `${text} ${url}`.trim();

  if (!input) {
    return {
      error: 'Please provide the suspicious text/message/URL to analyze',
      usage: '请提供可疑的短信/邮件/链接内容，我帮你判断是否是诈骗',
    };
  }

  // Step 1: Pattern matching against known scam types
  const matches = [];
  for (const [key, pattern] of Object.entries(SCAM_PATTERNS)) {
    const score = pattern.keywords.filter(kw => input.includes(kw)).length;
    if (score > 0) {
      matches.push({ ...pattern, type: key, matchScore: score });
    }
  }

  // Sort by match score (best match first)
  matches.sort((a, b) => b.matchScore - a.matchScore);

  // Step 2: URL analysis
  let urlRisk = null;
  if (url) {
    urlRisk = analyzeURL(url);
  }

  // Step 3: Crawl Scamwatch official page first, then Tavily
  let recentReports = [];
  if (input.length > 10) {
    // 3a: Try Cloudflare /markdown on Scamwatch
    try {
      const { crawlPage } = await import('./cf-crawl.js');
      const page = await crawlPage('https://www.scamwatch.gov.au/news-alerts', env, { maxLength: 1500 });
      if (page && !page.error && page.content) {
        recentReports.push({
          title: 'Scamwatch 最新警报',
          url: 'https://www.scamwatch.gov.au/news-alerts',
          snippet: page.content.substring(0, 300),
          source: 'Scamwatch 官网',
        });
      }
    } catch {}

    // 3b: Tavily search for specific scam
    const tavilyKey = env?.TAVILY_API_KEY;
    if (tavilyKey) {
      try {
        const currentYear = new Date().getFullYear();
        const searchQuery = `"${text.substring(0, 60)}" scam Australia ${currentYear - 1} ${currentYear}`;
        const data = await tavilySearch(searchQuery, tavilyKey, {
          maxResults: 3,
          depth: 'basic',
          rawContent: false,
          answer: false,
          includeDomains: ['scamwatch.gov.au', 'cyber.gov.au', 'accc.gov.au', 'abc.net.au'],
        });
        recentReports.push(...(data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: (r.snippet || '').substring(0, 200),
        })).slice(0, 3));
      } catch {}
    }
  }

  // Step 3b: Scamwatch RSS — fetch latest official alerts
  let scamwatchAlerts = [];
  try {
    const rssRes = await fetch('https://www.scamwatch.gov.au/rss.xml', {
      headers: { 'User-Agent': 'AozhiAI-ScamDetector/1.0' },
    });
    if (rssRes.ok) {
      const rssText = await rssRes.text();
      // Simple XML parsing for RSS items
      const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
      scamwatchAlerts = items.slice(0, 5).map(item => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
          || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
          || item.match(/<description>(.*?)<\/description>/)?.[1] || '';
        return { title, link, date: pubDate, summary: desc.replace(/<[^>]+>/g, '').substring(0, 150) };
      }).filter(a => a.title);
    }
  } catch {} // Non-critical

  // Step 4: Overall risk assessment
  let overallRisk = 'low';
  let verdict = '✅ 暂未识别出明确的诈骗特征';

  if (matches.length > 0) {
    const topMatch = matches[0];
    overallRisk = topMatch.risk;
    verdict = topMatch.description;
  }

  if (urlRisk?.suspicious) {
    overallRisk = 'high';
  }

  // Common red flags
  const redFlags = [];
  if (input.includes('click') || input.includes('点击') || input.includes('链接')) redFlags.push('包含要求点击链接');
  if (input.includes('urgent') || input.includes('紧急') || input.includes('immediately')) redFlags.push('制造紧迫感');
  if (input.includes('verify') || input.includes('验证') || input.includes('confirm')) redFlags.push('要求验证个人信息');
  if (input.includes('gift card') || input.includes('礼品卡') || input.includes('itunes')) redFlags.push('要求礼品卡支付（100%诈骗）');
  if (input.includes('transfer') || input.includes('转账') || input.includes('wire')) redFlags.push('要求转账');
  if (input.includes('password') || input.includes('密码') || input.includes('pin')) redFlags.push('索要密码/PIN');

  if (redFlags.length >= 2) overallRisk = 'high';

  return {
    verdict,
    risk_level: overallRisk,
    risk_emoji: overallRisk === 'critical' ? '🔴' : overallRisk === 'high' ? '🟠' : overallRisk === 'medium' ? '🟡' : '🟢',
    red_flags: redFlags,
    matched_patterns: matches.slice(0, 3).map(m => ({
      type: m.type,
      description: m.description,
      detail: m.detail,
      actions: m.action,
    })),
    url_analysis: urlRisk,
    recent_reports: recentReports,
    scamwatch_latest: scamwatchAlerts.length > 0 ? scamwatchAlerts : undefined,
    general_advice: {
      golden_rule: '不确定？直接挂断/关闭，通过官方渠道核实。',
      report_to: [
        'Scamwatch (ACCC): scamwatch.gov.au 或 1300 795 995',
        '网络犯罪: cyber.gov.au',
        '澳洲警察 (非紧急): 131 444',
        '紧急求助: 000',
        '银行欺诈部门（立即冻结）',
      ],
      recovery: '如已泄露信息：1) 立即更改密码 2) 联系银行冻结账户 3) 向IDCARE(1800 595 160)报告身份盗窃',
    },
    source: 'Scamwatch.gov.au patterns + RSS alerts + Tavily real-time search',
  };
}

// ── URL 分析 ──────────────────────────────────────────────────────────

function analyzeURL(url) {
  const suspicious = [];

  // Check for URL shorteners
  const shorteners = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly'];
  if (shorteners.some(s => url.includes(s))) suspicious.push('使用短链接服务（隐藏真实地址）');

  // Check for misspelled domains
  const fakePatterns = [
    { real: 'ato.gov.au', fakes: ['at0.gov', 'ato-refund', 'ato.com', 'myato.'] },
    { real: 'auspost.com.au', fakes: ['auspost-delivery', 'australiapost.', 'aus-post.'] },
    { real: 'linkt.com.au', fakes: ['linkt-pay', 'linkt.com/', 'mylinkt.'] },
    { real: 'commbank.com.au', fakes: ['combank', 'commbank-secure', 'cba-verify'] },
    { real: 'immi.homeaffairs.gov.au', fakes: ['immigration-au', 'homeaffairs.com', 'visa-au.'] },
  ];

  for (const p of fakePatterns) {
    if (p.fakes.some(f => url.includes(f)) && !url.includes(p.real)) {
      suspicious.push(`疑似仿冒 ${p.real} 的钓鱼网站`);
    }
  }

  // Non-.gov.au or non-.com.au domains claiming to be official
  if ((url.includes('gov') || url.includes('official')) && !url.includes('.gov.au')) {
    suspicious.push('声称官方但未使用 .gov.au 域名');
  }

  // Suspicious TLDs
  const suspiciousTLDs = ['.xyz', '.top', '.buzz', '.click', '.icu', '.tk', '.ml', '.ga'];
  if (suspiciousTLDs.some(tld => url.includes(tld))) {
    suspicious.push('使用高风险域名后缀');
  }

  return {
    url,
    suspicious: suspicious.length > 0,
    warnings: suspicious,
    tip: suspicious.length > 0
      ? '⚠️ 该链接存在可疑特征，建议不要点击。'
      : '该链接未检测到明显的可疑特征，但仍建议谨慎。',
  };
}
