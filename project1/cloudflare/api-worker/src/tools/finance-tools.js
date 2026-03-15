/**
 * Finance Tools — 增强版金融工具集
 * 
 * 功能：
 *  1. 房贷计算器 — 还款计算 + 首套房优惠 + 印花税
 *  2. Super 基金比较 — 主流基金费用/回报对比
 *  3. 报税流程 — step-by-step 引导
 *  4. 会计/税务师推荐 — 华人区会计信息
 */

// ─── 1. 房贷计算器 + 首套房优惠 ───────────────────────────────────────────

const FIRST_HOME_BUYER = {
  federal: {
    fhog: {
      name: 'First Home Owner Grant (FHOG)',
      amount: '$10,000 (新建) / 部分州更高',
      eligibility: [
        '澳洲公民或PR',
        '年满18岁',
        '之前从未在澳洲拥有过房产',
        '房产为新建或大幅翻新的住宅',
        '必须自住（不能投资）至少6-12个月',
      ],
      by_state: {
        NSW: '$10,000 (新房价值 < $600,000, 或土地+建筑 < $750,000)',
        VIC: '$10,000 (新房 < $750,000, 区域 $750,000)',
        QLD: '$30,000 (新房 < $750,000) — 最高！',
        WA: '$10,000 (新房 < $750,000)',
        SA: '$15,000 (新房 < $575,000)',
        TAS: '$30,000 (新建)',
        ACT: '无 FHOG（但有印花税减免）',
        NT: '$10,000',
      },
    },
    fhss: {
      name: 'First Home Super Saver Scheme (FHSS)',
      desc: '可以从 Super 里取出自愿额外缴纳的部分（最多$50,000）用于首付',
      max: '$50,000',
      how: [
        '向 Super 基金做 voluntary contributions（salary sacrifice 或 after-tax）',
        '申请时向 ATO 申请释放资金',
        '享受 Super 的低税率优势（15% vs 个人边际税率）',
        '实际节省可能 $5,000-15,000+',
      ],
    },
    guarantee: {
      name: 'Home Guarantee Scheme',
      desc: '政府担保，5% 首付即可买房（免 LMI）',
      schemes: [
        { name: 'FHBG (First Home Buyer Guarantee)', deposit: '5%', cap_sydney: '$900,000', cap_melb: '$800,000', cap_other: '$600,000-700,000' },
        { name: 'Regional FHBG', deposit: '5%', desc: '区域地区购房额外名额' },
        { name: 'Family Home Guarantee', deposit: '2%', desc: '单亲家庭仅需 2% 首付' },
      ],
    },
  },
  stamp_duty: {
    NSW: { threshold: 800000, exempt_below: 650000, note: 'FHB stamp duty exempt < $650K, concession $650K-$800K. surcharge外国人8%' },
    VIC: { threshold: 750000, exempt_below: 600000, note: 'FHB exempt < $600K, concession $600K-$750K. 外国人surcharge 8%' },
    QLD: { threshold: 700000, exempt_below: 500000, note: 'FHB concession < $500K ($8,750 saved), partial $500K-$550K' },
    WA: { threshold: 530000, exempt_below: 430000, note: 'FHB exempt < $430K. Off-plan exempt < $750K' },
    SA: { threshold: null, exempt_below: null, note: '无 FHB 印花税减免。但 FHOG $15,000 补偿' },
    ACT: { threshold: null, exempt_below: null, note: 'FHB 可申请 Home Buyer Concession Scheme (完全免除印花税，收入限制 $160K个人/$227K家庭)' },
  },
};

