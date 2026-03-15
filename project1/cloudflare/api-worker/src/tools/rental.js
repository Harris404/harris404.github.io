/**
 * Rental Assistant Pro — 租房助手升级版
 * 功能：租客权利、合同条款解读、租房成本计算器、Bond 退款
 * 数据来源：各州 Residential Tenancy Act + 内置计算器
 */

// ── 各州租客权利与Bond规则 ──────────────────────────────────────────

const TENANCY_RULES = {
  NSW: {
    bond_max: '4周租金',
    bond_authority: 'Rental Bonds Online (Fair Trading NSW)',
    bond_interest: '由 NSW Fair Trading 持有，退租后可在线申请退还',
    notice_period: {
      fixed_term: '不能提前终止（除非双方同意或有特殊情况break lease费用通常4-6周租金）',
      periodic: '租客需提前21天通知',
      landlord_no_reason: '固定合同到期后，房东需提前90天通知（无理由）',
    },
    rent_increase: '固定合同期内不能涨租。周期合同每12个月最多涨一次，需提前60天书面通知。',
    repairs: '紧急维修（如水管爆裂）房东必须24小时内响应。非紧急维修14天内。',
    tribunal: 'NSW Civil and Administrative Tribunal (NCAT): ncat.nsw.gov.au',
    tenants_union: 'Tenants Union NSW: tenants.org.au / 1800 251 101',
    website: 'fairtrading.nsw.gov.au/housing-and-property/renting',
  },
  VIC: {
    bond_max: '4周租金（月租≤$900）或1个月租金',
    bond_authority: 'Residential Tenancies Bond Authority (RTBA)',
    bond_interest: '交至RTBA，退租后双方在线同意退还',
    notice_period: {
      fixed_term: '不能提前终止（break lease费用通常为剩余租金或重新出租广告费）',
      periodic: '租客需提前28天通知',
      landlord_no_reason: '固定合同到期后，房东需提前90天通知',
    },
    rent_increase: '固定合同不能涨。周期合同每12个月最多涨一次，需提前60天通知。',
    repairs: '紧急维修24小时内，非紧急14天。租客可自行安排紧急维修（$2500以内）。',
    tribunal: 'Victorian Civil and Administrative Tribunal (VCAT): vcat.vic.gov.au',
    tenants_union: 'Tenants Victoria: tenantsvic.org.au / 03 9416 2577',
    website: 'consumer.vic.gov.au/housing/renting',
  },
  QLD: {
    bond_max: '4周租金',
    bond_authority: 'Residential Tenancies Authority (RTA)',
    bond_interest: '交至RTA，利息归租客',
    notice_period: {
      fixed_term: 'Break lease需赔偿（通常1周广告费+重新出租前的租金）',
      periodic: '租客需提前14天通知',
      landlord_no_reason: '需提前2个月通知',
    },
    rent_increase: '固定合同不能涨。周期合同需提前2个月通知，每6个月不超过一次。',
    repairs: '紧急维修24小时，非紧急7天。',
    tribunal: 'Queensland Civil and Administrative Tribunal (QCAT)',
    tenants_union: 'Tenants QLD: tenantsqld.org.au / 1300 744 263',
    website: 'rta.qld.gov.au',
  },
};

// ── 租金成本计算器 ──────────────────────────────────────────────────

