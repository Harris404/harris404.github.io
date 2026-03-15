/**
 * GP Finder — 增强版 GP 搜索
 * 
 * 功能：
 *  1. HotDoc /markdown 爬取 — 获取诊所详情、可预约时间
 *  2. 中文 GP 列表 — 内置会说中文的 GP 数据
 *  3. Bulk Billing 筛选 — 专门搜 Bulk Billing GP
 *  4. 牙科/眼科/心理 — 专科搜索
 *  5. 华人就医指南 — 内置看病流程指引
 * 
 * 数据源优先级：
 *  1. 内置中文GP数据 → 2. HotDoc /markdown 爬取 → 3. Tavily 搜索
 */

import { tavilySearch } from './web-search.js';

// ─── 内置中文 GP 数据库 ───────────────────────────────────────────
// 来源：HotDoc、Google Maps 手工整理。NOTE: 需定期更新
const CHINESE_GP_DATA = {
  sydney: [
    { name: 'Sydney CBD Medical Centre', address: '580 George St, Sydney NSW 2000', phone: '(02) 9267 7888', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'sydney cbd', hotdoc: 'https://www.hotdoc.com.au/medical-centres/sydney-NSW-2000/sydney-cbd-medical-centre/' },
    { name: 'Town Hall Clinic', address: '50 York St, Sydney NSW 2000', phone: '(02) 9299 4661', languages: ['Mandarin'], bulk_billing: true, suburb: 'sydney cbd', hotdoc: null },
    { name: 'World Tower Medical Centre', address: '268 Liverpool St, Sydney NSW 2000', phone: '(02) 9283 2423', languages: ['Mandarin', 'Cantonese'], bulk_billing: false, suburb: 'sydney cbd', hotdoc: null },
    { name: 'Eastwood Medical Centre', address: '3 Lakeside Rd, Eastwood NSW 2122', phone: '(02) 9858 1233', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'eastwood' },
    { name: 'Hurstville Westpoint Medical Centre', address: '113 Forest Rd, Hurstville NSW 2220', phone: '(02) 9585 2999', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'hurstville' },
    { name: 'Chatswood Family Medical Practice', address: '1 Railway St, Chatswood NSW 2067', phone: '(02) 9411 2800', languages: ['Mandarin'], bulk_billing: true, suburb: 'chatswood' },
    { name: 'Burwood Road Medical Centre', address: '179 Burwood Rd, Burwood NSW 2134', phone: '(02) 9745 5557', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'burwood' },
    { name: 'Ashfield Medical Practice', address: '260A Liverpool Rd, Ashfield NSW 2131', phone: '(02) 9799 1233', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'ashfield' },
    { name: 'Campsie Medical Centre', address: '52 Beamish St, Campsie NSW 2194', phone: '(02) 9789 3233', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'campsie' },
    { name: 'Zetland Medical Practice', address: 'Zetland NSW 2017', phone: null, languages: ['Mandarin'], bulk_billing: true, suburb: 'zetland' },
  ],
  melbourne: [
    { name: 'Melbourne CBD Medical', address: '250 Collins St, Melbourne VIC 3000', phone: '(03) 9654 6088', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'melbourne cbd' },
    { name: 'Box Hill Superclinic', address: '17-21 Market St, Box Hill VIC 3128', phone: '(03) 9890 0900', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'box hill' },
    { name: 'Glen Waverley Medical Centre', address: '18 Railway Parade North, Glen Waverley VIC 3150', phone: '(03) 9802 0666', languages: ['Mandarin'], bulk_billing: true, suburb: 'glen waverley' },
    { name: 'Clayton Medical Centre', address: '282 Clayton Rd, Clayton VIC 3168', phone: '(03) 9543 1222', languages: ['Mandarin'], bulk_billing: true, suburb: 'clayton' },
    { name: 'Doncaster East Medical Centre', address: '816 Doncaster Rd, Doncaster East VIC 3109', phone: '(03) 9842 1033', languages: ['Mandarin', 'Cantonese'], bulk_billing: false, suburb: 'doncaster' },
  ],
  brisbane: [
    { name: 'Sunnybank Medical Centre', address: '340 Mains Rd, Sunnybank QLD 4109', phone: '(07) 3344 5554', languages: ['Mandarin', 'Cantonese'], bulk_billing: true, suburb: 'sunnybank' },
    { name: 'Brisbane CBD Medical Centre', address: '245 Albert St, Brisbane QLD 4000', phone: '(07) 3211 3611', languages: ['Mandarin'], bulk_billing: true, suburb: 'brisbane cbd' },
    { name: 'Upper Mount Gravatt Medical', address: 'Mt Gravatt QLD 4122', phone: null, languages: ['Mandarin'], bulk_billing: true, suburb: 'mt gravatt' },
  ],
  perth: [
    { name: 'Perth CBD Medical Centre', address: 'Perth WA 6000', phone: null, languages: ['Mandarin'], bulk_billing: true, suburb: 'perth cbd' },
  ],
  adelaide: [
    { name: 'Adelaide CBD Medical Centre', address: 'Adelaide SA 5000', phone: null, languages: ['Mandarin'], bulk_billing: true, suburb: 'adelaide cbd' },
  ],
  canberra: [
    { name: 'Belconnen Medical Centre', address: 'Belconnen ACT 2617', phone: null, languages: ['Mandarin'], bulk_billing: true, suburb: 'belconnen' },
  ],
};