function calculateMortgage(args) {
  const price = args.price || args.amount || 500000;
  const deposit = args.deposit || Math.round(price * 0.2);
  const depositPercent = (deposit / price * 100).toFixed(1);
  const loan = price - deposit;
  const rate = args.rate || 6.2; // % p.a.
  const years = args.years || 30;

  const r = rate / 100 / 12;
  const n = years * 12;
  const monthly = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = monthly * n;
  const totalInterest = totalPayment - loan;

  // LMI estimate (if deposit < 20%)
  let lmi = 0;
  if (deposit / price < 0.2) {
    const lvr = (loan / price) * 100;
    if (lvr > 95) lmi = loan * 0.04;
    else if (lvr > 90) lmi = loan * 0.025;
    else if (lvr > 85) lmi = loan * 0.015;
    else lmi = loan * 0.008;
  }

  const state = (args.state || 'NSW').toUpperCase();
  const isFirstHome = args.first_home !== false;
  const stampDutyInfo = FIRST_HOME_BUYER.stamp_duty[state];
  
  // Rough stamp duty calc
  let stampDuty = 0;
  if (price <= 100000) stampDuty = price * 0.0125;
  else if (price <= 300000) stampDuty = 1250 + (price - 100000) * 0.015;
  else if (price <= 1000000) stampDuty = 4250 + (price - 300000) * 0.035;
  else stampDuty = 28750 + (price - 1000000) * 0.045;

  if (isFirstHome && stampDutyInfo?.exempt_below && price <= stampDutyInfo.exempt_below) {
    stampDuty = 0;
  }

  return {
    type: 'mortgage_calculator',
    property_price: `$${price.toLocaleString()}`,
    deposit: `$${deposit.toLocaleString()} (${depositPercent}%)`,
    loan_amount: `$${loan.toLocaleString()}`,
    interest_rate: `${rate}% p.a.`,
    term: `${years} years`,
    repayments: {
      monthly: `$${Math.round(monthly).toLocaleString()}`,
      fortnightly: `$${Math.round(monthly / 2).toLocaleString()}`,
      weekly: `$${Math.round(monthly / 4.33).toLocaleString()}`,
    },
    total_cost: `$${Math.round(totalPayment).toLocaleString()}`,
    total_interest: `$${Math.round(totalInterest).toLocaleString()}`,
    upfront_costs: {
      deposit: `$${deposit.toLocaleString()}`,
      stamp_duty: `$${Math.round(stampDuty).toLocaleString()}${isFirstHome && stampDuty === 0 ? ' (首套房免印花税!)' : ''}`,
      lmi: lmi > 0 ? `$${Math.round(lmi).toLocaleString()} (首付<20%需付LMI)` : '$0 (首付≥20%免LMI)',
      conveyancing: '$1,500-3,000 (律师/过户费)',
      building_inspection: '$400-800',
      total_estimate: `$${Math.round(deposit + stampDuty + lmi + 2500).toLocaleString()} (估算)`,
    },
    stamp_duty_note: stampDutyInfo?.note || '',
    first_home_grants: isFirstHome ? FIRST_HOME_BUYER.federal : null,
    tips: [
      '📅 每两周还一次比每月还更省利息（年均多还约1个月）',
      '💡 有 Offset Account 的贷款可以用存款抵扣利息',
      '🏠 首付 ≥ 20% 免 LMI（可省 $5,000-40,000）',
      '📊 Comparison rate 比 headline rate 更真实反映贷款成本',
      state === 'QLD' ? '🎉 QLD 首套房补贴最高 $30,000！' : null,
    ].filter(Boolean),
    source: 'Estimate based on standard calculation. Consult a broker for exact figures.',
  };
}

// ─── 2. Super 基金比较 ───────────────────────────────────────────

const SUPER_FUNDS = [
  { name: 'AustralianSuper', type: 'Industry', members: '3.3M', size: '$330B', option: 'Balanced', return_10yr: '8.52%', fee_50k: '$337/yr', fee_100k: '$537/yr', insurance: '✅', app: '✅', ethical: '✅ option', note: '澳洲最大Super，费用低回报好' },
  { name: 'Aware Super', type: 'Industry', members: '1.1M', size: '$165B', option: 'Growth', return_10yr: '8.33%', fee_50k: '$367/yr', fee_100k: '$617/yr', insurance: '✅', app: '✅', ethical: '✅ option', note: '前First State Super，公共部门常见' },
  { name: 'UniSuper', type: 'Industry', members: '620K', size: '$120B', option: 'Balanced', return_10yr: '7.98%', fee_50k: '$314/yr', fee_100k: '$489/yr', insurance: '✅', app: '✅', ethical: '✅ option', note: '大学/高教行业默认基金' },
  { name: 'Hostplus', type: 'Industry', members: '1.8M', size: '$115B', option: 'Balanced', return_10yr: '8.42%', fee_50k: '$321/yr', fee_100k: '$471/yr', insurance: '✅', app: '✅', ethical: '❌', note: '餐饮/酒店行业默认，回报优秀' },
  { name: 'REST', type: 'Industry', members: '2M', size: '$80B', option: 'Core Strategy', return_10yr: '7.60%', fee_50k: '$357/yr', fee_100k: '$607/yr', insurance: '✅', app: '✅', ethical: '✅', note: '零售行业默认，Woolworths/Coles 员工' },
  { name: 'Sunsuper (merged→ART)', type: 'Industry', members: '2.3M', size: '$280B', option: 'Balanced', return_10yr: '8.10%', fee_50k: '$340/yr', fee_100k: '$540/yr', insurance: '✅', app: '✅', ethical: '✅', note: 'Australian Retirement Trust (合并后)' },
  { name: 'HESTA', type: 'Industry', members: '1M', size: '$75B', option: 'Balanced Growth', return_10yr: '8.21%', fee_50k: '$352/yr', fee_100k: '$602/yr', insurance: '✅', app: '✅', ethical: '✅', note: '医疗/养老院行业' },
  { name: 'Spaceship', type: 'Retail', members: '200K', size: '$3B', option: 'Growth X', return_10yr: 'N/A (新)', fee_50k: '$0', fee_100k: '$0', insurance: '❌', app: '✅', ethical: '✅', note: '年轻人欢迎，科技股偏重，无管理费（<$10K）' },
];

