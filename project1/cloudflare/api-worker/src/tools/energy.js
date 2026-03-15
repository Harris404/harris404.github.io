/**
 * Energy Price Comparison Tool — 各州电费/气费对比
 * 
 * 数据源: Australian Energy Regulator (AER), state regulators
 * 2024-2025 default market offer rates
 */

// 各州常见电力零售商 & 参考价格 (cents/kWh, $/day supply charge)
const ELECTRICITY = {
  nsw: {
    state: 'New South Wales',
    state_cn: '新南威尔士',
    reference_price: { usage: 36.07, supply: 1.148, annual_benchmark: 1779 }, // DMO 2024-25
    retailers: [
      { name: 'Origin Energy', plan: 'Basic', usage: 33.99, supply: 1.01, discount: '6% off ref' },
      { name: 'AGL', plan: 'Essentials', usage: 34.32, supply: 1.06, discount: '5% off ref' },
      { name: 'EnergyAustralia', plan: 'Basic Home', usage: 35.10, supply: 1.10, discount: '3% off ref' },
      { name: 'Alinta Energy', plan: 'No Frills', usage: 32.50, supply: 0.99, discount: '10% off ref' },
      { name: 'Red Energy', plan: 'Living', usage: 33.55, supply: 1.05, discount: '7% off ref' }
    ],
    solar_feed_in: { min: 3.5, max: 8.0, unit: 'c/kWh', note: 'Varies by retailer' },
    concessions: 'Low Income Household Rebate: up to $350/year. Medical Energy Rebate: up to $600/year.'
  },
  vic: {
    state: 'Victoria',
    state_cn: '维多利亚',
    reference_price: { usage: 32.37, supply: 1.068, annual_benchmark: 1642 },
    retailers: [
      { name: 'AGL', plan: 'Essentials Plus', usage: 30.50, supply: 1.00, discount: '6% off ref' },
      { name: 'Origin Energy', plan: 'Go Variable', usage: 31.20, supply: 1.01, discount: '4% off ref' },
      { name: 'EnergyAustralia', plan: 'Flexi Saver', usage: 31.80, supply: 1.05, discount: '2% off ref' },
      { name: 'Alinta Energy', plan: 'Fair Deal', usage: 29.80, supply: 0.97, discount: '8% off ref' },
      { name: 'Momentum Energy', plan: 'SmilePower', usage: 30.10, supply: 0.99, discount: '7% off ref' },
      { name: 'GloBird Energy', plan: 'EasySave', usage: 29.20, supply: 0.95, discount: '10% off ref' }
    ],
    solar_feed_in: { min: 3.3, max: 7.0, unit: 'c/kWh', note: 'Minimum feed-in tariff set by ESC' },
    concessions: 'Annual Electricity Concession: $372.60. Utility Relief Grant: up to $650.'
  },
  qld: {
    state: 'Queensland',
    state_cn: '昆士兰',
    reference_price: { usage: 33.15, supply: 1.129, annual_benchmark: 1740 },
    retailers: [
      { name: 'Origin Energy', plan: 'Everyday', usage: 31.50, supply: 1.05, discount: '5% off ref' },
      { name: 'AGL', plan: 'Value Saver', usage: 32.00, supply: 1.08, discount: '4% off ref' },
      { name: 'EnergyAustralia', plan: 'Secure Saver', usage: 31.80, supply: 1.06, discount: '4% off ref' },
      { name: 'Alinta Energy', plan: 'Deal', usage: 30.00, supply: 1.00, discount: '10% off ref' },
      { name: 'ReAmped Energy', plan: 'ReAmped', usage: 29.50, supply: 0.98, discount: '11% off ref' }
    ],
    solar_feed_in: { min: 5.0, max: 12.0, unit: 'c/kWh', note: 'Varies; legacy FiT ~44c for pre-2012' },
    concessions: 'Electricity Rebate: $372/year. Medical Cooling Concession available.'
  },
  sa: {
    state: 'South Australia',
    state_cn: '南澳',
    reference_price: { usage: 41.08, supply: 1.201, annual_benchmark: 2117 },
    retailers: [
      { name: 'AGL', plan: 'Essentials', usage: 39.00, supply: 1.10, discount: '5% off ref' },
      { name: 'Origin Energy', plan: 'Simply', usage: 38.50, supply: 1.12, discount: '6% off ref' },
      { name: 'EnergyAustralia', plan: 'Basic', usage: 39.50, supply: 1.15, discount: '4% off ref' },
      { name: 'Alinta Energy', plan: 'Fair Deal', usage: 37.00, supply: 1.05, discount: '10% off ref' }
    ],
    solar_feed_in: { min: 3.0, max: 8.5, unit: 'c/kWh' },
    concessions: 'Energy Bill Concession: up to $270/year. Medical Heating/Cooling Concession available.'
  },
  wa: {
    state: 'Western Australia',
    state_cn: '西澳',
    reference_price: { usage: 31.02, supply: 1.064, annual_benchmark: 1611 },
    retailers: [
      { name: 'Synergy', plan: 'Home Plan (A1)', usage: 31.02, supply: 1.064, discount: 'Regulated rate' }
    ],
    note: 'WA has a regulated electricity market. Synergy is the main provider for most residential customers in the SWIS.',
    solar_feed_in: { min: 2.25, max: 10.0, unit: 'c/kWh', note: 'DEBS: 2.25c, legacy up to 47.13c' },
    concessions: 'Energy Assistance Payment: $321.48/year. Cost of Living Rebate varies.'
  },
  tas: {
    state: 'Tasmania',
    state_cn: '塔斯马尼亚',
    reference_price: { usage: 30.08, supply: 0.965, annual_benchmark: 1545 },
    retailers: [
      { name: 'Aurora Energy', plan: 'Residential', usage: 30.08, supply: 0.965, discount: 'Regulated rate' }
    ],
    note: 'TAS has regulated retail electricity prices via Aurora Energy.',
    solar_feed_in: { min: 5.0, max: 8.929, unit: 'c/kWh' },
    concessions: 'Annual Electricity Concession: $350.'
  },
  act: {
    state: 'Australian Capital Territory',
    state_cn: '首都领地',
    reference_price: { usage: 29.07, supply: 0.854, annual_benchmark: 1488 },
    retailers: [
      { name: 'ActewAGL', plan: 'Home', usage: 29.07, supply: 0.854, discount: 'Regulated rate' },
      { name: 'Origin Energy', plan: 'Basic', usage: 28.50, supply: 0.82, discount: '2% off ref' }
    ],
    solar_feed_in: { min: 6.0, max: 8.0, unit: 'c/kWh' },
    concessions: 'Energy Concession: up to $800/year (income tested). Utilities Concession available.'
  },
  nt: {
    state: 'Northern Territory',
    state_cn: '北领地',
    reference_price: { usage: 27.71, supply: 0.677, annual_benchmark: 1405 },
    retailers: [
      { name: 'Jacana Energy', plan: 'Residential', usage: 27.71, supply: 0.677, discount: 'Regulated rate' }
    ],
    note: 'NT has regulated pricing through Jacana Energy.',
    solar_feed_in: { min: 8.3, max: 8.3, unit: 'c/kWh', note: '1-for-1 scheme closed to new applicants' },
    concessions: 'Pensioner Concession scheme available. NT Government provides electricity vouchers periodically.'
  }
};

