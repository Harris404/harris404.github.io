/**
 * BOM Warnings API — Australian severe weather warnings
 * Uses the unofficial BOM API: https://api.weather.bom.gov.au/v1/
 * Free, no API key required
 */

const BOM_API = 'https://api.weather.bom.gov.au/v1';

// State warning endpoint mapping
const STATE_CODES = {
  nsw: { code: 'NSW', name: 'New South Wales' },
  vic: { code: 'VIC', name: 'Victoria' },
  qld: { code: 'QLD', name: 'Queensland' },
  sa: { code: 'SA', name: 'South Australia' },
  wa: { code: 'WA', name: 'Western Australia' },
  tas: { code: 'TAS', name: 'Tasmania' },
  nt: { code: 'NT', name: 'Northern Territory' },
  act: { code: 'ACT', name: 'Australian Capital Territory' },
};

const WARNING_TYPES = {
  'severe_thunderstorm': { emoji: '⛈️', cn: '强雷暴', severity: 'severe' },
  'bushfire': { emoji: '🔥', cn: '丛林火灾', severity: 'extreme' },
  'flood': { emoji: '🌊', cn: '洪水', severity: 'severe' },
  'cyclone': { emoji: '🌀', cn: '气旋/台风', severity: 'extreme' },
  'heat': { emoji: '🌡️', cn: '极端高温', severity: 'severe' },
  'wind': { emoji: '💨', cn: '大风', severity: 'moderate' },
  'storm': { emoji: '🌪️', cn: '暴风', severity: 'severe' },
  'fire_weather': { emoji: '🔥', cn: '火灾天气', severity: 'severe' },
  'coastal': { emoji: '🌊', cn: '海岸预警', severity: 'moderate' },
  'frost': { emoji: '❄️', cn: '霜冻', severity: 'moderate' },
  'marine': { emoji: '⚓', cn: '海洋预警', severity: 'moderate' },
};

export async function getBOMWarnings(args, env) {
  const state = (args.state || args.location || 'nsw').toLowerCase().replace(/\s/g, '');
  const stateInfo = STATE_CODES[state];
  
  if (!stateInfo) {
    return {
      error: `未知州/领地: "${state}"`,
      available_states: Object.entries(STATE_CODES).map(([k, v]) => `${k} → ${v.name}`),
      tip: '请提供州缩写，如 NSW, VIC, QLD',
    };
  }

  try {
    // Fetch warnings from BOM API
    const warnings = await fetchBOMWarnings(stateInfo.code);
    
    if (warnings.length === 0) {
      return {
        state: stateInfo.name,
        state_code: stateInfo.code,
        active_warnings: 0,
        message: `✅ ${stateInfo.name} 当前没有活跃的天气预警。`,
        source: 'Bureau of Meteorology (BOM)',
        url: `http://www.bom.gov.au/products/IDN65500.shtml`,
        tip: '可以随时查看 BOM 官网获取最新预警信息。',
      };
    }

    return {
      state: stateInfo.name,
      state_code: stateInfo.code,
      active_warnings: warnings.length,
      warnings: warnings.slice(0, 10),
      source: 'Bureau of Meteorology (BOM)',
      url: `http://www.bom.gov.au/`,
      safety_tips: {
        bushfire: '如在火灾高风险区域，请制定撤离计划并关注CFA/RFS预警。',
        flood: '远离洪水，切勿步行或驾车通过积水路段。',
        severe_storm: '留在安全的建筑物内，远离窗户。',
        heat: '多喝水，避免正午至下午3点户外活动。',
        emergency: '紧急情况拨打 000，洪水/风暴灾害拨打 SES 132 500。',
      },
    };
  } catch (err) {
    // Fallback: try Tavily search for current warnings
    return await fallbackWarnings(stateInfo, args, env);
  }
}