function compareSuperFunds(args) {
  const balance = args.balance || 50000;
  const feeKey = balance >= 100000 ? 'fee_100k' : 'fee_50k';
  
  return {
    type: 'super_fund_comparison',
    your_balance: `$${balance.toLocaleString()}`,
    funds: SUPER_FUNDS.map(f => ({
      name: f.name,
      type: f.type,
      default_option: f.option,
      return_10yr: f.return_10yr,
      annual_fee: f[feeKey],
      has_insurance: f.insurance,
      has_app: f.app,
      ethical_option: f.ethical,
      note: f.note,
    })),
    key_metrics: {
      lowest_fee: SUPER_FUNDS.reduce((a, b) => a[feeKey] < b[feeKey] ? a : b).name,
      highest_return: SUPER_FUNDS.filter(f => f.return_10yr !== 'N/A (新)').reduce((a, b) => parseFloat(a.return_10yr) > parseFloat(b.return_10yr) ? a : b).name,
    },
    consolidation_guide: {
      title: '合并 Super 基金（Consolidate）',
      steps: [
        '1️⃣ 登录 myGov → ATO → Super → "Manage my super"',
        '2️⃣ 可以看到你的所有 Super 账户',
        '3️⃣ 选择要保留的基金 → "Transfer super"',
        '4️⃣ 合并后只交一份管理费',
      ],
      warning: '⚠️ 合并前检查：旧基金的保险（death/TPD/income protection）会被取消！确保新基金有等同保险。',
    },
    tips: [
      '🔑 选基金看: 10年回报 > 费用 > 保险 > App体验',
      '📊 Industry Fund 通常费用低、回报高于 Retail Fund',
      '💼 换工作时注意默认Super — 可以坚持用自己选的基金',
      '🎓 留学生/临时签证: Super在离开澳洲后可申请退还 (DASP)',
      '📱 用 ATO 的 YourSuper comparison tool: ato.gov.au/calculators-and-tools',
    ],
    source: 'SuperRatings, fund annual reports 2024-2025. Fees and returns are estimates.',
  };
}

// ─── 3. 报税流程 ───────────────────────────────────────────

