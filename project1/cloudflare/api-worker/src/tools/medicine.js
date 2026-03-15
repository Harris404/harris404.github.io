/**
 * Medicine Tool — Built-in drug database + DuckDuckGo fallback
 */



// Built-in drug database (common medicines in Australia)
const MEDICINE_DB = {
  paracetamol: {
    name: 'Paracetamol', brands: ['Panadol', 'Panamax', 'Herron Paracetamol'],
    schedule: 'Unscheduled / S2', otc: true,
    use: 'Pain relief, fever reduction',
    dosage: 'Adults: 500mg-1000mg every 4-6 hours, max 4000mg/day',
    warnings: 'Do not exceed recommended dose. Liver damage risk with overdose or alcohol use.',
    price_range: 'AUD $3-12 (Chemist Warehouse/Priceline)'
  },
  ibuprofen: {
    name: 'Ibuprofen', brands: ['Nurofen', 'Advil', 'Herron Blue'],
    schedule: 'S2 (Pharmacy Medicine)', otc: true,
    use: 'Anti-inflammatory, pain relief, fever reduction',
    dosage: 'Adults: 200-400mg every 4-6 hours, max 1200mg/day (OTC)',
    warnings: 'Take with food. Not for asthmatics sensitive to NSAIDs. Avoid in late pregnancy.',
    price_range: 'AUD $5-15'
  },
  aspirin: {
    name: 'Aspirin', brands: ['Aspro Clear', 'Disprin', 'Cartia'],
    schedule: 'S2', otc: true,
    use: 'Pain relief, fever, anti-inflammatory, blood thinning',
    dosage: 'Adults: 300-600mg every 4 hours, max 4000mg/day. Low dose cardiac: 100mg/day.',
    warnings: 'Not for children under 12 (Reye syndrome risk). Avoid if on anticoagulants.',
    price_range: 'AUD $4-10'
  },
  amoxicillin: {
    name: 'Amoxicillin', brands: ['Amoxil', 'Moxacin'],
    schedule: 'S4 (Prescription Only)', otc: false,
    use: 'Antibiotic for bacterial infections',
    dosage: 'Adults: 250-500mg every 8 hours. Duration depends on condition.',
    warnings: 'Prescription required. Complete full course. Check for penicillin allergy.',
    price_range: 'AUD $10-20 (PBS subsidized ~$7.70)'
  },
  loratadine: {
    name: 'Loratadine', brands: ['Claratyne', 'Lorano'],
    schedule: 'S2/S3', otc: true,
    use: 'Antihistamine for allergies (hayfever, hives)',
    dosage: 'Adults: 10mg once daily',
    warnings: 'Non-drowsy. May still cause drowsiness in some.',
    price_range: 'AUD $8-20'
  },
  cetirizine: {
    name: 'Cetirizine', brands: ['Zyrtec', 'Alzene'],
    schedule: 'S2/S3', otc: true,
    use: 'Antihistamine for allergies',
    dosage: 'Adults: 10mg once daily',
    warnings: 'May cause drowsiness.',
    price_range: 'AUD $8-18'
  },
  melatonin: {
    name: 'Melatonin', brands: ['Circadin'],
    schedule: 'S4 (2mg+ by prescription) / S3 (low dose OTC pilot)',
    otc: false,
    use: 'Sleep regulation, jet lag',
    dosage: '2mg before bedtime',
    warnings: 'In Australia, most melatonin requires prescription. Low-dose may be available OTC at some pharmacies.',
    price_range: 'AUD $15-30'
  },
  'cold and flu': {
    name: 'Cold & Flu Medicines', brands: ['Codral', 'Lemsip', 'Sudafed PE'],
    schedule: 'S2/S3', otc: true,
    use: 'Relief of cold and flu symptoms',
    dosage: 'Follow packet instructions. Various combinations available.',
    warnings: 'Check active ingredients to avoid doubling up (e.g. paracetamol).',
    price_range: 'AUD $8-20'
  },
  'vitamin c': {
    name: 'Vitamin C', brands: ['Swisse', 'Blackmores', 'Nature\'s Own'],
    schedule: 'Complementary Medicine', otc: true,
    use: 'Immune support, antioxidant',
    dosage: 'Adults: 500-1000mg daily',
    warnings: 'Generally safe. High doses may cause GI upset.',
    price_range: 'AUD $8-25'
  },
  'fish oil': {
    name: 'Fish Oil (Omega-3)', brands: ['Swisse', 'Blackmores', 'Nature\'s Way'],
    schedule: 'Complementary Medicine', otc: true,
    use: 'Heart health, joint health, brain function',
    dosage: 'Adults: 1-3 capsules daily (1000mg each)',
    warnings: 'May interact with blood thinners. Check for fish allergy.',
    price_range: 'AUD $15-40'
  }
};

// LLM handles Chinese→English translation in intent analysis
// Tool receives English query directly
function translateQuery(query) {
  return query.toLowerCase().trim();
}

async function duckDuckGoFallback(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' medicine Australia TGA')}&format=json&no_html=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'AustralianAssistant/1.0' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const abstract = data.Abstract || '';
    const related = (data.RelatedTopics || []).slice(0, 3).map(t => t.Text || '').filter(Boolean);
    if (!abstract && !related.length) return null;
    return { source: 'DuckDuckGo/web', abstract, related_info: related };
  } catch {
    return null;
  }
}

export async function searchMedicine(args) {
  const rawQuery = args.query || args.name || '';
  if (!rawQuery) return { error: 'Please provide a medicine name' };

  const query = translateQuery(rawQuery);

  // Check built-in database
  const match = MEDICINE_DB[query];
  if (match) {
    return {
      source: 'built-in TGA database',
      ...match,
      original_query: rawQuery !== query ? rawQuery : undefined,
      disclaimer: '⚠️ 此信息仅供参考，不构成医疗建议。请咨询医生或药剂师。'
    };
  }

  // Fuzzy match
  for (const [key, val] of Object.entries(MEDICINE_DB)) {
    if (key.includes(query) || query.includes(key) ||
        val.brands.some(b => b.toLowerCase().includes(query))) {
      return {
        source: 'built-in TGA database',
        ...val,
        original_query: rawQuery,
        disclaimer: '⚠️ 此信息仅供参考，不构成医疗建议。请咨询医生或药剂师。'
      };
    }
  }

  // DuckDuckGo fallback
  const webResult = await duckDuckGoFallback(query);
  if (webResult) {
    return {
      query: rawQuery,
      translated: query !== rawQuery.toLowerCase() ? query : undefined,
      ...webResult,
      disclaimer: '⚠️ 此信息来自网络搜索，仅供参考。请咨询医生或药剂师获取专业建议。'
    };
  }

  return {
    query: rawQuery,
    message: `No information found for "${rawQuery}". Try searching with the English medicine name.`,
    tip: 'Visit https://www.tga.gov.au/ for official medicine information.'
  };
}