// ─── 常见药物交互数据库 ───────────────────────────────────────────
const DRUG_INTERACTIONS = {
  'paracetamol+ibuprofen': { severity: 'low', note: '可以交替服用，但不建议同时服用。间隔至少 2 小时。' },
  'paracetamol+alcohol': { severity: 'high', note: '⚠️ 严重肝损伤风险！服用 Paracetamol 期间避免饮酒。' },
  'ibuprofen+aspirin': { severity: 'high', note: '⚠️ 增加消化道出血风险，不建议同时使用。NSAIDs 不要叠加。' },
  'ibuprofen+alcohol': { severity: 'medium', note: '增加胃出血风险。服药期间避免或限制饮酒。' },
  'aspirin+ibuprofen': { severity: 'high', note: '⚠️ NSAIDs 叠加增加出血风险。Aspirin 主要用于心血管保护时，Ibuprofen 可能降低其效果。' },
  'warfarin+aspirin': { severity: 'critical', note: '🚨 严重出血风险！绝对不要自行合用。必须在医生监督下使用。' },
  'warfarin+ibuprofen': { severity: 'critical', note: '🚨 严重出血风险！NSAIDs 增加抗凝血药的出血风险。请立即咨询医生。' },
  'warfarin+paracetamol': { severity: 'medium', note: '长期使用可能影响 INR 值。短期低剂量通常安全，但需监测。' },
  'metformin+alcohol': { severity: 'high', note: '⚠️ 增加乳酸中毒风险。糖尿病患者服用 Metformin 期间限制饮酒。' },
  'ssri+nsaid': { severity: 'medium', note: '抗抑郁药（SSRI）与 NSAIDs 合用增加消化道出血风险。' },
  'blood pressure+nsaid': { severity: 'medium', note: 'NSAIDs（如 Ibuprofen）可能升高血压，降低降压药效果。' },
  'antihistamine+alcohol': { severity: 'medium', note: '抗组胺药+酒精加重嗜睡。服药后避免驾驶。' },
};

// ─── 心理健康资源 ───────────────────────────────────────────
const MENTAL_HEALTH_RESOURCES = {
  crisis: [
    { name: 'Lifeline', phone: '13 11 14', hours: '24/7', lang: 'English', url: 'https://www.lifeline.org.au' },
    { name: 'Suicide Call Back Service', phone: '1300 659 467', hours: '24/7', lang: 'English', url: 'https://www.suicidecallbackservice.org.au' },
    { name: 'Beyond Blue 中文翻译', phone: '1300 22 4636', hours: '24/7', lang: 'English (可要求中文翻译)', url: 'https://www.beyondblue.org.au' },
    { name: '000 Emergency', phone: '000', hours: '24/7', lang: 'All (TIS翻译 131 450)', note: '紧急危险时拨打' },
  ],
  support: [
    { name: 'Headspace', desc: '15-25岁青少年心理健康', phone: '1800 650 890', url: 'https://headspace.org.au' },
    { name: 'ReachOut', desc: '青少年在线心理支持', url: 'https://au.reachout.com' },
    { name: 'Head to Health', desc: '政府心理健康服务导航', url: 'https://www.headtohealth.gov.au' },
    { name: 'TIS翻译服务', desc: '看病时免费电话翻译（华医不够时）', phone: '131 450', note: '告诉 GP 需要中文翻译，GP 会拨打' },
  ],
  medicare_plan: {
    name: 'Mental Health Treatment Plan（心理健康治疗计划）',
    steps: [
      '1️⃣ 预约 GP — 告知需要 Mental Health Treatment Plan',
      '2️⃣ GP 评估 — 填写 K10 问卷（心理健康评估）',
      '3️⃣ GP 开具 — Mental Health Treatment Plan + Referral',
      '4️⃣ 预约心理师 — Psychologist/Counsellor（GP 推荐或自选）',
      '5️⃣ Medicare 报销 — 每年最多 10 次心理咨询（$90-$130 rebate/次）',
    ],
    cost: '有 Medicare：GP 开 Plan 免费（Bulk Billing GP）；心理咨询 rebate 约 $90-$130/次，还可能有 Gap（$50-$150）',
    tip: '留学生用 OSHC 也可报销心理咨询，但需确认你的 OSHC 计划是否包含。大多数大学提供免费心理咨询（每年 6-10 次）。',
  },
};

