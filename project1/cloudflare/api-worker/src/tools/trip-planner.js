/**
 * Trip Planner — 行程规划器
 * 结合天气、活动、景点生成多日行程建议
 * 数据来源：Tavily 搜索旅游攻略 + 内置热门路线
 */

import { tavilySearch } from './web-search.js';

// ── 内置热门路线 ──────────────────────────────────────────────────

const POPULAR_ITINERARIES = {
  sydney: {
    '1day': {
      title: '悉尼一日精华游',
      stops: [
        { time: '09:00', place: 'Sydney Opera House', activity: '打卡歌剧院外观，沿海步行', tip: '从Circular Quay渡轮码头方向看最佳' },
        { time: '10:30', place: 'The Rocks', activity: '历史街区逛集市（周末有Rocks Market）', tip: '有不少华人纪念品店' },
        { time: '12:00', place: 'Darling Harbour', activity: '午餐 + SEA LIFE Aquarium', tip: '推荐去Yum Cha吃中式' },
        { time: '14:30', place: 'Bondi Beach', activity: '海滩散步', tip: '公交333/380从市区直达' },
        { time: '16:00', place: 'Bondi to Coogee Walk', activity: '沿海步行道（约1.5小时）', tip: '澳洲最美城市步道之一' },
        { time: '18:30', place: 'Chinatown (Haymarket)', activity: '晚餐', tip: '推荐 Dixon Street 或 Eating World' },
      ],
    },
    '3day': {
      title: '悉尼三日深度游',
      days: [
        { day: 1, theme: '市区精华', highlights: ['Opera House', 'Harbour Bridge', 'The Rocks', 'Royal Botanic Garden', 'Mrs Macquaries Chair', 'Darling Harbour'] },
        { day: 2, theme: '海滩 + 东区', highlights: ['Bondi Beach', 'Bondi to Coogee Walk', 'Bronte Beach', 'Coogee Beach', 'Paddington 周六集市'] },
        { day: 3, theme: '西部 + 蓝山', highlights: ['Blue Mountains (火车2小时)', 'Three Sisters', 'Echo Point', 'Scenic World缆车', 'Leura小镇'] },
      ],
      transport_tip: 'Opal卡每日消费上限$17.80，周日上限$2.80（最划算的出行日！）',
    },
  },
  melbourne: {
    '1day': {
      title: '墨尔本一日精华游',
      stops: [
        { time: '09:00', place: 'Hosier Lane', activity: '涂鸦巷拍照', tip: '免费, 随时去' },
        { time: '10:00', place: 'Federation Square', activity: '文化广场 + NGV', tip: 'NGV免费参观' },
        { time: '11:30', place: 'Queen Victoria Market', activity: '逛市场/吃小食', tip: '周二/周四/周五/六/日开放' },
        { time: '13:00', place: 'City Circle Tram', activity: '免费环城电车', tip: 'Free Tram Zone内不用刷卡' },
        { time: '14:30', place: 'Royal Botanic Gardens', activity: '皇家植物园散步', tip: '免费入场' },
        { time: '16:30', place: 'Flinders Street Station', activity: '标志性火车站外观', tip: '墨尔本地标' },
        { time: '18:00', place: 'Chinatown (Little Bourke St)', activity: '晚餐', tip: '澳洲最古老的唐人街' },
      ],
    },
    '3day': {
      title: '墨尔本三日深度游',
      days: [
        { day: 1, theme: '市区文化', highlights: ['Hosier Lane', 'Federation Square', 'NGV', 'Queen Victoria Market', 'Chinatown', 'Rooftop Bar'] },
        { day: 2, theme: '大洋路一日游', highlights: ['Great Ocean Road', 'Twelve Apostles', 'Apollo Bay', 'Loch Ard Gorge'], note: '建议参团或租车，来回约6小时' },
        { day: 3, theme: '周边探索', highlights: ['Brighton Bathing Boxes', 'St Kilda Beach', 'Luna Park', 'Prahran Market', 'Chapel Street 购物'] },
      ],
      transport_tip: 'Myki卡每日上限$10.60（全日票价），周末更便宜$7.20。Free Tram Zone在CBD区域免费。',
    },
  },
  gold_coast: {
    '3day': {
      title: '黄金海岸三日游',
      days: [
        { day: 1, theme: '主题乐园', highlights: ['Warner Bros Movie World 或 Dreamworld', '商场Shopping'] },
        { day: 2, theme: '海滩 + 冲浪', highlights: ['Surfers Paradise', 'Burleigh Heads', 'Currumbin Wildlife Sanctuary（抱考拉）'] },
        { day: 3, theme: '自然探索', highlights: ['Springbrook National Park', 'Natural Bridge', 'SkyPoint 观景台'] },
      ],
    },
  },
};

// ── 主函数 ──────────────────────────────────────────────────────────

export async function planTrip(args, env) {
  const city = (args.city || args.destination || 'sydney').toLowerCase();
  const days = Number(args.days) || 1;
  const interests = args.interests || ''; // 美食、自然、文化、购物
  const budget = args.budget || ''; // budget, mid, luxury
  const query = args.query || '';

  // Get built-in itinerary
  const cityData = POPULAR_ITINERARIES[city] || POPULAR_ITINERARIES.sydney;
  let itinerary = null;

  if (days <= 1 && cityData['1day']) {
    itinerary = cityData['1day'];
  } else if (days <= 3 && cityData['3day']) {
    itinerary = cityData['3day'];
  } else if (cityData['3day']) {
    itinerary = cityData['3day'];
  }

  // Tavily search for specific interests
  let customSuggestions = [];
  const tavilyKey = env?.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const searchQ = query || `${city} ${days}天旅游攻略 ${interests} 华人推荐 2025 2026`;
      const data = await tavilySearch(searchQ, tavilyKey, {
        maxResults: 5,
        depth: 'basic',
        rawContent: false,
        answer: false,
        includeDomains: ['tripadvisor.com', 'timeout.com', 'lonelyplanet.com', 'visitnsw.com', 'visitvictoria.com'],
      });
      customSuggestions = (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: (r.snippet || '').substring(0, 200),
      })).slice(0, 4);
    } catch {}
  }

  return {
    city: city.charAt(0).toUpperCase() + city.slice(1),
    days,
    itinerary,
    custom_suggestions: customSuggestions,
    practical_tips: {
      transport: city === 'sydney' ? 'Opal卡（周日$2.80封顶！）' : city === 'melbourne' ? 'Myki卡（CBD免费电车区）' : 'Go Card 或租车',
      sim_card: '建议买Optus Tourist SIM $40（机场有卖）',
      weather: `出发前查天气，澳洲紫外线很强，SPF 50+ 防晒霜必备`,
      safety: '澳洲很安全，但注意：不要在海边无人区游泳（有离岸流），蛇/蜘蛛远离即可',
      emergency: '紧急电话 000 | 非紧急警察 131 444 | 中国大使馆领事保护 02-6228 3999',
    },
    chinese_food_tip: {
      sydney: 'Burwood (小上海)、Hurstville (港式)、Chatswood (综合)、Eastwood (北方)',
      melbourne: 'Box Hill (华人最密集)、Glen Waverley、Clayton、CBD Chinatown',
      brisbane: 'Sunnybank (华人区第一)、CBD Chinatown',
      gold_coast: 'Surfers Paradise 有几家中餐馆',
    },
    available_cities: Object.keys(POPULAR_ITINERARIES),
    source: 'Built-in itineraries + Tavily travel search',
  };
}
