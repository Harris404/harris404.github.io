/**
 * Other States Transport Fallback (WA, TAS, NT, ACT)
 * No free real-time APIs available — uses Tavily web search
 * 
 * - WA: Transperth (only static GTFS, no real-time API)
 * - TAS: Metro Tasmania (limited GTFS)
 * - NT: No public transport API
 * - ACT: Transport Canberra (limited GTFS on data.act.gov.au)
 */

const STATE_TRANSPORT = {
  WA: {
    name: 'Transperth',
    emoji: '🚆',
    card: 'SmartRider',
    journey_planner: 'https://www.transperth.wa.gov.au/journey-planner',
    timetable: 'https://www.transperth.wa.gov.au/timetables',
    disruptions: 'https://www.transperth.wa.gov.au/Service-Updates',
    live_status: 'https://www.transperth.wa.gov.au/Service-Updates',
    domains: ['transperth.wa.gov.au'],
    tips: [
      'Perth 使用 SmartRider 卡乘坐公共交通',
      'Perth CBD Free Transit Zone (FTZ) 内乘坐巴士和火车免费',
      'Transperth 覆盖火车、巴士和渡轮',
      '官网有 LIVE TRAIN STATUS 页面可查看实时列车状态',
      '时刻表查询: transperth.wa.gov.au/timetables',
      '客服热线: 13 62 13',
    ],
  },
  TAS: {
    name: 'Metro Tasmania',
    emoji: '🚌',
    card: 'Greencard',
    journey_planner: 'https://www.metrotas.com.au/',
    timetable: 'https://www.metrotas.com.au/timetables/',
    disruptions: 'https://www.metrotas.com.au/alerts/',
    domains: ['metrotas.com.au'],
    tips: [
      'Hobart 使用 Greencard 乘坐巴士',
      'Metro Tasmania 主要运营巴士服务（无火车/电车）',
      '官网 /alerts/ 页面有最新服务中断信息',
      '官网: metrotas.com.au',
      '客服热线: 13 22 01',
    ],
  },
  NT: {
    name: 'NT Public Transport',
    emoji: '🚌',
    card: 'Free (免费)',
    journey_planner: 'https://nt.gov.au/driving/public-transport-cycling',
    timetable: 'https://nt.gov.au/driving/public-transport-cycling/public-buses/darwin-and-palmerston-bus-timetables-and-maps',
    disruptions: 'https://nt.gov.au/driving/public-transport-cycling/public-buses/alerts-and-route-changes',
    domains: ['nt.gov.au'],
    tips: [
      '🆓 NT 所有公交巴士目前免费乘坐（2025年7月起）！',
      'Darwin/Alice Springs 有 NT Bus Tracker App 可实时追踪巴士',
      '官网有路线变更和中断提醒页面',
      '大部分景点之间距离较远，建议租车',
    ],
  },
  ACT: {
    name: 'Transport Canberra',
    emoji: '🚊',
    card: 'MyWay+',
    journey_planner: 'https://www.transport.act.gov.au/',
    timetable: 'https://www.transport.act.gov.au/getting-around/timetables',
    disruptions: 'https://www.transport.act.gov.au/news/service-alerts-and-updates',
    domains: ['transport.act.gov.au', 'act.gov.au'],
    tips: [
      'Canberra 使用 MyWay+ 交通卡',
      '有轻轨 (Light Rail) 和巴士服务',
      '轻轨连接 Gungahlin 到 City，很方便',
      '官网有详细的 Service Alerts 页面（按区域分类）',
      '客服热线: 13 17 10',
    ],
  },
};

export async function getOtherStateDepartures(args, env) {
  const state = (args.state || '').toUpperCase();
  const stateInfo = STATE_TRANSPORT[state];
  const stopName = args.stop_name || args.station || args.stop || '';

  if (!stateInfo) {
    return { error: `不支持的州: ${state}`, supported: Object.keys(STATE_TRANSPORT) };
  }

  return await searchTransport(stateInfo, state, stopName, 'departures', env);
}

export async function getOtherStateAlerts(args, env) {
  const state = (args.state || '').toUpperCase();
  const stateInfo = STATE_TRANSPORT[state];

  if (!stateInfo) {
    return { error: `不支持的州: ${state}`, supported: Object.keys(STATE_TRANSPORT) };
  }

  return await searchTransport(stateInfo, state, '', 'alerts', env);
}

async function searchTransport(stateInfo, stateCode, stopName, type, env) {
  // 1. 优先使用 Cloudflare /crawl 直接抓取官网（第一手数据）
  try {
    const { crawlPage } = await import('./cf-crawl.js');
    const targetUrl = type === 'alerts' ? stateInfo.disruptions : stateInfo.journey_planner;
    const page = await crawlPage(targetUrl, env, { maxLength: 2000 });

    if (page && !page.error && page.content) {
      return {
        state: stateCode,
        operator: stateInfo.name,
        emoji: stateInfo.emoji,
        type,
        stop: stopName || 'All',
        page_title: page.title || stateInfo.name,
        content: page.content,
        url: page.url,
        journey_planner: stateInfo.journey_planner,
        disruptions: stateInfo.disruptions,
        card: stateInfo.card,
        source: `${stateInfo.name} 官网 (Cloudflare Browser Rendering)`,
        tips: stateInfo.tips,
      };
    }
  } catch {}

  // 2. 回退到 Tavily 搜索
  const tavilyKey = env?.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const { tavilySearch } = await import('./web-search.js');
      const query = type === 'alerts'
        ? `${stateInfo.name} ${stateCode} public transport disruptions delays service updates today`
        : `${stateInfo.name} ${stopName || stateCode} bus train timetable schedule departures`;
      
      const data = await tavilySearch(query, tavilyKey, {
        maxResults: 5,
        includeDomains: stateInfo.domains,
      });

      const results = (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: (r.snippet || '').substring(0, 200),
      })).slice(0, 5);

      return {
        state: stateCode,
        operator: stateInfo.name,
        emoji: stateInfo.emoji,
        type,
        stop: stopName || 'All',
        results_count: results.length,
        results,
        journey_planner: stateInfo.journey_planner,
        disruptions: stateInfo.disruptions,
        card: stateInfo.card,
        source: `${stateInfo.name} via web search`,
        tips: stateInfo.tips,
      };
    } catch {}
  }

  // 3. 静态信息兜底
  return {
    state: stateCode,
    operator: stateInfo.name,
    emoji: stateInfo.emoji,
    message: `${stateCode} 暂无实时交通 API，请直接访问官网查看。`,
    journey_planner: stateInfo.journey_planner,
    disruptions: stateInfo.disruptions,
    card: `${stateCode} 使用 ${stateInfo.card} 交通卡`,
    tips: stateInfo.tips,
  };
}
