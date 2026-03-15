/**
 * School Search — 中小学搜索工具 (ACARA 数据驱动)
 * 搜索澳洲 9,755 所中小学：ICSEA、招生人数、学区查询
 * 数据来源：ACARA MySchool 2025 (年度更新) + 内置精英学校信息
 */

import { tavilySearch } from './web-search.js';

// ── 内置：精英学校 & 学校类型参考 ──────────────────────────────────

const SCHOOL_TYPES = {
  Government: { cn: '公立学校', fee: '免学费（PR/公民）', note: '按学区划分' },
  Catholic: { cn: '天主教学校', fee: '$2,000-$8,000/年', note: '不要求信教' },
  Independent: { cn: '私立学校', fee: '$15,000-$45,000/年', note: '需提前申请' },
};

const SELECTIVE_SCHOOLS = {
  NSW: {
    test: 'NSW Selective High School Placement test（每年3月），Year 7 入学',
    schools: ['James Ruse Agricultural High School', 'North Sydney Boys High School', 'North Sydney Girls High School',
              'Sydney Boys High School', 'Sydney Girls High School', 'Baulkham Hills High School',
              'Hornsby Girls High School', 'Normanhurst Boys High School', 'Girraween High School',
              'Penrith High School', 'Fort Street High School'],
    enrollment_site: 'education.nsw.gov.au/public-schools/selective-high-schools-and-opportunity-classes',
  },
  VIC: {
    test: 'SEHS Exam（每年6月），Year 9 入学',
    schools: ['Melbourne High School', 'Mac.Robertson Girls High School', 'Nossal High School', 'Suzanne Cory High School'],
    enrollment_site: 'education.vic.gov.au/about/programs/pages/selectiveentry.aspx',
  },
  QLD: {
    test: '无传统精英考试体系，有 Queensland Academies',
    schools: ['Queensland Academy for Science, Mathematics and Technology', 'Brisbane State High School'],
    enrollment_site: 'education.qld.gov.au',
  },
};

// ── 学校全量数据 (从 RAG JSON 加载) ────────────────────────────────

let _schoolsCache = null;

async function loadSchools(env) {
  if (_schoolsCache) return _schoolsCache;

  // Try loading from KV first (deployed), then fallback to built-in
  if (env?.SCHOOL_DATA) {
    try {
      const data = await env.SCHOOL_DATA.get('all-schools', 'json');
      if (data) { _schoolsCache = data; return data; }
    } catch {}
  }

  // In development/testing — return empty (will use Tavily fallback)
  return null;
}

// ── 搜索函数 ──────────────────────────────────────────────────────

function searchInData(schools, args) {
  let results = [...schools];

  const query = (args.query || args.name || '').toLowerCase();
  const suburb = (args.suburb || args.location || '').toLowerCase();
  const state = (args.state || '').toUpperCase();
  const postcode = String(args.postcode || '');
  const type = (args.type || '').toLowerCase(); // primary, secondary, combined
  const sector = (args.sector || args.school_type || '').toLowerCase(); // government, catholic, independent
  const minIcsea = Number(args.min_icsea) || 0;
  const sortBy = args.sort || 'icsea'; // icsea, name, enrolments
  const limit = Math.min(Number(args.limit) || 20, 50);

  // Filter
  if (state) results = results.filter(s => s.state === state);
  if (postcode) results = results.filter(s => s.postcode === postcode);
  if (suburb) results = results.filter(s => s.suburb.toLowerCase().includes(suburb));
  if (type) {
    if (type === 'primary') results = results.filter(s => s.type === 'Primary' || s.type === 'Combined');
    else if (type === 'secondary' || type === 'high') results = results.filter(s => s.type === 'Secondary' || s.type === 'Combined');
    else results = results.filter(s => s.type.toLowerCase().includes(type));
  }
  if (sector) {
    if (sector === 'public' || sector === 'government') results = results.filter(s => s.sector === 'Government');
    else if (sector === 'catholic') results = results.filter(s => s.sector === 'Catholic');
    else if (sector === 'independent' || sector === 'private') results = results.filter(s => s.sector === 'Independent');
    else if (sector === 'selective') {
      const allSelective = Object.values(SELECTIVE_SCHOOLS).flatMap(s => s.schools.map(n => n.toLowerCase()));
      results = results.filter(s => allSelective.some(sel => s.name.toLowerCase().includes(sel.split(' ')[0])));
    }
  }
  if (minIcsea) results = results.filter(s => s.icsea >= minIcsea);
  if (query) {
    results = results.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.suburb.toLowerCase().includes(query) ||
      s.postcode.includes(query)
    );
  }

  // Sort
  if (sortBy === 'icsea') results.sort((a, b) => b.icsea - a.icsea);
  else if (sortBy === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === 'enrolments') results.sort((a, b) => b.total_enrolments - a.total_enrolments);

  return results.slice(0, limit);
}

// ── GPS 附近搜索 ──────────────────────────────────────────────────

