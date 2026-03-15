/**
 * Fair Work Pay Rates Tool — Australian minimum wage & award rates
 * Built-in data from Fair Work Commission + web search for specific awards
 * 
 * Covers: national minimum wage, common industry award rates,
 * casual loading, penalty rates, junior rates
 */

// National Minimum Wage (effective 1 July 2025)
const NATIONAL_MINIMUM = {
  hourly: 24.10,
  weekly: 915.90,
  annual_fulltime: 47627, // 38hrs × 52wks
  effective_from: '2025-07-01',
  casual_loading: 25, // 25% casual loading
  casual_hourly: 30.13, // $24.10 × 1.25
};

// Common industry award minimum rates (2025-26, Level 1 adult)
const COMMON_AWARDS = {
  retail: {
    name: 'General Retail Industry Award 2020',
    code: 'MA000004',
    base_hourly: 25.46,
    casual_hourly: 31.83,
    saturday: 30.55, // 1.2x
    sunday: 35.65, // 1.4x (some clauses)
    public_holiday: 50.92, // 2x + loading
    levels: [
      { level: 1, hourly: 25.46, desc: 'Retail Employee Level 1' },
      { level: 2, hourly: 26.15, desc: 'Retail Employee Level 2 (experienced)' },
      { level: 3, hourly: 26.78, desc: 'Retail Employee Level 3 (supervisor)' },
    ],
  },
  hospitality: {
    name: 'Hospitality Industry (General) Award 2020',
    code: 'MA000009',
    base_hourly: 25.46,
    casual_hourly: 31.83,
    saturday: 30.55,
    sunday: 35.65,
    public_holiday: 50.92,
    levels: [
      { level: 1, hourly: 25.46, desc: 'Food & Beverage Attendant Grade 1' },
      { level: 2, hourly: 26.15, desc: 'Cook/Kitchen Attendant Grade 2' },
      { level: 3, hourly: 27.70, desc: 'Cook/Chef Grade 3' },
    ],
  },
  cleaning: {
    name: 'Cleaning Services Award 2020',
    code: 'MA000022',
    base_hourly: 25.46,
    casual_hourly: 31.83,
    levels: [
      { level: 1, hourly: 25.46, desc: 'Cleaning Services Employee Level 1' },
      { level: 2, hourly: 26.54, desc: 'Level 2 (window cleaning, etc.)' },
      { level: 3, hourly: 27.57, desc: 'Level 3 (supervisor)' },
    ],
  },
  fast_food: {
    name: 'Fast Food Industry Award 2010',
    code: 'MA000003',
    base_hourly: 25.46,
    casual_hourly: 31.83,
    levels: [
      { level: 1, hourly: 25.46, desc: 'Fast Food Employee Level 1' },
      { level: 2, hourly: 26.15, desc: 'Level 2 (shift supervisor)' },
      { level: 3, hourly: 27.19, desc: 'Level 3 (manager)' },
    ],
  },
  warehouse: {
    name: 'Storage Services and Wholesale Award 2020',
    code: 'MA000084',
    base_hourly: 26.03,
    casual_hourly: 32.54,
    levels: [
      { level: 1, hourly: 26.03, desc: 'Storeperson Grade 1' },
      { level: 2, hourly: 26.87, desc: 'Storeperson Grade 2 (forklift)' },
    ],
  },
  childcare: {
    name: 'Children\'s Services Award 2010',
    code: 'MA000120',
    base_hourly: 25.46,
    casual_hourly: 31.83,
    levels: [
      { level: 1, hourly: 25.46, desc: 'Support Worker Level 1' },
      { level: 3, hourly: 28.34, desc: 'Level 3 (Diploma qualified)' },
      { level: 4, hourly: 32.18, desc: 'Level 4 (Degree qualified teacher)' },
    ],
  },
  construction: {
    name: 'Building and Construction General On-site Award 2020',
    code: 'MA000020',
    base_hourly: 28.60,
    casual_hourly: 35.75,
    levels: [
      { level: 'CW1', hourly: 28.60, desc: 'Construction Worker Level 1 (new entrant)' },
      { level: 'CW3', hourly: 31.50, desc: 'CW3 (tradesperson)' },
      { level: 'CW5', hourly: 33.40, desc: 'CW5 (advanced tradesperson)' },
    ],
  },
  nursing: {
    name: 'Nurses Award 2020',
    code: 'MA000034',
    base_hourly: 30.72,
    casual_hourly: 38.40,
    levels: [
      { level: 'RN1', hourly: 30.72, desc: 'Registered Nurse Level 1 (pay point 1)' },
      { level: 'RN1.4', hourly: 33.80, desc: 'RN Level 1 (4+ years)' },
      { level: 'EN', hourly: 28.40, desc: 'Enrolled Nurse' },
    ],
  },
  it: {
    name: 'Professional Employees Award 2020',
    code: 'MA000065',
    base_hourly: 49350 / 52 / 38, // Approx
    levels: [
      { level: 1, hourly: 24.93, desc: 'Graduate (no experience)' },
      { level: 2, hourly: 29.54, desc: '1-2 years experience' },
      { level: 3, hourly: 35.12, desc: '3+ years experience' },
      { level: 4, hourly: 40.89, desc: 'Senior professional' },
    ],
  },
};

// Junior pay percentages (% of adult rate)
const JUNIOR_RATES = [
  { age: 'Under 16', percentage: 36.8 },
  { age: '16 years', percentage: 47.3 },
  { age: '17 years', percentage: 57.8 },
  { age: '18 years', percentage: 68.3 },
  { age: '19 years', percentage: 82.5 },
  { age: '20 years', percentage: 97.7 },
  { age: '21+', percentage: 100 },
];