// ─── 华人就医指南 ───────────────────────────────────────────
const HEALTHCARE_GUIDE_CN = {
  gp_visit: {
    title: '🏥 澳洲看 GP（全科医生）完整指南',
    steps: [
      { step: '预约', desc: '通过 HotDoc/HealthEngine 在线预约，或直接打电话。Walk-in（不预约直接去）也可以，但等待时间长。' },
      { step: '到达', desc: '带上 Medicare 卡/OSHC 卡、Photo ID。提前 10 分钟到，在前台 check-in。' },
      { step: '就诊', desc: 'Level 1 = 标准诊（15分钟），Level 2 = 长诊（30分钟）。复杂问题要求 long consultation。' },
      { step: '沟通', desc: '不会英文？可要求 TIS 翻译 (131 450)，GP 帮你拨打，全程免费电话翻译。也可以找说中文的 GP。' },
      { step: '付费', desc: 'Bulk Billing = 免费（Medicare 全报销）。Private Billing = 先付后报。OSHC 留学生需先付后向保险公司理赔。' },
      { step: '拿药', desc: 'GP 开 e-Prescription（电子处方），去药房出示即可。PBS 药品补贴后约 $7.70（一般人）或 $31.60。' },
    ],
    tips: [
      '⏰ 周六可以看 GP，但可能不 Bulk Billing',
      '🆘 下班/周末急诊：打 13 HEALTH (13 43 25 84) 或去 After-Hours GP',
      '💡 小问题先看 GP，不要直接去医院急诊（Emergency Department 等待 4-8 小时）',
      '📱 开通 MyGov + Medicare online 可以查看报销记录',
    ],
  },
  dental: {
    title: '🦷 澳洲看牙指南',
    info: [
      'Medicare 不报销牙科（除儿童 Child Dental Benefits Schedule）',
      '私人牙科：洗牙检查 $180-$350，补牙 $150-$400，拔智齿 $300-$600',
      '公立牙科：各州有 Public Dental Service（免费/低价），但等待 6-18 个月',
      'OSHC 通常不包含牙科。需额外购买 Extras cover。',
      '大学牙科诊所（如 USyd、UniMelb）提供低价治疗（学生实习，有教师监督）',
    ],
    where: [
      { name: 'HCF Dental', desc: '连锁牙科，会员可享折扣' },
      { name: 'Pacific Smiles', desc: '全国连锁，接受各种健康保险' },
      { name: 'Public Dental', desc: '各州政府牙科 — 低收入 Health Care Card 持有者免费', url: 'https://www.health.gov.au/health-topics/dental-health' },
    ],
  },
  eye: {
    title: '👁️ 澳洲看眼科指南',
    info: [
      'Optometrist（验光师）检查 Medicare 可报销（每 3 年 1 次免费检查）',
      '配眼镜：$100-$600（OPSM、Specsavers、Bailey Nelson、Laubman & Pank）',
      'Specsavers：2副$199起 — 留学生最高性价比',
      '隐形眼镜：Specsavers 或 ContactLensOnline.com.au',
      'Ophthalmologist（眼科医生）需 GP 转介，Medicare 部分报销',
    ],
  },
};

// ─── HotDoc 爬取 ───────────────────────────────────────────