function searchNearby(schools, lat, lng, radiusKm = 5, limit = 15) {
  const toRad = d => d * Math.PI / 180;

  const withDist = schools
    .filter(s => s.latitude && s.longitude)
    .map(s => {
      // Haversine formula
      const R = 6371;
      const dLat = toRad(s.latitude - lat);
      const dLng = toRad(s.longitude - lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(s.latitude)) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...s, distance_km: Math.round(dist * 10) / 10 };
    })
    .filter(s => s.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);

  return withDist.slice(0, limit);
}

// ── 主函数 ──────────────────────────────────────────────────────────

export async function searchSchool(args, env) {
  const mode = args.mode || 'search';

  // Mode: selective schools info
  if (mode === 'selective' || (args.type || '').toLowerCase() === 'selective') {
    const state = (args.state || 'NSW').toUpperCase();
    const info = SELECTIVE_SCHOOLS[state] || SELECTIVE_SCHOOLS.NSW;
    return {
      state,
      selective_info: info,
      all_states: Object.keys(SELECTIVE_SCHOOLS),
      tip: '精英学校免学费但需通过入学考试。建议从Year 5开始准备（Year 7入学），最好提前购买OC/Selective考试模拟题。',
    };
  }

  // Mode: school types overview
  if (mode === 'types') {
    return { school_types: SCHOOL_TYPES, tip: '华人家长常选：好学区的公立 > 天主教（性价比高） > 优质私立' };
  }

  // Try local data search
  const schools = await loadSchools(env);

  if (schools && schools.length > 0) {
    // Mode: nearby GPS search
    if (mode === 'nearby' && args.latitude && args.longitude) {
      const radius = Number(args.radius) || 5;
      const nearby = searchNearby(schools, Number(args.latitude), Number(args.longitude), radius);
      return {
        mode: 'nearby',
        radius_km: radius,
        results: nearby.map(s => ({
          name: s.name, suburb: s.suburb, postcode: s.postcode,
          state: s.state, sector: s.sector, type: s.type,
          icsea: s.icsea, enrolments: s.total_enrolments,
          year_range: s.year_range, distance_km: s.distance_km,
          url: s.url ? `https://myschool.edu.au/school/${s.id}` : '',
        })),
        results_count: nearby.length,
        source: 'ACARA MySchool 2025 (本地数据库)',
      };
    }

    // Mode: standard search
    const results = searchInData(schools, args);
    const state = (args.state || '').toUpperCase();

    return {
      query: args.query || args.suburb || args.postcode || 'all',
      filters: {
        state: state || 'all',
        type: args.type || 'all',
        sector: args.sector || args.school_type || 'all',
        min_icsea: Number(args.min_icsea) || 'none',
      },
      results: results.map(s => ({
        name: s.name, suburb: s.suburb, postcode: s.postcode,
        state: s.state, sector: SCHOOL_TYPES[s.sector]?.cn || s.sector,
        sector_en: s.sector,
        type: s.type, icsea: s.icsea,
        icsea_level: s.icsea >= 1150 ? '⭐ 顶级' : s.icsea >= 1100 ? '🌟 优秀' : s.icsea >= 1050 ? '👍 良好' : s.icsea >= 1000 ? '📊 平均' : '📉 低于平均',
        enrolments: s.total_enrolments,
        year_range: s.year_range,
        lbote_pct: s.lbote_pct, // 非英语背景比例（华人区通常高）
        myschool_url: `https://myschool.edu.au/school/${s.id}`,
      })),
      results_count: results.length,
      total_in_database: schools.length,
      icsea_guide: {
        '1150+': '⭐ 顶级学区（多数顶级私立/精英公立）',
        '1100-1150': '🌟 优秀学区（好的公立/天主教）',
        '1050-1100': '👍 中上学区',
        '1000-1050': '📊 全国平均水平',
        '< 1000': '📉 低于全国平均',
      },
      tips: [
        '公立学校按学区(catchment)入学，买/租房前查学区: schoolfinder.education.nsw.gov.au',
        'LBOTE高 = 非英语背景多 = 华人区学校（如Chatswood/Hurstville/Box Hill）',
        '好学区的房价通常更高，但教育投资回报长期看是值得的',
      ],
      source: 'ACARA MySchool 2025 (9,755 schools)',
    };
  }

  // Fallback: Tavily search (when no local data)
  const query = args.query || args.suburb || args.name || 'school';
  const state = (args.state || '').toUpperCase();
  const searchQ = `${query} ${state} school Australia myschool ICSEA`.trim();

  let tavilyResults = [];
  const tavilyKey = env?.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const data = await tavilySearch(searchQ, tavilyKey, {
        maxResults: 8, depth: 'basic', rawContent: false, answer: false,
        includeDomains: ['myschool.edu.au', 'bettereducation.com.au'],
      });
      tavilyResults = (data.results || []).map(r => ({
        name: r.title?.replace(/ \| My School$/i, '') || '',
        url: r.url, snippet: (r.snippet || '').substring(0, 400),
        source: r.url?.includes('myschool') ? 'MySchool' : 'BetterEducation',
      })).slice(0, 8);
    } catch {}
  }

  return {
    query: searchQ,
    results: tavilyResults,
    results_count: tavilyResults.length,
    note: '本地学校数据库未加载，使用 Tavily 在线搜索作为备选。',
    source: 'MySchool.edu.au via Tavily',
  };
}
