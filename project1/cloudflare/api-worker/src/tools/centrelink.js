/**
 * Centrelink Welfare Calculator — 内置福利金额计算
 * 
 * 数据源: Services Australia (2024-2025 rates)
 * https://www.servicesaustralia.gov.au/payment-rates
 * 
 * 支持: JobSeeker, Youth Allowance, Age Pension, Parenting Payment,
 *     Family Tax Benefit, Rent Assistance, Student payments
 */

// 所有金额为 AUD, 按每双周(fortnightly)计
const PAYMENTS = {
  jobseeker: {
    name: 'JobSeeker Payment',
    name_cn: '求职者津贴',
    description: 'For people aged 22 to Age Pension age looking for work',
    rates: {
      single_no_children: { base: 762.70, energy_supplement: 8.80 },
      single_with_children: { base: 816.90, energy_supplement: 9.50 },
      partnered: { base: 698.30, energy_supplement: 8.00 },
      single_60_plus_after_9_months: { base: 816.90, energy_supplement: 9.50 }
    },
    income_test: {
      threshold: 150, // first $150/fn no effect
      taper1: { from: 150, to: 256, rate: 0.50 }, // 50c per $1
      taper2: { from: 256, rate: 0.60 } // 60c per $1
    },
    asset_test: {
      homeowner_single: 301750,
      homeowner_couple: 451500,
      non_homeowner_single: 543750,
      non_homeowner_couple: 693500
    },
    eligibility: [
      'Aged 22 to Age Pension age',
      'Australian resident or permanent visa',
      'Looking for work / doing approved activities',
      'Meet income and asset tests',
      'Must serve a waiting period (usually 1-4 weeks)'
    ]
  },

  youth_allowance: {
    name: 'Youth Allowance',
    name_cn: '青年津贴',
    description: 'For young job seekers (under 22) or full-time students (under 25)',
    rates: {
      single_under_18_at_home: { base: 377.40, energy_supplement: 4.40 },
      single_under_18_away: { base: 575.30, energy_supplement: 6.60 },
      single_18_plus_at_home: { base: 462.50, energy_supplement: 5.30 },
      single_18_plus_away: { base: 575.30, energy_supplement: 6.60 },
      single_with_children: { base: 762.70, energy_supplement: 8.80 },
      partnered: { base: 575.30, energy_supplement: 6.60 }
    },
    income_test: {
      student_threshold: 480, // students: first $480/fn no effect
      jobseeker_threshold: 150,
      taper: 0.50 // 50c per $1 over threshold
    },
    eligibility: [
      'Job seeker: aged 16-21',
      'Student: aged 16-24 (full-time study)',
      'Australian citizen/perm resident',
      'Parental income test may apply if dependent'
    ]
  },

  age_pension: {
    name: 'Age Pension',
    name_cn: '养老金',
    description: 'For people who have reached Age Pension age (67)',
    rates: {
      single: { base: 1116.30, pension_supplement: 81.60, energy_supplement: 14.10 },
      couple_each: { base: 841.40, pension_supplement: 61.50, energy_supplement: 10.60 }
    },
    pension_age: 67,
    income_test: {
      single_threshold: 204, // per fortnight
      couple_threshold: 360,
      taper: 0.50
    },
    asset_test: {
      homeowner_single: 301750,
      homeowner_couple: 451500,
      non_homeowner_single: 543750,
      non_homeowner_couple: 693500
    }
  },

  parenting_payment: {
    name: 'Parenting Payment',
    name_cn: '育儿津贴',
    description: 'For parents or guardians of young children',
    rates: {
      single: { base: 922.10, energy_supplement: 9.50 }, // youngest child < 14
      partnered: { base: 698.30, energy_supplement: 8.00 } // youngest child < 6
    },
    eligibility: [
      'Single: youngest child under 14',
      'Partnered: youngest child under 6',
      'Meet income and asset tests',
      'Australian resident'
    ]
  },

  family_tax_benefit: {
    name: 'Family Tax Benefit',
    name_cn: '家庭税务福利',
    description: 'Payment to help with the cost of raising children',
    rates: {
      part_a: {
        per_child_0_12: { max: 222.04, base: 65.54 }, // per fortnight
        per_child_13_15: { max: 288.82, base: 65.54 },
        per_child_16_19: { max: 288.82, base: 65.54 },
        newborn_supplement: 624.44, // one-off lump sum per child
        income_threshold: 61063 // family income, per year
      },
      part_b: {
        youngest_0_5: { max: 186.06 },
        youngest_5_18: { max: 129.92 },
        income_threshold: 6497, // secondary earner per year
        note: 'Not available to couple families with combined income > ~$100k'
      }
    }
  },

  rent_assistance: {
    name: 'Rent Assistance',
    name_cn: '租房补贴',
    description: 'Additional payment to help with rent costs',
    rates: {
      single_no_children: { max: 188.20, threshold: 145.80 }, // fortnightly rent threshold
      couple_no_children: { max: 177.20, threshold: 236.60 },
      single_1_2_children: { max: 222.28, threshold: 183.44 },
      single_3_plus_children: { max: 222.28, threshold: 183.44 },
      couple_1_2_children: { max: 222.28, threshold: 243.04 },
      couple_3_plus_children: { max: 222.28, threshold: 243.04 }
    },
    taper: 0.75, // 75c per $1 above threshold
    note: 'Must be receiving an eligible payment (e.g., JobSeeker, Youth Allowance)',
    eligibility: [
      'Paying rent above the threshold',
      'Receiving an eligible income support payment',
      'Not living in government housing'
    ]
  },

  disability_support: {
    name: 'Disability Support Pension',
    name_cn: '残疾抚恤金',
    description: 'For people with a permanent disability that prevents them from working',
    rates: {
      single: { base: 1116.30, pension_supplement: 81.60, energy_supplement: 14.10 },
      couple_each: { base: 841.40, pension_supplement: 61.50, energy_supplement: 10.60 }
    },
    under_21: {
      at_home: { base: 575.30 },
      away_from_home: { base: 762.70 }
    }
  }
};