async function fetchBOMWarnings(stateCode) {
  // Try BOM API warnings endpoint  
  const url = `${BOM_API}/warnings?state=${stateCode}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'AozhiAI/1.0',
    },
  });

  if (!res.ok) {
    // Try alternative BOM FTP/web source  
    return await fetchBOMWarningsAlt(stateCode);
  }

  const data = await res.json();
  const warnings = (data.data || data.warnings || data || []);
  
  if (!Array.isArray(warnings)) return [];

  return warnings.map(w => {
    const type = detectWarningType(w.title || w.type || '');
    return {
      title: w.title || w.name || '',
      type: type?.cn || w.type || 'Weather Warning',
      emoji: type?.emoji || '⚠️',
      severity: type?.severity || 'moderate',
      description: (w.description || w.short_text || w.message || '').substring(0, 300),
      issued: w.issued || w.issue_time || '',
      expiry: w.expiry || w.expiry_time || '',
      areas: w.areas || w.affected_areas || [],
    };
  });
}

async function fetchBOMWarningsAlt(stateCode) {
  // Try BOM's JSON warning summary
  const stateMap = {
    NSW: 'IDN', VIC: 'IDV', QLD: 'IDQ', SA: 'IDS',
    WA: 'IDW', TAS: 'IDT', NT: 'IDD', ACT: 'IDN',
  };
  const prefix = stateMap[stateCode] || 'IDN';
  
  // Try BOM warnings page via Tavily or direct fetch
  const url = `http://www.bom.gov.au/fwo/${prefix}65500.json`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // Parse BOM JSON structure
      const warnings = [];
      if (data.observations?.data) {
        // warnings embedded in observations
      }
      return warnings;
    }
  } catch {}
  
  return [];
}

function detectWarningType(title) {
  const lower = (title || '').toLowerCase();
  for (const [key, info] of Object.entries(WARNING_TYPES)) {
    if (lower.includes(key.replace('_', ' ')) || lower.includes(key)) {
      return info;
    }
  }
  return null;
}

async function fallbackWarnings(stateInfo, args, env) {
  // 1. 优先: Cloudflare /markdown 直接抓取 BOM 官网
  try {
    const { crawlPage } = await import('./cf-crawl.js');
    const bomUrl = `http://www.bom.gov.au/products/${stateInfo.code === 'ACT' ? 'IDN' : {'NSW':'IDN','VIC':'IDV','QLD':'IDQ','SA':'IDS','WA':'IDW','TAS':'IDT','NT':'IDD'}[stateInfo.code] || 'IDN'}65500.shtml`;
    const page = await crawlPage(bomUrl, env, { maxLength: 2000 });
    if (page && !page.error && page.content) {
      return {
        state: stateInfo.name,
        state_code: stateInfo.code,
        source: 'BOM 官网 (Cloudflare Browser Rendering)',
        content: page.content,
        url: bomUrl,
        tip: '以上为 BOM 官网实时预警内容。',
        emergency: '紧急情况拨打 000，洪水/风暴灾害拨打 SES 132 500。',
      };
    }
  } catch {}

  // 2. 回退: Tavily 搜索
  const tavilyKey = env?.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const { tavilySearch } = await import('./web-search.js');
      const data = await tavilySearch(
        `BOM weather warning ${stateInfo.name} current active 2026`,
        tavilyKey,
        { maxResults: 5, includeDomains: ['bom.gov.au', 'abc.net.au', 'sbs.com.au'] }
      );
      
      const reports = (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: (r.snippet || '').substring(0, 200),
      }));

      return {
        state: stateInfo.name,
        state_code: stateInfo.code,
        source: 'BOM via web search',
        reports,
        message: reports.length > 0 
          ? `找到 ${reports.length} 条相关预警信息`
          : `未找到 ${stateInfo.name} 的活跃预警`,
        manual_check: `http://www.bom.gov.au/`,
      };
    } catch {}
  }

  return {
    state: stateInfo.name,
    state_code: stateInfo.code,
    available: false,
    message: `暂时无法获取 ${stateInfo.name} 的天气预警。`,
    manual_check: `http://www.bom.gov.au/`,
    emergency: '紧急情况拨打 000',
  };
}
