/**
 * Bank Rates Tool — RBA 利率 + 各大银行存贷款利率对比
 * 
 * 数据源: RBA, 各银行官网 (2024-2025)
 * 更新时间: 每次RBA会议后手动更新或通过API
 */

const RBA = {
  cash_rate: 4.10,
  effective_date: '2024-11-06',
  next_meeting: '2025-02-18',
  history: [
    { date: '2024-11-06', rate: 4.35 },
    { date: '2024-06-18', rate: 4.35 },
    { date: '2023-11-08', rate: 4.35 },
    { date: '2023-06-07', rate: 4.10 },
    { date: '2023-05-03', rate: 3.85 },
    { date: '2022-11-02', rate: 2.85 },
    { date: '2022-05-04', rate: 0.35 },
    { date: '2020-11-04', rate: 0.10 }
  ],
  current_rate: 4.35,
  note: 'RBA cash rate target as of Nov 2024. Rates subject to change.'
};

// 主要银行房贷利率 (variable, p.a.)
const MORTGAGE_RATES = {
  variable: [
    { bank: 'Commonwealth Bank (CBA)', rate: 6.49, comparison: 6.54, type: 'Variable', feature: 'Standard Variable', min_deposit: '20%' },
    { bank: 'Westpac', rate: 6.54, comparison: 6.59, type: 'Variable', feature: 'Flexi First Option', min_deposit: '20%' },
    { bank: 'ANZ', rate: 6.49, comparison: 6.54, type: 'Variable', feature: 'Standard Variable', min_deposit: '20%' },
    { bank: 'NAB', rate: 6.49, comparison: 6.54, type: 'Variable', feature: 'Base Variable', min_deposit: '20%' },
    { bank: 'Macquarie', rate: 6.15, comparison: 6.16, type: 'Variable', feature: 'Basic Home Loan', min_deposit: '30%' },
    { bank: 'ING', rate: 5.99, comparison: 6.01, type: 'Variable', feature: 'Orange Advantage', min_deposit: '20%' },
    { bank: 'Ubank', rate: 5.89, comparison: 5.91, type: 'Variable', feature: 'Neat Home Loan', min_deposit: '20%' },
    { bank: 'Athena', rate: 5.85, comparison: 5.85, type: 'Variable', feature: 'Straight Up', min_deposit: '20%' }
  ],
  fixed_2yr: [
    { bank: 'CBA', rate: 5.99, comparison: 6.35, type: '2yr Fixed', feature: 'Fixed Rate', min_deposit: '20%' },
    { bank: 'Westpac', rate: 5.89, comparison: 6.40, type: '2yr Fixed', feature: 'Fixed', min_deposit: '20%' },
    { bank: 'ANZ', rate: 5.94, comparison: 6.38, type: '2yr Fixed', feature: 'Fixed', min_deposit: '20%' },
    { bank: 'NAB', rate: 5.89, comparison: 6.30, type: '2yr Fixed', feature: 'Fixed', min_deposit: '20%' },
    { bank: 'Macquarie', rate: 5.69, comparison: 6.10, type: '2yr Fixed', feature: 'Fixed', min_deposit: '30%' }
  ]
};

// 储蓄账户利率
const SAVINGS_RATES = [
  { bank: 'ING', product: 'Savings Maximiser', rate: 5.50, bonus: 5.00, conditions: 'Deposit $1000+/month, 5 card purchases', max_balance: 'Unlimited' },
  { bank: 'Ubank', product: 'Save Account', rate: 5.50, bonus: 5.00, conditions: 'Deposit $200+/month', max_balance: '$250,000' },
  { bank: 'Macquarie', product: 'Savings Account', rate: 5.35, bonus: 4.85, conditions: 'Deposit $200+/month, no withdrawals', max_balance: '$250,000' },
  { bank: 'BOQ', product: 'Future Saver', rate: 5.30, bonus: 4.80, conditions: 'Under 25, deposit $1000+/month', max_balance: '$50,000' },
  { bank: 'CBA', product: 'NetBank Saver', rate: 5.10, bonus: 4.55, conditions: 'Grow balance monthly', max_balance: '$50,000' },
  { bank: 'Westpac', product: 'Life', rate: 5.00, bonus: 4.50, conditions: 'Under 30 years, deposit $2000+/month', max_balance: '$30,000' },
  { bank: 'ANZ', product: 'Plus Save', rate: 4.90, bonus: 4.40, conditions: 'Grow balance, 5 purchases', max_balance: '$250,000' },
  { bank: 'NAB', product: 'iSaver', rate: 5.10, bonus: 4.55, conditions: 'Deposit $200+/month', max_balance: '$100,000' }
];