// Gas reference
const GAS = {
  average_usage: '15-25 MJ/day residential',
  typical_annual: '$800-$1500/year',
  states: {
    nsw: { usage_rate: '3.5-5.5 c/MJ', supply: '$0.60-0.90/day' },
    vic: { usage_rate: '2.5-4.5 c/MJ', supply: '$0.50-0.80/day' },
    qld: { usage_rate: '4.0-6.0 c/MJ', supply: '$0.65-0.95/day' },
    sa: { usage_rate: '4.5-6.5 c/MJ', supply: '$0.70-1.00/day' },
    act: { usage_rate: '3.0-4.5 c/MJ', supply: '$0.55-0.80/day' },
    wa: { usage_rate: '12.73 c/unit', supply: '$0.47/day', note: 'ATCO Gas / Alinta' },
    tas: { note: 'No reticulated natural gas in most of TAS. Bottled LPG is common.' }
  }
};

// State resolution — LLM translates Chinese to English, tool matches English names
const STATE_MAP = {
  'sydney': 'nsw', 'nsw': 'nsw', 'new south wales': 'nsw',
  'melbourne': 'vic', 'vic': 'vic', 'victoria': 'vic',
  'brisbane': 'qld', 'qld': 'qld', 'queensland': 'qld',
  'adelaide': 'sa', 'sa': 'sa', 'south australia': 'sa',
  'perth': 'wa', 'wa': 'wa', 'western australia': 'wa',
  'hobart': 'tas', 'tas': 'tas', 'tasmania': 'tas',
  'canberra': 'act', 'act': 'act', 'australian capital territory': 'act',
  'darwin': 'nt', 'nt': 'nt', 'northern territory': 'nt'
};