const TAX_GUIDE = {
  title: '📋 澳洲个人报税完整指南',
  financial_year: '2025-26 (1 July 2025 - 30 June 2026)',
  deadline: '31 October 2026（自己报）/ 延期至 May 2027（通过Tax Agent）',
  
  who_needs_to: [
    '在澳洲有收入的每个人（包括留学生打工）',
    '拿到 ABN 做 freelance/Uber 的人',
    '有利息/股息/rental income 的人',
    '即使收入为 $0 也建议报（可能有退税）',
  ],

  tax_rates: [
    { bracket: '$0 - $18,200', rate: '0%', tax: '$0', note: '免税额' },
    { bracket: '$18,201 - $45,000', rate: '16%', tax: '16c per $1 over $18,200', note: '2024-25新税率（原19%）' },
    { bracket: '$45,001 - $135,000', rate: '30%', tax: '$4,288 + 30c per $1 over $45,000', note: '' },
    { bracket: '$135,001 - $190,000', rate: '37%', tax: '$31,288 + 37c per $1 over $135,000', note: '' },
    { bracket: '$190,001+', rate: '45%', tax: '$51,638 + 45c per $1 over $190,000', note: '' },
  ],

  steps: [
    { step: 1, title: '准备资料', details: [
      '✅ TFN (Tax File Number) — 没有的话先申请',
      '✅ myGov 账号 + 关联 ATO',
      '✅ PAYG Payment Summary (收入证明) — 雇主已上传到 ATO，myTax 自动预填',
      '✅ 银行利息证明（银行会自动报给 ATO）',
      '✅ 所有能抵税的收据（work-from-home, 工具, 制服, 培训）',
      '✅ 私人健康保险证明（有的话）',
    ]},
    { step: 2, title: '登录 myTax（免费在线报税）', details: [
      '🌐 登录 my.gov.au → ATO → Lodge → myTax',
      '📅 7月中旬开始可以报（等雇主提交数据）',
      '⏰ 建议 8-9 月报（数据已齐全 + 退税更快到）',
      '⚡ myTax 会自动预填大部分收入（工资、利息、股息）',
    ]},
    { step: 3, title: '填写收入', details: [
      '工资收入 — 自动预填',
      '银行利息 — 自动预填',
      '其他收入 — Uber/freelance/ABN 收入需手动填',
      '海外收入 — 包括中国的收入（如果是税务居民）',
      '留学生：仅报澳洲收入（通常是 non-resident for tax purposes）',
    ]},
    { step: 4, title: '填写抵扣 (Deductions)', details: [
      '🏠 Work from home: fixed rate $0.67/hr (需记录时间)',
      '🚗 Work-related travel: $0.85/km (logbook方法可能更多)',
      '📱 手机/网络: 工作使用比例可抵',
      '👔 制服/工具/安全装备: 100%可抵',
      '📚 工作相关培训/课程: 可抵',
      '🏥 私人健康保险: 可减少 Medicare Levy Surcharge',
      '💰 Super额外缴纳: 可抵（salary sacrifice 或 personal contribution）',
      '⚠️ 所有抵扣需有收据/证据！<$300 不需要单独证明但总额需合理',
    ]},
    { step: 5, title: '提交 + 收退税', details: [
      '检查所有信息 → Submit',
      '⏱️ 退税通常 2-4 周到银行账户',
      '如果欠税 → 有还款计划选项',
      '📧 Notice of Assessment 会发到 myGov inbox',
    ]},
  ],

  common_mistakes: [
    '❌ 忘记报 Uber/外卖/freelance 收入（ATO 会查）',
    '❌ 虚报抵扣（没有收据的不要报）',
    '❌ 留学生多报了中国收入（non-resident 只需报澳洲收入）',
    '❌ 没有 claim work from home（很多人漏了）',
    '❌ 多个 Super fund 没合并（多交管理费）',
  ],
};

function getTaxGuide(args) {
  const topic = (args.topic || '').toLowerCase();
  
  if (/rate|税率|bracket/.test(topic)) {
    return {
      type: 'tax_rates',
      ...TAX_GUIDE,
      steps: undefined,
      common_mistakes: undefined,
    };
  }
  
  if (/deduction|抵扣|退税|claim/.test(topic)) {
    return {
      type: 'tax_deductions',
      title: '💰 常见抵扣项目',
      deductions: TAX_GUIDE.steps[3],
      tips: [
        '所有抵扣需要 "directly related to earning income"',
        '混合用途（工作+私人）只能 claim 工作比例',
        'ATO 有 myDeductions app 帮你全年记录收据',
      ],
    };
  }

  return {
    type: 'tax_guide_full',
    ...TAX_GUIDE,
  };
}

// ─── 4. 会计/税务师推荐 ───────────────────────────────────────────