// 定期存款利率
const TERM_DEPOSITS = [
  { bank: 'Judo Bank', term: '12 months', rate: 5.00, min: 1000 },
  { bank: 'Macquarie', term: '12 months', rate: 4.75, min: 5000 },
  { bank: 'ING', term: '12 months', rate: 4.50, min: 5000 },
  { bank: 'CBA', term: '12 months', rate: 4.25, min: 5000 },
  { bank: 'Westpac', term: '12 months', rate: 4.15, min: 5000 },
  { bank: 'ANZ', term: '12 months', rate: 4.15, min: 5000 },
  { bank: 'NAB', term: '12 months', rate: 4.15, min: 5000 },
  { bank: 'Judo Bank', term: '6 months', rate: 5.15, min: 1000 },
  { bank: 'Macquarie', term: '6 months', rate: 4.70, min: 5000 },
  { bank: 'CBA', term: '6 months', rate: 4.15, min: 5000 },
  { bank: 'Judo Bank', term: '3 months', rate: 5.10, min: 1000 },
  { bank: 'Macquarie', term: '3 months', rate: 4.55, min: 5000 }
];

export async function getBankRates(args) {
  const query = (args.query || args.type || '').toLowerCase();

  // Mortgage specific query
  if (/mortgage|房贷|贷款|home loan|housing/.test(query)) {
    return handleMortgage(args);
  }

  // Savings specific query
  if (/savings?|存款|储蓄|利息|interest/.test(query)) {
    return handleSavings(args);
  }

  // Term deposit
  if (/term|定期|定存|fixed deposit/.test(query)) {
    return handleTermDeposit(args);
  }

  // RBA rate history
  if (/rba|央行|基准|cash rate|历史|history/.test(query)) {
    return {
      type: 'rba_rate',
      current: `${RBA.current_rate}%`,
      effective_date: RBA.effective_date,
      next_meeting: RBA.next_meeting,
      history: RBA.history,
      outlook: 'Market pricing suggests potential rate cuts in 2025, but timing remains uncertain.',
      source: 'Reserve Bank of Australia'
    };
  }

  // Default: overview of all
  return {
    type: 'overview',
    rba: {
      cash_rate: `${RBA.current_rate}%`,
      effective: RBA.effective_date,
      next_meeting: RBA.next_meeting
    },
    mortgage_snapshot: {
      big4_average: `~${((MORTGAGE_RATES.variable[0].rate + MORTGAGE_RATES.variable[1].rate + MORTGAGE_RATES.variable[2].rate + MORTGAGE_RATES.variable[3].rate) / 4).toFixed(2)}% variable`,
      lowest_variable: `${MORTGAGE_RATES.variable.reduce((a, b) => a.rate < b.rate ? a : b).rate}% (${MORTGAGE_RATES.variable.reduce((a, b) => a.rate < b.rate ? a : b).bank})`,
      lowest_2yr_fixed: `${MORTGAGE_RATES.fixed_2yr.reduce((a, b) => a.rate < b.rate ? a : b).rate}% (${MORTGAGE_RATES.fixed_2yr.reduce((a, b) => a.rate < b.rate ? a : b).bank})`
    },
    savings_snapshot: {
      highest: `${SAVINGS_RATES[0].rate}% (${SAVINGS_RATES[0].bank} ${SAVINGS_RATES[0].product})`,
      big4_range: `${Math.min(...SAVINGS_RATES.filter(s => ['CBA', 'Westpac', 'ANZ', 'NAB'].includes(s.bank)).map(s => s.rate))}% - ${Math.max(...SAVINGS_RATES.filter(s => ['CBA', 'Westpac', 'ANZ', 'NAB'].includes(s.bank)).map(s => s.rate))}%`
    },
    term_deposit_snapshot: {
      best_12mo: `${TERM_DEPOSITS.filter(t => t.term === '12 months')[0].rate}% (${TERM_DEPOSITS.filter(t => t.term === '12 months')[0].bank})`
    },
    tips: [
      'Compare rates at https://www.canstar.com.au',
      'Variable rates change with RBA decisions; fixed rates lock in your rate',
      'Offset accounts can reduce interest on your mortgage',
      'High-interest savings usually have conditions (deposits, card usage)'
    ],
    source: 'Bank published rates, 2024-2025 estimates'
  };
}