function calculateRentalCosts(args) {
  const weeklyRent = Number(args.weekly_rent) || 0;
  const state = (args.state || 'NSW').toUpperCase();

  if (!weeklyRent) {
    return { error: 'Please provide weekly_rent (e.g. 500)' };
  }

  const monthlyRent = weeklyRent * 52 / 12;
  const bond = weeklyRent * 4;
  const yearlyRent = weeklyRent * 52;

  // Estimated utility costs (average)
  const utilities = {
    electricity: { weekly: 25, monthly: 108, note: '1-2人公寓' },
    gas: { weekly: 10, monthly: 43, note: '有些公寓无gas' },
    water: { weekly: 8, monthly: 35, note: '通常含在rent中（公寓）' },
    internet: { weekly: 17, monthly: 75, note: 'NBN 50Mbps 平均' },
  };

  const totalUtilitiesWeekly = Object.values(utilities).reduce((s, u) => s + u.weekly, 0);
  const totalWeekly = weeklyRent + totalUtilitiesWeekly;
  const totalMonthly = totalWeekly * 52 / 12;

  return {
    rent: {
      weekly: weeklyRent,
      fortnightly: weeklyRent * 2,
      monthly: Math.round(monthlyRent),
      yearly: yearlyRent,
    },
    bond: {
      amount: bond,
      note: TENANCY_RULES[state]?.bond_max || '通常为4周租金',
      authority: TENANCY_RULES[state]?.bond_authority || 'State Bond Authority',
    },
    move_in_cost: {
      first_month_rent: Math.round(monthlyRent),
      bond: bond,
      total: Math.round(monthlyRent + bond),
      note: '入住费用 = 首月租金 + Bond',
    },
    estimated_utilities: utilities,
    total_living_cost: {
      weekly: Math.round(totalWeekly),
      monthly: Math.round(totalMonthly),
      yearly: Math.round(totalWeekly * 52),
    },
    tips: [
      '签合同前拍照记录房屋现有损坏（condition report很重要）',
      'Bond必须交给政府机构，不是房东个人银行账户',
      '收到涨租通知？检查是否符合最低通知期和涨幅合理性',
      '水费通常由租客承担（如合同约定），但供水设施维修是房东责任',
    ],
  };
}

// ── 合同条款红旗检测 ──────────────────────────────────────────────

function checkLeaseRedFlags(args) {
  const clauses = (args.clauses || args.text || '').toLowerCase();
  const state = (args.state || 'NSW').toUpperCase();

  const redFlags = [];
  const warnings = [];

  // Illegal clauses
  if (clauses.includes('no pets') || clauses.includes('no animal')) {
    if (state === 'VIC') {
      redFlags.push('🚩 VIC法律：房东不能无理拒绝养宠物（2020年法律修改）。需书面申请，房东需在14天内回复。');
    } else {
      warnings.push('⚠️ 宠物条款：多数州允许房东禁止宠物，但可以协商。');
    }
  }

  if (clauses.includes('carpet clean') || clauses.includes('professional clean')) {
    warnings.push('⚠️ "专业清洁"条款：在多数州，除非搬入时有专业清洁证明，否则不能强制要求。清洁程度应与入住时相当。');
  }

  if (clauses.includes('no subletting') || clauses.includes('no sub-let')) {
    warnings.push('⚠️ 转租条款：禁止转租是常见的，但如需break lease，了解你州的break lease政策。');
  }

  if (clauses.includes('personal bank') || clauses.includes('direct to landlord')) {
    redFlags.push('🚩 Bond付款：Bond必须交给州政府Bond机构，不是房东个人账户。如果房东要求付到个人账户，这可能违法。');
  }

  if (clauses.includes('penalty') || clauses.includes('fine') || clauses.includes('罚款')) {
    redFlags.push('🚩 罚款条款：澳洲租赁法通常不允许在合同中设定"罚款"。如有争议，联系Tenants Union。');
  }

  const rules = TENANCY_RULES[state];

  return {
    state,
    red_flags: redFlags,
    warnings,
    red_flag_count: redFlags.length,
    warning_count: warnings.length,
    overall: redFlags.length > 0 ? '⚠️ 发现可疑条款，建议联系Tenants Union确认' : '✅ 未发现明显违规条款',
    tenant_rights: rules ? {
      notice_period: rules.notice_period,
      rent_increase: rules.rent_increase,
      repairs: rules.repairs,
      tribunal: rules.tribunal,
      tenants_union: rules.tenants_union,
    } : null,
    tip: '如果不确定合同条款是否合法，联系你所在州的 Tenants Union（免费法律咨询）。',
  };
}

// ── 主函数 ──────────────────────────────────────────────────────────

export async function rentalAssistant(args, env) {
  const mode = args.mode || 'rights';

  switch (mode) {
    case 'cost':
    case 'calculator':
      return calculateRentalCosts(args);

    case 'check':
    case 'lease':
    case 'contract':
      return checkLeaseRedFlags(args);

    case 'median':
    case 'rent':
    case 'price': {
      // Query real median rent data from government sources
      return await lookupMedianRent(args, env);
    }

    case 'rights':
    default: {
      const state = (args.state || 'NSW').toUpperCase();
      const rules = TENANCY_RULES[state] || TENANCY_RULES.NSW;
      return {
        state,
        rules,
        all_states: Object.keys(TENANCY_RULES),
        modes: {
          rights: '租客权利查询（默认）',
          cost: '租房成本计算器 — 提供 weekly_rent 参数',
          check: '合同条款检查 — 提供 text/clauses 参数',
          median: '真实中位租金查询 — 提供 postcode 参数',
        },
      };
    }
  }
}