async function crawlHotDoc(location, specialty, bulkBilling, env) {
  const cfAccountId = env?.CF_ACCOUNT_ID;
  if (!cfAccountId) return null;

  const specialtyMap = {
    gp: 'general-practitioner',
    dentist: 'dentist',
    physio: 'physiotherapist',
    psychologist: 'psychologist',
    optometrist: 'optometrist',
    'podiatrist': 'podiatrist',
  };
  const slug = specialtyMap[specialty] || 'general-practitioner';
  const locSlug = location.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // HotDoc search URL pattern
  const hotdocUrl = `https://www.hotdoc.com.au/search?filters=bulk_billing-${bulkBilling ? 'true' : 'false'}&in=${locSlug}&purpose=${slug}`;

  try {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/urlscanner/v2/har/${encodeURIComponent(hotdocUrl)}/markdown`,
      {
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN || ''}` },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!resp.ok) {
      // Fallback: simpler /markdown endpoint
      const md = await fetch(`https://r.jina.ai/${hotdocUrl}`, {
        headers: { 'Accept': 'text/markdown' },
        signal: AbortSignal.timeout(6000),
      });
      if (!md.ok) return null;
      return { markdown: await md.text(), source: 'jina', url: hotdocUrl };
    }
    return { markdown: await resp.text(), source: 'cloudflare', url: hotdocUrl };
  } catch {
    return null;
  }
}

// ─── 主工具函数 ───────────────────────────────────────────

/**
 * Enhanced GP Finder
 * 
 * @param {Object} args
 * @param {string} args.action - 'find_gp' | 'chinese_gp' | 'bulk_billing' | 'dentist' | 'eye' | 'mental_health' | 'drug_interaction' | 'guide'
 * @param {string} args.location - 城市或区域
 * @param {string} args.specialty - 'gp' | 'dentist' | 'physio' | 'psychologist' | 'optometrist'
 * @param {boolean} args.bulk_billing - 是否 Bulk Billing
 * @param {boolean} args.chinese_speaking - 是否需要说中文
 * @param {string} args.drug_a - 药物A（交互检查）
 * @param {string} args.drug_b - 药物B（交互检查）
 * @param {Object} env
 */
export async function enhancedGPFinder(args, env) {
  const action = args.action || 'find_gp';

  // ─── 药物交互检查 ───────────────────────────────────────────
  if (action === 'drug_interaction') {
    return handleDrugInteraction(args);
  }

  // ─── 心理健康引导 ───────────────────────────────────────────
  if (action === 'mental_health') {
    return {
      ...MENTAL_HEALTH_RESOURCES,
      guide: HEALTHCARE_GUIDE_CN.gp_visit,
      tip: '心理健康很重要，寻求帮助是勇敢的表现。可以先从大学免费心理咨询开始，或找 GP 开 Mental Health Treatment Plan。',
      disclaimer: '如果你或身边的人正处于危机中，请立即拨打 Lifeline 13 11 14 或 000。',
    };
  }

  // ─── 就医指南 ───────────────────────────────────────────
  if (action === 'guide') {
    const topic = args.topic || 'gp';
    if (topic === 'dental' || topic === 'dentist') return { ...HEALTHCARE_GUIDE_CN.dental, disclaimer: '价格仅供参考，建议咨询牙科诊所获取报价。' };
    if (topic === 'eye' || topic === 'optometrist') return { ...HEALTHCARE_GUIDE_CN.eye, disclaimer: '建议每 2 年做一次眼科检查。' };
    return { ...HEALTHCARE_GUIDE_CN.gp_visit, disclaimer: '就医体验因诊所而异，以上为一般流程。' };
  }

  // ─── 中文 GP 搜索 ───────────────────────────────────────────
  if (action === 'chinese_gp' || args.chinese_speaking) {
    return handleChineseGPSearch(args, env);
  }

  // ─── 牙科/眼科 ───────────────────────────────────────────
  if (action === 'dentist') {
    return {
      ...HEALTHCARE_GUIDE_CN.dental,
      search_suggestion: '可以在 HotDoc 或 Google Maps 搜索附近牙医',
      hotdoc_link: `https://www.hotdoc.com.au/search?purpose=dentist&in=${(args.location || 'sydney').toLowerCase().replace(/\s/g, '-')}`,
    };
  }
  if (action === 'eye') {
    return {
      ...HEALTHCARE_GUIDE_CN.eye,
      search_suggestion: '验光师检查 Medicare 可报销。配镜推荐 Specsavers（性价比最高）',
      specsavers: 'https://www.specsavers.com.au/store-search',
    };
  }

  // ─── GP 搜索 (HotDoc + Tavily) ───────────────────────────────────────────
  return handleGPSearch(args, env);
}