const PAYMENT_MAP = {
  'jobseeker': 'jobseeker', '求职': 'jobseeker', '求职者': 'jobseeker', 
  '失业': 'jobseeker', '找工作': 'jobseeker', 'newstart': 'jobseeker',
  'youth': 'youth_allowance', '青年': 'youth_allowance', '学生': 'youth_allowance',
  'student': 'youth_allowance',
  'pension': 'age_pension', '养老': 'age_pension', '退休': 'age_pension',
  'parenting': 'parenting_payment', '育儿': 'parenting_payment', '孩子': 'parenting_payment',
  'ftb': 'family_tax_benefit', 'family': 'family_tax_benefit', '家庭': 'family_tax_benefit',
  'rent': 'rent_assistance', '租房补贴': 'rent_assistance', '房租': 'rent_assistance',
  'disability': 'disability_support', 'dsp': 'disability_support', '残疾': 'disability_support'
};

export async function calculateCentrelink(args) {
  const query = (args.query || args.payment_type || '').toLowerCase();
  const situation = args.situation || 'single'; // single, partnered, single_with_children
  const income = args.income || 0; // fortnightly income
  const rent = args.rent || 0; // fortnightly rent
  const children = args.children || 0;

  // If no specific query, show overview
  if (!query || /overview|all|全部|概览|有什么|what|centrelink|福利/.test(query)) {
    return {
      type: 'overview',
      payments: Object.entries(PAYMENTS).map(([key, p]) => ({
        id: key,
        name: p.name,
        name_cn: p.name_cn,
        description: p.description,
        example_rate: getExampleRate(key)
      })),
      general_eligibility: [
        'Must be an Australian resident or hold an eligible visa',
        'Must meet income and asset tests',
        'International students are generally NOT eligible',
        'Waiting periods may apply (1-4 weeks for new claims)'
      ],
      how_to_claim: {
        online: 'https://my.gov.au → Centrelink',
        phone: '132 850 (Centrelink)',
        multilingual: '131 202 (translation service)'
      },
      tip: 'Ask about a specific payment for detailed rates and eligibility'
    };
  }

  // Find matching payment
  let paymentKey = null;
  for (const [kw, key] of Object.entries(PAYMENT_MAP)) {
    if (query.includes(kw)) { paymentKey = key; break; }
  }

  if (!paymentKey) {
    // Try direct match
    if (PAYMENTS[query]) paymentKey = query;
  }

  if (!paymentKey) {
    return {
      type: 'not_found',
      query,
      message: `No matching payment found for "${query}"`,
      available: Object.entries(PAYMENTS).map(([k, p]) => `${p.name_cn} (${p.name})`),
      suggestion: 'Try asking about: jobseeker, youth allowance, age pension, parenting payment, family tax benefit, rent assistance'
    };
  }

  const payment = PAYMENTS[paymentKey];
  const result = {
    type: 'calculation',
    payment: payment.name,
    payment_cn: payment.name_cn,
    description: payment.description,
    situation,
    rates: payment.rates
  };

  // Calculate actual entitlement if income provided
  if (paymentKey === 'jobseeker' && income > 0) {
    const rateKey = situation === 'partnered' ? 'partnered' :
      children > 0 ? 'single_with_children' : 'single_no_children';
    const base = payment.rates[rateKey]?.base || payment.rates.single_no_children.base;
    const it = payment.income_test;
    
    let reduction = 0;
    if (income > it.threshold) {
      const band1 = Math.min(income, it.taper1.to) - it.taper1.from;
      reduction = Math.max(0, band1) * it.taper1.rate;
      if (income > it.taper2.from) {
        reduction += (income - it.taper2.from) * it.taper2.rate;
      }
    }

    result.calculation = {
      base_rate: `$${base.toFixed(2)}/fortnight`,
      income: `$${income}/fortnight`,
      reduction: `$${reduction.toFixed(2)}`,
      estimated_payment: `$${Math.max(0, base - reduction).toFixed(2)}/fortnight`,
      annual_estimate: `~$${(Math.max(0, base - reduction) * 26).toFixed(0)}/year`
    };
  }

  // Calculate rent assistance
  if (rent > 0 && (paymentKey === 'jobseeker' || paymentKey === 'youth_allowance' || paymentKey === 'parenting_payment')) {
    const ra = PAYMENTS.rent_assistance;
    const raKey = situation === 'partnered' ?
      (children > 0 ? 'couple_1_2_children' : 'couple_no_children') :
      (children > 0 ? 'single_1_2_children' : 'single_no_children');
    const raRate = ra.rates[raKey];
    
    if (rent > raRate.threshold) {
      const raAmount = Math.min(raRate.max, (rent - raRate.threshold) * ra.taper);
      result.rent_assistance = {
        fortnightly_rent: `$${rent}`,
        threshold: `$${raRate.threshold}`,
        max_possible: `$${raRate.max}/fortnight`,
        estimated: `$${raAmount.toFixed(2)}/fortnight`,
        note: 'Rent Assistance is paid on top of your base payment'
      };
    } else {
      result.rent_assistance = {
        message: `Rent of $${rent}/fn is below threshold of $${raRate.threshold}/fn, no Rent Assistance payable`
      };
    }
  }

  result.eligibility = payment.eligibility || [];
  result.how_to_claim = {
    online: 'https://my.gov.au → Centrelink',
    phone: '132 850',
    multilingual: '131 202'
  };
  result.source = 'Services Australia payment rates (2024-2025)';
  result.disclaimer = 'These are estimates only. Actual entitlements depend on full assessment.';

  return result;
}

function getExampleRate(key) {
  const p = PAYMENTS[key];
  if (key === 'family_tax_benefit') return `Part A: up to $${p.rates.part_a.per_child_0_12.max}/fn per child`;
  if (key === 'rent_assistance') return `Up to $${p.rates.single_no_children.max}/fn`;
  const rates = p.rates;
  const first = Object.values(rates)[0];
  return `$${first.base}/fortnight (${Object.keys(rates)[0].replace(/_/g, ' ')})`;
}