export async function getPayRates(args, env) {
  const query = (args.query || args.industry || args.job || '').toLowerCase();
  const mode = args.mode || 'search';
  const age = args.age || null;

  // Mode: minimum — just return national minimum wage
  if (mode === 'minimum' || !query || query === 'minimum' || query === '最低工资') {
    const result = {
      national_minimum_wage: {
        ...NATIONAL_MINIMUM,
        note: '这是2025-26财年的国家最低工资标准。大多数行业的Award工资高于此标准。',
      },
      junior_rates: age ? calculateJuniorRate(age) : JUNIOR_RATES.map(r => ({
        ...r,
        hourly: (NATIONAL_MINIMUM.hourly * r.percentage / 100).toFixed(2),
      })),
      source: 'Fair Work Commission',
      url: 'https://www.fairwork.gov.au/pay-and-wages/minimum-wages',
      tips: [
        '试用期(probation)不能低于最低工资',
        'Casual员工有25%加载(casual loading)',
        '周末和公共假期有加班费(penalty rates)',
        '违法低薪可向Fair Work Ombudsman举报: 13 13 94',
      ],
    };
    return result;
  }

  // Mode: search — find matching award
  const matched = findAward(query);
  
  if (matched) {
    const award = COMMON_AWARDS[matched.key];
    return {
      award: award.name,
      award_code: award.code,
      industry: matched.key,
      base_hourly: award.base_hourly,
      casual_hourly: award.casual_hourly,
      weekly_fulltime: (award.base_hourly * 38).toFixed(2),
      annual_fulltime: (award.base_hourly * 38 * 52).toFixed(0),
      penalty_rates: {
        saturday: award.saturday ? `$${award.saturday}/hr` : 'Varies',
        sunday: award.sunday ? `$${award.sunday}/hr` : 'Varies',
        public_holiday: award.public_holiday ? `$${award.public_holiday}/hr` : 'Varies',
      },
      pay_levels: award.levels,
      national_minimum_comparison: {
        minimum_hourly: NATIONAL_MINIMUM.hourly,
        this_award_hourly: award.base_hourly,
        above_minimum_by: `$${(award.base_hourly - NATIONAL_MINIMUM.hourly).toFixed(2)}/hr`,
      },
      source: 'Fair Work Commission',
      url: `https://www.fairwork.gov.au/find-help-for/pay-and-wages`,
      calculator: 'https://calculate.fairwork.gov.au/',
      tips: [
        `${award.name} 最低时薪 $${award.base_hourly}`,
        `Casual员工时薪至少 $${award.casual_hourly}`,
        '如被欠薪，拨打Fair Work热线 13 13 94',
        '所有工资记录雇主必须保留7年',
      ],
    };
  }

  // No match found — try web search or return available industries
  return {
    query,
    matched: false,
    message: `未找到"${query}"的具体Award信息。`,
    available_industries: Object.entries(COMMON_AWARDS).map(([k, v]) => ({
      key: k,
      name: v.name,
      base_hourly: `$${v.base_hourly}`,
    })),
    national_minimum: NATIONAL_MINIMUM,
    tip: '可以使用 Fair Work Pay Calculator 查询准确的工资标准。',
    calculator: 'https://calculate.fairwork.gov.au/',
    fair_work_hotline: '13 13 94 (免费，提供中文翻译服务)',
    source: 'Fair Work Commission',
  };
}

function findAward(query) {
  const mapping = {
    retail: ['retail', 'shop', 'store', '零售', '商店', 'woolworths', 'coles', 'kmart', 'big w', 'target', 'jb hi-fi'],
    hospitality: ['hospitality', 'restaurant', 'cafe', 'bar', 'hotel', '餐厅', '酒店', '咖啡', 'waiter', 'barista', 'kitchen'],
    cleaning: ['cleaning', 'cleaner', '清洁', 'janitor'],
    fast_food: ['fast food', 'mcdonald', 'kfc', 'subway', 'hungry jack', 'domino', '快餐', 'pizza'],
    warehouse: ['warehouse', 'storage', 'logistics', '仓库', '物流', 'forklift', 'picker packer'],
    childcare: ['childcare', 'child care', 'kindergarten', 'early childhood', '幼儿园', 'nanny', 'daycare'],
    construction: ['construction', 'building', 'builder', 'carpenter', 'plumber', 'electrician', '建筑', '工地', 'tradesman'],
    nursing: ['nurse', 'nursing', 'aged care', '护士', '护理', 'healthcare worker', 'carer'],
    it: ['it', 'software', 'engineer', 'developer', 'programmer', '程序员', '码农', 'tech'],
  };

  for (const [key, keywords] of Object.entries(mapping)) {
    if (keywords.some(kw => query.includes(kw))) {
      return { key };
    }
  }
  return null;
}

function calculateJuniorRate(age) {
  const numAge = Number(age);
  const bracket = JUNIOR_RATES.find(r => {
    if (r.age === '21+') return numAge >= 21;
    if (r.age === 'Under 16') return numAge < 16;
    return r.age.includes(String(numAge));
  });
  
  if (!bracket) return null;
  
  return {
    age: bracket.age,
    percentage: bracket.percentage,
    minimum_hourly: (NATIONAL_MINIMUM.hourly * bracket.percentage / 100).toFixed(2),
    casual_hourly: (NATIONAL_MINIMUM.casual_hourly * bracket.percentage / 100).toFixed(2),
    note: bracket.percentage < 100
      ? `未满21岁员工工资为成人工资的${bracket.percentage}%。不少华人雇主违法支付低于此标准的工资。`
      : '21岁及以上必须支付全额成人工资。',
  };
}