function handleMortgage(args) {
  const amount = args.amount || 500000;
  const years = args.years || 30;
  const type = /fixed|固定/.test(args.query || '') ? 'fixed' : 'variable';

  const rates = type === 'fixed' ? MORTGAGE_RATES.fixed_2yr : MORTGAGE_RATES.variable;
  const cheapest = rates.reduce((a, b) => a.rate < b.rate ? a : b);

  // Monthly repayment calculation
  function calcMonthly(principal, annualRate, years) {
    const r = annualRate / 100 / 12;
    const n = years * 12;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const comparisons = rates.map(r => {
    const monthly = calcMonthly(amount, r.rate, years);
    return {
      bank: r.bank,
      rate: `${r.rate}%`,
      comparison_rate: `${r.comparison}%`,
      monthly_repayment: `$${Math.round(monthly).toLocaleString()}`,
      total_cost: `$${(Math.round(monthly) * years * 12).toLocaleString()}`,
      total_interest: `$${(Math.round(monthly) * years * 12 - amount).toLocaleString()}`
    };
  });

  return {
    type: 'mortgage_comparison',
    loan_amount: `$${amount.toLocaleString()}`,
    term: `${years} years`,
    rate_type: type,
    rba_cash_rate: `${RBA.current_rate}%`,
    comparisons,
    best_deal: {
      bank: cheapest.bank,
      rate: `${cheapest.rate}%`,
      monthly: `$${Math.round(calcMonthly(amount, cheapest.rate, years)).toLocaleString()}`,
      vs_worst_annual_saving: `$${Math.round((calcMonthly(amount, rates[rates.length - 1].rate, years) - calcMonthly(amount, cheapest.rate, years)) * 12).toLocaleString()}`
    },
    tips: [
      `RBA cash rate is ${RBA.current_rate}% — affects variable rates directly`,
      'Compare comparison rates, not just headline rates',
      'Consider offset accounts to reduce interest',
      'First home buyers may qualify for government grants and stamp duty concessions',
      'Refinancing can save thousands — review your rate annually'
    ],
    tools: {
      calculator: 'https://www.moneysmart.gov.au/tools-and-resources/calculators-and-apps/mortgage-calculator',
      compare: 'https://www.canstar.com.au/home-loans/'
    },
    source: 'Bank published rates, estimates as of late 2024'
  };
}

function handleSavings(args) {
  const amount = args.amount || 10000;

  const comparisons = SAVINGS_RATES.map(s => ({
    bank: s.bank,
    product: s.product,
    total_rate: `${s.rate}%`,
    base_rate: `${(s.rate - s.bonus).toFixed(2)}%`,
    bonus_rate: `${s.bonus}%`,
    conditions: s.conditions,
    max_balance: s.max_balance,
    annual_interest: `$${(amount * s.rate / 100).toFixed(2)} (on $${amount.toLocaleString()})`
  }));

  return {
    type: 'savings_comparison',
    deposit_amount: `$${amount.toLocaleString()}`,
    comparisons,
    best_rate: {
      bank: SAVINGS_RATES[0].bank,
      rate: `${SAVINGS_RATES[0].rate}%`,
      annual_earned: `$${(amount * SAVINGS_RATES[0].rate / 100).toFixed(2)}`,
      conditions: SAVINGS_RATES[0].conditions
    },
    tips: [
      'Bonus rates require meeting conditions each month',
      'Interest earned is taxable income',
      'Big 4 banks are safe but often have lower rates',
      'Consider spreading across multiple banks for APRA $250k guarantee',
      'High-yield accounts often cap the balance that earns bonus rate'
    ],
    source: 'Bank published rates, 2024-2025 estimates'
  };
}

function handleTermDeposit(args) {
  const amount = args.amount || 10000;
  const term = args.term || '12 months';

  const termFilter = /3.month|3个月|quarter/.test(term) ? '3 months' : 
                     /6.month|6个月|half/.test(term) ? '6 months' : '12 months';

  const filtered = TERM_DEPOSITS.filter(t => t.term === termFilter);
  const comparisons = filtered.map(t => ({
    bank: t.bank,
    term: t.term,
    rate: `${t.rate}%`,
    min_deposit: `$${t.min.toLocaleString()}`,
    interest_earned: `$${(amount * t.rate / 100 * (termFilter === '12 months' ? 1 : termFilter === '6 months' ? 0.5 : 0.25)).toFixed(2)}`,
    maturity_value: `$${(amount + amount * t.rate / 100 * (termFilter === '12 months' ? 1 : termFilter === '6 months' ? 0.5 : 0.25)).toFixed(2)}`
  }));

  return {
    type: 'term_deposit_comparison',
    deposit_amount: `$${amount.toLocaleString()}`,
    term: termFilter,
    comparisons,
    tips: [
      'Early withdrawal penalties usually apply',
      'Interest is taxable — declare on your tax return',
      'Consider laddering (multiple terms) for flexibility',
      'Compare with high-yield savings for liquidity'
    ],
    source: 'Bank published rates, 2024-2025 estimates'
  };
}
