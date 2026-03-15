/**
 * Insurance Comparison Tool — 澳洲保险对比
 * 
 * 覆盖：
 * - 车险 (CTP Green Slip + Comprehensive + Third Party)
 * - 房屋/租客保险 (Home & Contents / Renters)  
 * - 旅行保险 (Travel Insurance)
 * - OSHC (学生保险 — 已有单独工具，这里做补充对比)
 * - 宠物保险 (Pet Insurance)
 * 
 * 数据来源：内置典型价格范围 + Cloudflare /crawl 或 Tavily 搜索实时信息
 */

const INSURANCE_DATA = {
  car: {
    name: '车险',
    emoji: '🚗',
    types: {
      ctp: {
        name: 'CTP / Green Slip（强制第三方人身伤害险）',
        mandatory: true,
        typical_cost: '$400 - $700/年（因州而异）',
        description: '强制保险，保护交通事故中受伤的人。',
        state_providers: {
          NSW: { name: 'Green Slip', providers: ['NRMA', 'QBE', 'AAMI', 'Allianz', 'GIO'], compare_url: 'https://www.greenslips.nsw.gov.au' },
          VIC: { name: 'TAC', providers: ['TAC (政府统一)'], compare_url: 'https://www.tac.vic.gov.au', note: 'VIC 的 CTP 包含在 rego 费用中' },
          QLD: { name: 'CTP', providers: ['RACQ', 'Suncorp', 'QBE', 'AAMI', 'Allianz'], compare_url: 'https://www.qld.gov.au/transport/registration/fees/ctp' },
          SA: { name: 'CTP', providers: ['CTP Fund (政府)'], compare_url: 'https://www.ctp.sa.gov.au', note: 'SA 的 CTP 由政府统一管理' },
          WA: { name: 'CTP', providers: ['ICWA (政府)'], compare_url: 'https://www.icwa.wa.gov.au', note: 'WA 的 CTP 包含在 rego 中' },
        },
        tips: [
          '每次续rego时CTP一起交',
          'NSW 是唯一可以比价选择CTP保险公司的州',
          'NSW 用 greenslips.nsw.gov.au 比价可省$50-200',
        ],
      },
      comprehensive: {
        name: '全险 (Comprehensive)',
        mandatory: false,
        typical_cost: '$800 - $2,500/年',
        factors: ['车型/年份', '驾驶年龄', '居住区域', '有无事故记录', 'excess 金额'],
        providers: [
          { name: 'NRMA', strong: 'NSW/ACT 最大', url: 'https://www.nrma.com.au/car-insurance' },
          { name: 'RACV', strong: 'VIC 最大', url: 'https://www.racv.com.au/car-insurance.html' },
          { name: 'RACQ', strong: 'QLD 最大', url: 'https://www.racq.com.au/car-insurance' },
          { name: 'Budget Direct', strong: '全澳最便宜之一', url: 'https://www.budgetdirect.com.au/car-insurance.html' },
          { name: 'AAMI', strong: '全澳广泛', url: 'https://www.aami.com.au/car-insurance.html' },
          { name: 'Woolworths Insurance', strong: '超市积分', url: 'https://www.woolworthsinsurance.com.au' },
        ],
        tips: [
          '留学生首选 Budget Direct 或 AAMI — 通常价格有竞争力',
          '提高 excess（自付额）从 $500 到 $1000 可省 20-30%',
          '安装 dashcam 可能获得折扣',
          '每年续保前 必须 比价！不同公司差价可达 $500+',
        ],
      },
      third_party: {
        name: '第三方财产险 (Third Party Property)',
        mandatory: false,
        typical_cost: '$200 - $500/年',
        description: '只保你撞到别人的车/财产，不保自己的车。预算有限的好选择。',
        tips: ['老车（5年+）考虑这种 — 全险可能比车值都贵'],
      },
    },
  },

  home: {
    name: '房屋保险',
    emoji: '🏠',
    types: {
      home_contents: {
        name: 'Home & Contents（自住房）',
        typical_cost: '$600 - $2,000/年',
        covers: ['火灾/洪水/风暴损失', '盗窃', '个人物品', '公共责任险'],
        providers: ['NRMA', 'AAMI', 'RACV', 'Allianz', 'Budget Direct', 'youi'],
      },
      renters: {
        name: 'Contents Insurance / 租客保险',
        typical_cost: '$15 - $30/月（$180-360/年）',
        covers: ['你的个人物品（手机/电脑/衣物/家具）', '被盗/火灾/水灾损坏', '意外损坏', '部分包含 portable items（手机外带）'],
        not_covered: ['房屋结构（那是房东的事）', '车内物品（需要车险）', '正常磨损'],
        providers: [
          { name: 'Budget Direct', price: '~$15/月', url: 'https://www.budgetdirect.com.au/contents-insurance.html' },
          { name: 'AAMI', price: '~$20/月', url: 'https://www.aami.com.au/home-insurance/contents.html' },
          { name: 'NRMA', price: '~$22/月', url: 'https://www.nrma.com.au/home-insurance/contents' },
          { name: 'Real Insurance', price: '~$18/月', url: 'https://www.realinsurance.com.au/contents-insurance' },
        ],
        tips: [
          '💡 租客 最应买 的保险！笔记本+手机被偷 = $3000+，保险一年才 $180',
          '留学生强烈建议购买 — 学生公寓/share house 盗窃常见',
          '注意 excess（自付额），通常 $200-500',
          '检查是否包含 Accidental Damage（意外损坏）',
          '部分房东 lease 要求租客必须买 Contents Insurance',
        ],
      },
    },
  },

  travel: {
    name: '旅行保险',
    emoji: '✈️',
    types: {
      domestic: {
        name: '澳洲境内旅行险',
        typical_cost: '$30 - $80/次',
        covers: ['航班取消/延误', '行李丢失', '紧急医疗（超出Medicare范围）', '冒险活动'],
        providers: ['Cover-More', 'World Nomads', 'Allianz', 'Budget Direct'],
      },
      international: {
        name: '国际旅行险（回中国/出境）',
        typical_cost: '$80 - $300/次（亚太）',
        covers: ['海外医疗（中国看病费 Medicare 不报销）', '航班取消', '行李/护照丢失', '紧急撤离'],
        must_have: ['回中国必须买！Medicare 只在少数互惠协议国可用（中国不在内）'],
        providers: [
          { name: 'Cover-More', strong: '最大', url: 'https://www.covermore.com.au' },
          { name: 'World Nomads', strong: '年轻人/背包客', url: 'https://www.worldnomads.com' },
          { name: 'Allianz', strong: '全面', url: 'https://www.allianzassistance.com.au' },
        ],
        tips: [
          '⚠️ 回中国一定要买！住院一天 = ¥5000+，没保险自付',
          'Medicare 在中国 完全不适用',
          '注意：大多数保险不覆盖已有疾病（pre-existing conditions）',
          '买机票时航空公司推的旅行险通常不划算，自己比价更便宜',
        ],
      },
    },
  },

  pet: {
    name: '宠物保险',
    emoji: '🐾',
    typical_cost: '$30 - $80/月',
    covers: ['兽医费用', '手术', '住院', '药物', '部分包含 dental'],
    providers: ['PetSure', 'Bow Wow', 'RSPCA Pet Insurance', 'Woolworths Pet', 'Budget Direct Pet'],
    tips: [
      '宠物看兽医很贵！一次急诊 $500-2000+',
      '越年轻买越便宜，等生病了就来不及了',
      '注意等待期（通常30天普通+6个月十字韧带等）',
    ],
  },
};