// ── 中位租金查询（政府数据） ──────────────────────────────────────

let _rentalDataCache = {};

async function loadRentalData(state, env) {
  if (_rentalDataCache[state]) return _rentalDataCache[state];

  // Try KV first (deployed)
  const kvKey = `rental-data-${state.toLowerCase()}`;
  if (env?.KV) {
    try {
      const data = await env.KV.get(kvKey, 'json');
      if (data) { _rentalDataCache[state] = data; return data; }
    } catch {}
  }

  return null;
}

async function lookupMedianRent(args, env) {
  const postcode = String(args.postcode || args.pc || '');
  const lga = String(args.lga || args.council || args.suburb || args.area || '');
  const stateHint = (args.state || '').toUpperCase();
  const dwelling = (args.dwelling || args.type || '').toLowerCase();
  const bedrooms = args.bedrooms || args.beds || '';

  // Auto-detect state from postcode prefix
  let state = stateHint;
  if (!state && postcode) {
    if (postcode.startsWith('2')) state = 'NSW';
    else if (postcode.startsWith('3')) state = 'VIC';
    else if (postcode.startsWith('4')) state = 'QLD';
  }
  if (!state && lga) state = 'VIC'; // LGA queries default to VIC
  if (!state) state = 'NSW';

  if (!postcode && !lga) {
    return {
      error: '请提供 postcode 或 lga 参数',
      examples: [
        '{ "mode": "median", "postcode": "2067", "bedrooms": 2 }',
        '{ "mode": "median", "lga": "Melbourne", "bedrooms": 2 }',
        '{ "mode": "median", "postcode": "3000", "bedrooms": 1 }',
      ],
      supported_states: [
        'NSW (533 postcodes, monthly bond data)',
        'QLD (216 postcodes, quarterly bond data)',
        'VIC (78 LGAs, quarterly bond data by council area)',
      ],
      source: 'NSW Fair Trading + QLD RTA + VIC DFFH (RTBA)',
    };
  }

  // ── VIC: LGA-based lookup ──
  if (state === 'VIC') {
    const vicData = await loadRentalData('VIC', env);
    if (!vicData) {
      return {
        state: 'VIC', query: lga || postcode,
        available: false,
        message: 'VIC 租金数据库未载入(KV)。请确保 rental-data-vic 已上传。',
      };
    }

    // VIC data is by LGA. If user gave postcode, note this.
    const searchData = vicData.data || vicData;
    let matchLGA = null;
    let matchData = null;

    if (lga) {
      // Fuzzy match LGA name
      const normalised = lga.toLowerCase().replace(/['']/g, '');
      for (const [key, val] of Object.entries(searchData)) {
        if (key.toLowerCase().replace(/['']/g, '') === normalised) {
          matchLGA = key; matchData = val; break;
        }
      }
      if (!matchData) {
        // Partial match
        for (const [key, val] of Object.entries(searchData)) {
          if (key.toLowerCase().includes(normalised) || normalised.includes(key.toLowerCase())) {
            matchLGA = key; matchData = val; break;
          }
        }
      }
    }

    if (!matchData && postcode) {
      return {
        state: 'VIC', postcode,
        available: false,
        message: `VIC 数据按 LGA (Council Area) 查询，不是邮编。请提供 LGA 名称，如 Melbourne, Monash, Glen Eira, Boroondara, Darebin 等。`,
        tip: '不知道你在哪个 LGA？搜索 "know your council" 在 vic.gov.au 查询。',
        available_lgas: Object.keys(searchData).filter(k => !['source', 'period', 'data_type', 'note', 'download_url', 'generated', 'total_lgas'].includes(k)).slice(0, 30),
      };
    }

    if (!matchData) {
      return {
        state: 'VIC', query: lga,
        available: false,
        message: `未找到 LGA "${lga}"。可能拼写不同。`,
        available_lgas: Object.keys(searchData).filter(k => typeof searchData[k] === 'object' && searchData[k].state).slice(0, 30),
      };
    }

    // Format VIC results
    const result = { state: 'VIC', lga: matchLGA, region: matchData.region, available: true };
    const rents = {};
    for (const [key, val] of Object.entries(matchData)) {
      if (key === 'region' || key === 'state') continue;
      if (typeof val === 'object' && val.median_weekly) {
        // Apply filters
        if (bedrooms) {
          const br = String(bedrooms);
          if (!key.startsWith(br + 'br')) continue;
        }
        if (dwelling) {
          if (!key.includes(dwelling)) continue;
        }
        rents[key] = val;
      }
    }
    result.rents = rents;
    result.data_source = 'VIC DFFH (RTBA Bond Data, September Quarter 2025)';
    result.data_freshness = '每季度更新';
    result.interpretation = {
      median: '中位数 = 新登记Bond周租金中间值',
      lga: 'LGA (Local Government Area) = 地方政府区域 / Council',
    };
    result.tip = '这是VIC政府真实Bond登记数据。如需特定suburb的rental，试试 domain_search 工具。';
    return result;
  }

  // ── NSW/QLD: Postcode-based lookup (original logic) ──
  if (!postcode) {
    return {
      error: `${state} 数据按邮编查询，请提供 postcode 参数。`,
      example: `{ "mode": "median", "postcode": "${state === 'QLD' ? '4000' : '2000'}", "bedrooms": 2 }`,
    };
  }

  const data = await loadRentalData(state, env);

  if (!data || !data[postcode]) {
    return {
      postcode, state, available: false,
      message: `暂无 ${state} ${postcode} 的政府中位租金数据。${data ? '该邮编可能数据量不足。' : '租金数据库未载入(KV)。'}`,
      tip: '可以在 domain.com.au 查看该区最新租房挂牌价格。',
      supported_states: ['NSW', 'QLD', 'VIC (按 LGA)'],
    };
  }

  const pcData = data[postcode];
  const rents = pcData.rents || {};

  // Filter by dwelling type
  let filteredRents = { ...rents };
  if (dwelling) {
    const typeMap = {
      'flat': 'Flat/Apartment', 'apartment': 'Flat/Apartment', '公寓': 'Flat/Apartment',
      'house': 'House', '独立屋': 'House', '别墅': 'House',
      'townhouse': 'Townhouse', '联排': 'Townhouse',
    };
    const mappedType = typeMap[dwelling] || dwelling;
    const matched = {};
    for (const [k, v] of Object.entries(rents)) {
      if (k.toLowerCase().includes(dwelling) || k === mappedType) matched[k] = v;
    }
    if (Object.keys(matched).length > 0) filteredRents = matched;
  }

  // Filter by bedrooms
  if (bedrooms) {
    const bedsKey = `${bedrooms}br`;
    for (const [type, beds] of Object.entries(filteredRents)) {
      if (type === '_overall') continue;
      if (beds[bedsKey]) {
        filteredRents[type] = { [bedsKey]: beds[bedsKey] };
      }
    }
  }

  const result = {
    postcode, state, available: true,
    rents: filteredRents,
    bonds_held: pcData.bonds_held || null,
    data_source: state === 'NSW'
      ? 'NSW Fair Trading Bond Lodgements (January 2026)'
      : 'QLD RTA Bond Statistics (Dec 2025 Quarter)',
    data_freshness: state === 'NSW' ? '每月更新' : '每季度更新',
    interpretation: {
      median: '中位数 = 新登记Bond周租金中间值',
      min_max: '最低/最高仅代表该月新登记Bond范围',
      count: 'Bond登记数越多，数据越可靠',
    },
    tip: '这是政府真实Bond登记数据，比挂牌价更准确。',
  };

  // Forum enrichment: race with 1.5s timeout
  try {
    const { forumEnrich } = await import('./cn-forums.js');
    const timeout = new Promise(r => setTimeout(() => r([]), 1500));
    const forumData = await Promise.race([forumEnrich(`${postcode} ${state} 租房 经验`, 'rental', env), timeout]);
    if (forumData.length > 0) {
      result.community_experiences = forumData;
      result.community_note = '💬 华人租房经验仅供参考，以官方Bond数据为准。';
    }
  } catch {}

  return result;
}