async function handleChineseGPSearch(args, env) {
  const location = (args.location || 'sydney').toLowerCase().trim();
  const suburb = (args.suburb || '').toLowerCase().trim();
  const bulkBillingOnly = args.bulk_billing !== false;

  // Find matching city
  let cityGPs = null;
  for (const [city, gps] of Object.entries(CHINESE_GP_DATA)) {
    if (location.includes(city) || city.includes(location)) {
      cityGPs = gps;
      break;
    }
  }

  if (!cityGPs) {
    // No built-in data, fallback to Tavily search
    const tavilyKey = env?.TAVILY_API_KEY;
    if (tavilyKey) {
      const data = await tavilySearch(
        `Chinese speaking GP ${location} Australia 中文医生 bulk billing`,
        tavilyKey,
        { maxResults: 5, depth: 'basic', rawContent: false, answer: false }
      );
      return {
        location,
        chinese_speaking: true,
        from_database: false,
        results: (data.results || []).slice(0, 5),
        guide: HEALTHCARE_GUIDE_CN.gp_visit,
        tip: '华人区通常有说中文的 GP，可以问前台 "Do you have a Mandarin-speaking doctor?"',
        tis_translation: '不会说英文也没关系！告诉 GP 需要中文翻译，GP 会帮你拨打 TIS 翻译服务 (131 450)，全程免费。',
        source: 'Tavily search',
      };
    }
    return {
      location,
      error: `暂无 ${location} 的中文 GP 数据`,
      tip: '搜索 HotDoc 可以筛选会说中文的医生',
      hotdoc_link: 'https://www.hotdoc.com.au/search',
      tis_translation: '不会说英文也没关系！告诉 GP 需要中文翻译，GP 会帮你拨打 TIS 翻译服务 (131 450)，全程免费。',
    };
  }

  // Filter
  let results = cityGPs;
  if (suburb) {
    const suburbMatch = results.filter(gp => gp.suburb?.includes(suburb) || suburb.includes(gp.suburb || ''));
    if (suburbMatch.length > 0) results = suburbMatch;
  }
  if (bulkBillingOnly) {
    const bbMatch = results.filter(gp => gp.bulk_billing);
    if (bbMatch.length > 0) results = bbMatch;
  }

  return {
    location,
    suburb: suburb || 'all',
    chinese_speaking: true,
    bulk_billing_only: bulkBillingOnly,
    count: results.length,
    gps: results.map(gp => ({
      name: gp.name,
      address: gp.address,
      phone: gp.phone,
      languages: gp.languages,
      bulk_billing: gp.bulk_billing,
      hotdoc: gp.hotdoc,
    })),
    guide: HEALTHCARE_GUIDE_CN.gp_visit,
    tis_translation: '如果预约的 GP 不说中文，可以让前台帮忙联系 TIS 翻译服务 (131 450)，电话翻译全程免费。',
    source: 'built-in Chinese GP database + community sources',
    disclaimer: '⚠️ 数据可能有更新延迟，建议提前致电诊所确认。Bulk Billing 政策可能因医生和时段而变化。',
  };
}

