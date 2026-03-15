/**
 * Medicare/MBS Fee Lookup — Medicare 费用查询
 * 查询 Medicare 报销项目、费用、自付比例、Bulk Bill 指南
 * 数据来源：MBS Schedule 2025-2026 + Tavily 搜索 mbsonline.gov.au
 *
 * 注意：MBS Schedule Fee 每年 11月1日 更新，下次更新需核对
 *       https://www.mbsonline.gov.au/internet/mbsonline/publishing.nsf/Content/downloads
 *
 * 报销规则：
 *   - GP/out-of-hospital：报销 Schedule Fee 的 100%
 *   - Specialist (in-hospital)：报销 Schedule Fee 的 75%
 *   - Specialist (out-of-hospital)：报销 Schedule Fee 的 85%
 */

import { tavilySearch } from './web-search.js';

// ── 常用 MBS 项目 (2025-2026 Schedule Fee) ──────────────────────────
// category: gp | specialist | mental_health | allied | pathology | imaging
// rebate_rule: '100%' (GP/out-of-hospital) | '85%' (specialist out-of-hospital) | '75%' (in-hospital)

const COMMON_MBS = {
  // ─ GP consultations ─
  '23': {
    name: 'Standard GP consultation (Level B)',
    category: 'gp',
    fee: 43.00, rebate_rule: '100%',
    description: '最常见的GP面诊，约6-20分钟',
    bulk_billed_rate: '约80%的GP提供Bulk Bill',
    tip: '大部分诊所前台可以直接询问"Do you bulk bill?"',
  },
  '36': {
    name: 'Long GP consultation (Level C)',
    category: 'gp',
    fee: 83.50, rebate_rule: '100%',
    description: '较长面诊（20-40分钟），适合慢性病管理、多项问题',
    bulk_billed_rate: '约60%的GP提供',
    tip: '需要讨论多个问题时可预约Long Appointment',
  },
  '44': {
    name: 'Prolonged GP consultation (Level D)',
    category: 'gp',
    fee: 122.15, rebate_rule: '100%',
    description: '复杂问题长时间面诊（40分钟+），心理健康、多系统疾病',
    bulk_billed_rate: '约40%提供',
  },
  '52': {
    name: 'After-hours GP consultation',
    category: 'gp',
    fee: 140.40, rebate_rule: '100%',
    description: '非工作时间（晚间/周末/节假日）紧急GP诊疗',
    bulk_billed_rate: '较少，多数after-hours诊所不Bulk Bill',
    tip: '可先打 13 SICK (13 7425) 查找就近after-hours服务',
  },
  '91800': {
    name: 'GP telehealth consultation (video)',
    category: 'gp',
    fee: 43.00, rebate_rule: '100%',
    description: '视频远程GP问诊，等同Level B',
    bulk_billed_rate: '多数提供Bulk Bill',
    tip: '适合复诊、处方续药、简单问题',
  },

  // ─ Specialist consultations ─
  '104': {
    name: 'Initial specialist consultation',
    category: 'specialist',
    fee: 93.80, rebate_rule: '85%',
    description: '首次看专科医生（需要GP的referral letter）',
    bulk_billed_rate: '极少（<5%），通常自付$50-200+',
    tip: 'GP开referral有效期12个月，公立医院specialist免费但等待长',
  },
  '105': {
    name: 'Subsequent specialist consultation',
    category: 'specialist',
    fee: 46.95, rebate_rule: '85%',
    description: '同一专科医生复诊',
    bulk_billed_rate: '极少',
  },

  // ─ Mental health (需要Mental Health Care Plan) ─
  '80010': {
    name: 'Clinical psychologist session (50+ min)',
    category: 'mental_health',
    fee: 136.85, rebate_rule: '100%',
    description: '临床心理师治疗（需GP开Mental Health Care Plan）',
    bulk_billed_rate: '极少，通常自付$50-150/次',
    tip: '每年最多10次rebate。找GP说需要MHCP并要求Chinese-speaking psychologist',
  },
  '80110': {
    name: 'Registered psychologist session (50+ min)',
    category: 'mental_health',
    fee: 94.60, rebate_rule: '100%',
    description: '注册心理师治疗',
    bulk_billed_rate: '极少',
    tip: '注册心理师收费通常比临床低，rebate也较低',
  },

  // ─ Allied health (需要Chronic Disease Management Plan) ─
  '10960': {
    name: 'Allied health - Physiotherapy/OT/etc',
    category: 'allied',
    fee: 58.20, rebate_rule: '100%',
    description: '物理治疗/职业治疗等联合健康服务',
    bulk_billed_rate: '很少',
    tip: '需GP开Team Care Arrangement (TCA)，每年最多5次联合治疗rebate',
  },

  // ─ Pathology 病理/血检 ─
  '66500': {
    name: 'Full blood count (FBC)',
    category: 'pathology',
    fee: 19.60, rebate_rule: '100%',
    description: '全血细胞计数（最常用血检项目）',
    bulk_billed_rate: '大部分Bulk Bill（Laverty/QML/ACL等连锁几乎100%）',
    tip: 'GP开blood test单后去任意pathology centre采血，通常免费',
  },

  // ─ Diagnostic imaging 影像 ─
  '57901': {
    name: 'Chest X-ray',
    category: 'imaging',
    fee: 44.35, rebate_rule: '100%',
    description: '胸部X光片（体检/移民/肺部检查常用）',
    bulk_billed_rate: '多数Bulk Bill',
    tip: 'I-MED/Lumus等连锁影像中心多数提供Bulk Bill',
  },
  '63001': {
    name: 'Ultrasound (abdominal/pelvic)',
    category: 'imaging',
    fee: 101.70, rebate_rule: '100%',
    description: '腹部或盆腔超声波检查',
    bulk_billed_rate: '约50%提供Bulk Bill',
  },
  '56001': {
    name: 'CT scan (head)',
    category: 'imaging',
    fee: 363.50, rebate_rule: '85%',
    description: '头部CT扫描',
    bulk_billed_rate: '约30%提供Bulk Bill',
    tip: '需specialist referral才能获85%报销，GP referral只能获75%',
  },
  '63401': {
    name: 'MRI scan (knee/spine/brain)',
    category: 'imaging',
    fee: 560.00, rebate_rule: '85%',
    description: 'MRI 磁共振成像（需specialist referral）',
    bulk_billed_rate: '约20%提供Bulk Bill',
    tip: 'MRI 必须有specialist开的referral，且诊断需符合MBS规定才能报销',
  },
};