const TAX_AGENTS = {
  when_to_use: [
    '收入来源复杂（工资 + ABN + 投资 + 海外）',
    '有投资房/股票/加密货币',
    '第一次在澳洲报税（不确定规则）',
    '想最大化退税（Tax Agent 知道所有合法抵扣）',
    '收到 ATO 审查通知',
    'Tax Agent 报税截止延到次年3-5月（更多时间）',
  ],
  cost: '$100-300（个人简单报税）/ $300-800（复杂情况）/ $500-2000+（投资/小生意）',
  fee_note: 'Tax Agent 费用本身可以在下一年报税时抵扣！',
  
  chinese_agents: {
    sydney: [
      { name: '信达会计事务所 (Xinda)', area: 'Chatswood / CBD', services: '个人报税, 公司税务, BAS, 小生意', lang: 'Mandarin/Cantonese/English' },
      { name: '澳信会计 (Ausino)', area: 'Hurstville', services: '个人/公司报税, ABN注册, Uber报税', lang: 'Mandarin/English' },
      { name: 'H&R Block (部分门店有中文)', area: '全国连锁', services: '标准个人报税', lang: '看门店', note: '大型连锁，服务标准化' },
    ],
    melbourne: [
      { name: '华信会计 (Hua Xin)', area: 'Box Hill / CBD', services: '个人/公司报税, 投资房', lang: 'Mandarin/Cantonese/English' },
      { name: '安信会计 (An Xin)', area: 'Glen Waverley', services: '个人报税, Super退税(DASP)', lang: 'Mandarin/English' },
    ],
    brisbane: [
      { name: '澳华会计 (Ao Hua)', area: 'Sunnybank', services: '个人/公司报税, ABN', lang: 'Mandarin/English' },
    ],
    online: [
      { name: 'TaxFox', desc: '在线报税平台，$79起，自动匹配抵扣', url: 'taxfox.com.au' },
      { name: 'Etax', desc: '在线报税，$69起，简单操作', url: 'etax.com.au' },
      { name: 'H&R Block Online', desc: '$0起（简单）/ $99+', url: 'hrblock.com.au' },
    ],
  },
  
  find_registered: {
    desc: '确认 Tax Agent 是否注册（必须注册才能合法帮你报税）',
    url: 'https://www.tpb.gov.au/registrations-search',
    note: '在 Tax Practitioners Board 网站搜索 Agent 的名字/ABN',
  },
};

function getAccountantInfo(args) {
  const city = (args.city || args.location || 'sydney').toLowerCase();
  
  return {
    type: 'tax_agent_recommendation',
    when_to_use: TAX_AGENTS.when_to_use,
    cost: TAX_AGENTS.cost,
    fee_note: TAX_AGENTS.fee_note,
    chinese_agents_nearby: TAX_AGENTS.chinese_agents[city] || TAX_AGENTS.chinese_agents.sydney,
    online_options: TAX_AGENTS.chinese_agents.online,
    verify_agent: TAX_AGENTS.find_registered,
    diy_alternative: {
      tool: 'myTax (my.gov.au)',
      cost: 'Free',
      best_for: '简单工资收入 + 银行利息',
      note: '大多数留学生/打工人自己用 myTax 就够了',
    },
    disclaimer: '⚠️ 以上会计信息仅供参考，不构成推荐。请自行验证其注册状态和服务质量。',
  };
}

// ─── 主路由 ───────────────────────────────────────────

/**
 * Finance Tools — 增强版
 * 
 * @param {Object} args
 * @param {string} args.action - 'mortgage' | 'super' | 'tax_guide' | 'accountant' | 'first_home'
 * @param {number} args.price - 房价（mortgage用）
 * @param {number} args.deposit - 首付（mortgage用）
 * @param {number} args.balance - Super余额
 * @param {string} args.state - 州
 * @param {string} args.topic - 细分主题
 * @param {string} args.city - 城市（accountant用）
 */
export async function financeTools(args) {
  const action = args.action || 'mortgage';

  switch (action) {
    case 'mortgage':
    case 'home_loan':
    case '房贷':
      return calculateMortgage(args);

    case 'first_home':
    case '首套房':
      return {
        type: 'first_home_buyer_guide',
        ...FIRST_HOME_BUYER.federal,
        stamp_duty: FIRST_HOME_BUYER.stamp_duty,
        tips: [
          '🏠 首套房有很多优惠，不要错过！',
          '📋 先申请 Home Guarantee Scheme — 5% 首付免 LMI',
          '💰 QLD 首套房补贴最高 $30,000',
          '🏦 考虑 FHSS — 从 Super 取钱做首付',
          '📞 找 Mortgage Broker（免费，银行付佣金）比直接找银行更好',
        ],
      };

    case 'super':
    case '养老金':
      return compareSuperFunds(args);

    case 'tax_guide':
    case '报税':
      return getTaxGuide(args);

    case 'accountant':
    case '会计':
    case 'tax_agent':
      return getAccountantInfo(args);

    default:
      return {
        type: 'finance_tools_menu',
        available: [
          { action: 'mortgage', desc: '房贷计算器（含首付、印花税、LMI）' },
          { action: 'first_home', desc: '首套房优惠（FHOG/FHSS/Home Guarantee）' },
          { action: 'super', desc: 'Super基金比较（8大基金费用/回报）' },
          { action: 'tax_guide', desc: '报税流程指南（step-by-step + 常见抵扣）' },
          { action: 'accountant', desc: '华人会计推荐（Sydney/Melbourne/Brisbane）' },
        ],
      };
  }
}