export async function compareInsurance(args, env) {
  const type = (args.type || args.category || 'overview').toLowerCase();
  const state = (args.state || '').toUpperCase();
  const situation = args.situation || '';

  // Overview mode
  if (type === 'overview' || type === 'all') {
    return {
      insurance_types: Object.entries(INSURANCE_DATA).map(([key, data]) => ({
        key,
        name: data.name,
        emoji: data.emoji,
        typical_cost: data.typical_cost || Object.values(data.types || {}).map(t => `${t.name}: ${t.typical_cost}`).join('; '),
      })),
      recommended_for_students: [
        '1️⃣ Contents Insurance（租客保险）— 保护个人物品 ~$15/月',
        '2️⃣ OSHC（已有单独工具查询） — 强制学生健康保险',
        '3️⃣ 旅行保险 — 回国时必买',
      ],
      recommended_for_pr: [
        '1️⃣ 车险 — 有车必买（CTP强制 + Comprehensive推荐）',
        '2️⃣ Home & Contents — 买房后必买',
        '3️⃣ Income Protection — 保护收入（贷款时银行可能要求）',
      ],
      tip: '查询具体保险类型请指定：car（车险）, home（房屋险）, travel（旅行险）, pet（宠物险）',
    };
  }

  const data = INSURANCE_DATA[type];
  if (!data) {
    return {
      error: `未知保险类型: ${type}`,
      available: Object.keys(INSURANCE_DATA),
    };
  }

  // 尝试 crawl 获取最新价格信息
  let liveInfo = null;
  try {
    const { crawlPage } = await import('./cf-crawl.js');
    const compareUrl = type === 'car' ? 'https://www.budgetdirect.com.au/car-insurance.html'
      : type === 'home' ? 'https://www.budgetdirect.com.au/contents-insurance.html'
      : type === 'travel' ? 'https://www.covermore.com.au'
      : null;
    if (compareUrl) {
      const page = await crawlPage(compareUrl, env, { maxLength: 1000 });
      if (page && !page.error) {
        liveInfo = { url: compareUrl, snippet: page.content?.substring(0, 300), source: 'Browser Rendering' };
      }
    }
  } catch {}

  return {
    type: data.name,
    emoji: data.emoji,
    ...data,
    state_info: state && data.types?.ctp?.state_providers?.[state] || null,
    live_info: liveInfo,
    general_tips: [
      '🔑 每年续保前必须比价 — 忠诚度不会给你折扣',
      '🔑 提高 excess（自付额）可以降低保费',
      '🔑 考虑 bundle（打包）— 同一公司买多种保险可能有折扣',
      '💡 免费比价网站: comparethemarket.com.au, iSelect.com.au, Canstar.com.au',
    ],
    compare_sites: [
      { name: 'Compare the Market', url: 'https://www.comparethemarket.com.au' },
      { name: 'iSelect', url: 'https://www.iselect.com.au' },
      { name: 'Canstar', url: 'https://www.canstar.com.au' },
    ],
  };
}