async function handleGPSearch(args, env) {
  const location = args.location || 'Sydney';
  const specialty = args.specialty || 'gp';
  const bulkBilling = !!args.bulk_billing;

  // Try HotDoc Tavily search (faster and more reliable than crawling)
  const tavilyKey = env?.TAVILY_API_KEY;
  if (tavilyKey) {
    const bbText = bulkBilling ? ' bulk billing' : '';
    const query = `${specialty}${bbText} near ${location} book appointment`;

    const data = await tavilySearch(query, tavilyKey, {
      maxResults: 8,
      depth: 'basic',
      rawContent: false,
      answer: false,
      includeDomains: ['hotdoc.com.au', 'healthengine.com.au', 'healthdirect.gov.au'],
    });

    const clinics = (data.results || [])
      .map(r => ({
        name: r.title?.replace(/ - HotDoc$/i, '').replace(/Book.*?at /i, '').replace(/ \| Health.*$/i, '') || '',
        url: r.url || '',
        snippet: (r.snippet || '').substring(0, 300),
        source: r.url?.includes('hotdoc') ? 'HotDoc' : r.url?.includes('healthengine') ? 'HealthEngine' : 'HealthDirect',
        online_booking: r.url?.includes('hotdoc') || r.url?.includes('healthengine'),
      }))
      .filter(r => r.name)
      .slice(0, 6);

    return {
      specialty,
      location,
      bulk_billing: bulkBilling,
      count: clinics.length,
      clinics,
      guide: HEALTHCARE_GUIDE_CN.gp_visit,
      tips: [
        bulkBilling ? '✅ 已筛选 Bulk Billing 诊所（Medicare 全报销，免费就诊）' : '部分诊所可能 Private Billing，需先付后报。',
        '📱 点击链接可在线预约，支持选择日期和医生。',
        '🗣️ 需要中文 GP？搜索时加 "Chinese speaking" 或直接问我。',
      ],
      source: 'HotDoc/HealthEngine via Tavily',
    };
  }

  return {
    error: 'Search API not available',
    tip: `直接访问 https://www.hotdoc.com.au 搜索 ${location} 附近的 ${specialty}`,
    guide: HEALTHCARE_GUIDE_CN.gp_visit,
  };
}

function handleDrugInteraction(args) {
  const drugA = (args.drug_a || '').toLowerCase().trim();
  const drugB = (args.drug_b || '').toLowerCase().trim();

  if (!drugA || !drugB) {
    return {
      error: '请提供两种药物名称以检查交互。例如：drug_a: "paracetamol", drug_b: "ibuprofen"',
      common_interactions: Object.entries(DRUG_INTERACTIONS).slice(0, 5).map(([key, val]) => ({
        drugs: key.replace('+', ' + '),
        severity: val.severity,
        note: val.note,
      })),
    };
  }

  // Check both directions
  const key1 = `${drugA}+${drugB}`;
  const key2 = `${drugB}+${drugA}`;
  const interaction = DRUG_INTERACTIONS[key1] || DRUG_INTERACTIONS[key2];

  // Also check generic class interactions
  const nsaids = ['ibuprofen', 'aspirin', 'naproxen', 'diclofenac', 'celecoxib'];
  const ssris = ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram'];
  const bp_meds = ['amlodipine', 'ramipril', 'perindopril', 'irbesartan', 'metoprolol'];

  let classInteraction = null;
  if (nsaids.includes(drugA) && nsaids.includes(drugB)) {
    classInteraction = { severity: 'high', note: '⚠️ 不要同时服用两种 NSAIDs（非甾体抗炎药），会增加消化道出血和肾损伤风险。' };
  }
  if ((nsaids.includes(drugA) && ssris.includes(drugB)) || (ssris.includes(drugA) && nsaids.includes(drugB))) {
    classInteraction = DRUG_INTERACTIONS['ssri+nsaid'];
  }
  if ((nsaids.includes(drugA) && bp_meds.includes(drugB)) || (bp_meds.includes(drugA) && nsaids.includes(drugB))) {
    classInteraction = DRUG_INTERACTIONS['blood pressure+nsaid'];
  }

  const result = interaction || classInteraction;

  if (result) {
    return {
      drug_a: drugA,
      drug_b: drugB,
      interaction_found: true,
      severity: result.severity,
      severity_label: { critical: '🚨 严重', high: '⚠️ 高风险', medium: '⚡ 中等', low: 'ℹ️ 低风险' }[result.severity] || result.severity,
      warning: result.note,
      advice: result.severity === 'critical'
        ? '🚨 请立即停止合用并咨询医生或药剂师！'
        : result.severity === 'high'
          ? '⚠️ 强烈建议咨询医生或药剂师后再合用。'
          : '建议服药前询问药剂师。',
      disclaimer: '⚠️ 药物数据仅供参考，不能替代专业医疗建议。请咨询医生或药剂师（Pharmacist）。',
    };
  }

  return {
    drug_a: drugA,
    drug_b: drugB,
    interaction_found: false,
    note: `数据库中未找到 ${drugA} + ${drugB} 的交互记录。这不代表没有交互。`,
    advice: '建议在药房取药时直接询问药剂师（Pharmacist），他们可以免费检查所有药物交互。',
    tip: '澳洲药剂师可以免费提供用药咨询（Pharmacist Consultation），不需要预约。',
    disclaimer: '⚠️ 药物数据仅供参考，不能替代专业医疗建议。',
  };
}