// ── 报销计算 ─────────────────────────────────────────────────────────

function calculateRebate(item, doctorFee) {
  const rule = item.rebate_rule;
  let rebatePercent;
  if (rule === '100%') rebatePercent = 1.0;
  else if (rule === '85%') rebatePercent = 0.85;
  else rebatePercent = 0.75;

  const scheduleRebate = +(item.fee * rebatePercent).toFixed(2);
  const actualFee = doctorFee || item.fee;
  const gap = +(Math.max(0, actualFee - scheduleRebate)).toFixed(2);

  return { scheduleRebate, gap, rebatePercent: rule, actualFee };
}

// ── Bulk Bill 指南 ───────────────────────────────────────────────────

const BULK_BILL_GUIDE = {
  what_is: 'Bulk Billing = 医生接受Medicare报销作为全部费用，你付$0',
  how_it_works: [
    '1. 医生向Medicare直接结算（你刷Medicare卡）',
    '2. 你不需付任何费用',
    '3. 医生只收取Schedule Fee，不额外收费',
  ],
  who_bulk_bills: {
    almost_always: ['大部分GP诊所（持Medicare卡的concession/儿童/老人优先）', 'Pathology血检中心（Laverty/QML/ACL）', '公立医院门诊'],
    sometimes: ['部分影像中心（X光/超声波）', '部分GP对所有患者Bulk Bill'],
    rarely: ['Specialist专科医生', 'Psychologist心理师', 'Dentist牙医（Medicare不覆盖）', 'MRI/CT（取决于referral）'],
  },
  how_to_find: [
    '直接问诊所前台："Do you bulk bill?"',
    'HotDoc App → 筛选 Bulk Billing',
    'HealthDirect Service Finder → healthdirect.gov.au/australian-health-services',
    'Google Maps 搜 "bulk billing GP near me"',
  ],
  triple_guarantee: {
    title: 'Medicare 三重保障 (Safety Nets)',
    original_safety_net: '当年度自付Gap总额超过$531.70（concession）或$2,544.30 → Medicare自动多报销',
    extended_safety_net: 'Gap超过上限后，Medicare额外报销80%的差价',
    greatest_permissible_gap: '如果医生收费不超过Schedule Fee的+$99.10(GP)/$159.90(specialist)以上，不计入Safety Net',
    how_to_track: 'Medicare App → Statements → Safety Net Balance',
  },
};