export async function compareEnergy(args) {
  const location = (args.location || args.state || '').toLowerCase();
  const energyType = (args.type || 'electricity').toLowerCase();
  const usage = args.usage || null; // kWh per day

  // Determine state
  let stateKey = STATE_MAP[location] || null;
  
  if (!stateKey && location) {
    for (const [k, v] of Object.entries(STATE_MAP)) {
      if (location.includes(k)) { stateKey = v; break; }
    }
  }

  // Gas query — LLM translates Chinese to English, tool matches English only
  if (/gas|natural gas/.test(energyType) || /gas/.test(location)) {
    const gasInfo = {
      type: 'gas_comparison',
      average_usage: GAS.average_usage,
      typical_annual_cost: GAS.typical_annual,
      states: GAS.states,
      tips: [
        'Consider switching to electric heat pump for hot water',
        'Gas connections have rising costs — all-electric homes save more long-term',
        'Compare plans at https://www.energymadeeasy.gov.au'
      ]
    };
    if (stateKey && GAS.states[stateKey]) {
      gasInfo.your_state = { state: stateKey.toUpperCase(), ...GAS.states[stateKey] };
    }
    return gasInfo;
  }

  // All states comparison if no specific state
  if (!stateKey) {
    const comparison = Object.entries(ELECTRICITY).map(([key, data]) => ({
      state: data.state_cn + ` (${data.state})`,
      usage_rate: `${data.reference_price.usage}c/kWh`,
      daily_supply: `$${data.reference_price.supply}/day`,
      annual_benchmark: `$${data.reference_price.annual_benchmark}`,
      cheapest_retailer: data.retailers.reduce((a, b) => a.usage < b.usage ? a : b).name,
      cheapest_rate: `${data.retailers.reduce((a, b) => a.usage < b.usage ? a : b).usage}c/kWh`
    }));

    return {
      type: 'all_states_comparison',
      comparison,
      cheapest_state: comparison.reduce((a, b) => 
        parseFloat(a.annual_benchmark.replace('$', '')) < parseFloat(b.annual_benchmark.replace('$', '')) ? a : b
      ),
      most_expensive_state: comparison.reduce((a, b) =>
        parseFloat(a.annual_benchmark.replace('$', '')) > parseFloat(b.annual_benchmark.replace('$', '')) ? a : b
      ),
      tips: [
        'Compare plans at https://www.energymadeeasy.gov.au',
        'Solar panels can save $1000-2000/year depending on system size',
        'Switch retailers regularly — loyalty rarely pays',
        'Government rebates available for concession card holders in all states'
      ],
      source: 'AER Default Market Offer 2024-2025'
    };
  }

  // Specific state
  const stateData = ELECTRICITY[stateKey];
  const result = {
    type: 'state_comparison',
    state: stateData.state,
    state_cn: stateData.state_cn,
    reference_price: {
      usage: `${stateData.reference_price.usage}c/kWh`,
      daily_supply: `$${stateData.reference_price.supply}/day`,
      annual_benchmark: `$${stateData.reference_price.annual_benchmark}/year (based on avg usage)`
    },
    retailers: stateData.retailers,
    solar: stateData.solar_feed_in,
    concessions: stateData.concessions
  };

  // Calculate estimate if usage provided
  if (usage) {
    const usagePerDay = parseFloat(usage);
    const cheapest = stateData.retailers.reduce((a, b) => a.usage < b.usage ? a : b);
    const ref = stateData.reference_price;

    result.your_estimate = {
      daily_usage: `${usagePerDay} kWh`,
      reference_daily: `$${((usagePerDay * ref.usage / 100) + ref.supply).toFixed(2)}`,
      reference_annual: `$${(((usagePerDay * ref.usage / 100) + ref.supply) * 365).toFixed(0)}`,
      cheapest_daily: `$${((usagePerDay * cheapest.usage / 100) + cheapest.supply).toFixed(2)} (${cheapest.name})`,
      cheapest_annual: `$${(((usagePerDay * cheapest.usage / 100) + cheapest.supply) * 365).toFixed(0)} (${cheapest.name})`,
      potential_saving: `$${((((usagePerDay * ref.usage / 100) + ref.supply) - ((usagePerDay * cheapest.usage / 100) + cheapest.supply)) * 365).toFixed(0)}/year`
    };
  }

  if (stateData.note) result.note = stateData.note;
  result.compare_link = 'https://www.energymadeeasy.gov.au';
  result.tips = [
    'Off-peak usage (10pm-7am) is cheaper on time-of-use plans',
    'Solar + battery can eliminate most electricity bills',
    'Switch retailers for a better deal — no supply interruption',
    'Check if eligible for government concessions or rebates'
  ];
  result.source = 'AER Default Market Offer & state regulator data (2024-2025)';

  return result;
}