// ── 主函数 ──────────────────────────────────────────────────────────

export async function lookupMedicare(args, env) {
  const itemNumber = args.item || args.mbs || args.number || '';
  const query = args.query || args.service || '';
  const doctorFee = args.doctor_fee ? parseFloat(args.doctor_fee) : null;
  const mode = args.mode || 'search';

  // Mode: Bulk Bill guide
  if (mode === 'bulk_bill' || /bulk.?bill|全报销|免费看/.test(query)) {
    return { ...BULK_BILL_GUIDE, source: 'Services Australia / MBS Schedule' };
  }

  // Mode 1: Lookup by MBS item number
  if (itemNumber) {
    const item = COMMON_MBS[String(itemNumber)];
    if (item) {
      const typicalDoctorFee = doctorFee || +(item.fee * 1.3).toFixed(2);
      const calc = calculateRebate(item, typicalDoctorFee);
      return {
        mbs_item: itemNumber,
        ...item,
        rebate_calculation: {
          schedule_fee: `$${item.fee}`,
          rebate_rule: calc.rebatePercent,
          medicare_rebate: `$${calc.scheduleRebate}`,
          typical_doctor_fee: `$${typicalDoctorFee}`,
          your_gap: `$${calc.gap}`,
          if_bulk_billed: '$0 (Medicare全额报销)',
        },
        how_to_claim: [
          'Bulk Bill → 刷Medicare卡即可，无需操作',
          '自付后报销 → Medicare App 拍照上传收据（最快2天到账）',
          '或去 Medicare Service Centre 现场报销',
          '有PHI → Gap部分可再找私保报销',
        ],
        source: 'MBS Schedule 2025-2026',
      };
    }
  }

  // Mode 2: Search by service description
  if (query || itemNumber) {
    const searchText = (query || `MBS item ${itemNumber}`).toLowerCase();

    // Search built-in items
    const builtInMatches = Object.entries(COMMON_MBS)
      .filter(([key, v]) =>
        v.name.toLowerCase().includes(searchText) ||
        v.description.includes(searchText) ||
        v.category === searchText ||
        key === searchText)
      .map(([num, v]) => {
        const calc = calculateRebate(v, null);
        return {
          mbs_item: num,
          name: v.name,
          category: v.category,
          schedule_fee: `$${v.fee}`,
          medicare_rebate: `$${calc.scheduleRebate}`,
          typical_gap: `$${calc.gap}`,
          bulk_billed_rate: v.bulk_billed_rate,
        };
      })
      .slice(0, 8);

    // 1. Cloudflare /markdown 抓取 MBS Online 官网
    let onlineResults = [];
    try {
      const { crawlPage } = await import('./cf-crawl.js');
      const mbsUrl = `https://www.mbsonline.gov.au/internet/mbsonline/publishing.nsf/Content/Home`;
      const page = await crawlPage(mbsUrl, env, { maxLength: 1500 });
      if (page && !page.error && page.content) {
        onlineResults.push({
          title: 'MBS Online - Official Schedule',
          url: mbsUrl,
          snippet: page.content.substring(0, 300),
          source: 'MBS Online 官网 (Browser Rendering)',
        });
      }
    } catch {}

    // 2. Tavily fallback for non-built-in items
    const tavilyKey = env?.TAVILY_API_KEY;
    if (tavilyKey && builtInMatches.length < 2 && onlineResults.length === 0) {
      try {
        const data = await tavilySearch(`MBS Medicare ${searchText} fee schedule rebate Australia`, tavilyKey, {
          maxResults: 5,
          depth: 'basic',
          rawContent: false,
          answer: false,
          includeDomains: ['mbsonline.gov.au', 'servicesaustralia.gov.au', 'health.gov.au'],
        });
        onlineResults = (data.results || []).map(r => ({
          title: r.title || '',
          url: r.url || '',
          snippet: (r.content || r.snippet || '').substring(0, 300),
        })).slice(0, 5);
      } catch { /* ignore */ }
    }

    return {
      query: searchText,
      built_in_matches: builtInMatches,
      online_results: onlineResults,
      bulk_bill_tip: '想找免费看诊？问诊所 "Do you bulk bill?" 或在HotDoc App筛选Bulk Billing',
      source: 'MBS Schedule 2025-2026 + mbsonline.gov.au',
    };
  }

  // Mode 3: General Medicare guide
  return {
    overview: {
      what: 'Medicare是澳洲的公共医疗保险系统，覆盖PR和公民',
      who_eligible: ['澳洲公民', '永久居民(PR)', '部分签证持有者（互惠协议国家：英国/爱尔兰/新西兰/意大利等）'],
      who_not_eligible: ['学生签证(500) → 需购买OSHC', '旅游签证(600) → 需旅行保险', '打工度假签(417/462) → 部分可申请'],
      card: '申请Medicare卡: servicesaustralia.gov.au → Medicare → Enrol',
    },
    key_terms: {
      schedule_fee: 'MBS规定的官方价格（政府设定）',
      rebate: 'Medicare报销金额：GP=100%、Specialist(门诊)=85%、住院=75%',
      gap_payment: '医生收费 - Medicare报销 = 你付的差价(Gap)',
      bulk_billing: '医生接受Schedule Fee作为全部费用 → 你付$0',
      safety_net: '年度自付Gap超限后，Medicare自动增加报销比例',
    },
    bulk_bill_guide: BULK_BILL_GUIDE,
    mental_health: {
      plan: 'Mental Health Care Plan (MHCP)',
      how: '找GP说你需要心理咨询 → GP做评估开MHCP → 每年最多10次心理治疗有Medicare rebate',
      cost: '临床心理师rebate $136.85/次，自付通常$50-150。注册心理师rebate $94.60/次。',
      chinese_psychologists: '搜索中文心理师: psychology.org.au → Find a psychologist → Language: Chinese/Mandarin',
    },
    common_items_summary: Object.entries(COMMON_MBS).map(([num, v]) => {
      const calc = calculateRebate(v, null);
      return {
        item: num,
        name: v.name,
        category: v.category,
        fee: `$${v.fee}`,
        rebate: `$${calc.scheduleRebate}`,
        bulk_bill: v.bulk_billed_rate,
      };
    }),
    tips: [
      '大部分GP都Bulk Bill — 看病前先问 "Do you bulk bill?"',
      'Specialist通常不Bulk Bill，但公立医院门诊free',
      '血检/X光大多Bulk Bill，CT/MRI少数免费要提前问',
      '下载Medicare App追踪报销记录和Safety Net余额',
    ],
  };
}
