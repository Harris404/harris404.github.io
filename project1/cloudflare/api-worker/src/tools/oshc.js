/**
 * OSHC Tool — Overseas Student Health Cover calculator
 * 5 approved providers: AHM, nib, OSHC Worldcare, Medibank, Bupa
 * Live pricing scraped from oshcaustralia.com.au (with static fallback)
 *
 * Cover types:
 *   single         — student only
 *   couple         — student + partner (no children)
 *   family         — student + partner + children
 *   single_parent  — student + children (no partner)
 */

// Provider info (contact, website etc.) — static metadata
const PROVIDER_META = {
  'AHM-Basic': {
    name: 'AHM Health Insurance (Basic)',
    full_name: 'AHM Health Insurance',
    website: 'https://www.ahm.com.au/overseas-students',
    quote_url: 'https://oshcaustralia.com.au/en/quote',
    phone: '134 148',
    notes: 'Medibank subsidiary; competitive pricing for single cover'
  },
  'NIB-Basic': {
    name: 'nib OSHC (Basic)',
    full_name: 'nib OSHC',
    website: 'https://www.nib.com.au/overseas-students',
    quote_url: 'https://oshcaustralia.com.au/en/quote',
    phone: '1300 789 978',
    notes: 'Online-first experience; strong mobile app'
  },
  'Worldcare-Basic': {
    name: 'OSHC Worldcare (Basic)',
    full_name: 'OSHC Worldcare',
    website: 'https://www.oshcworldcare.com.au',
    quote_url: 'https://oshcaustralia.com.au/en/quote',
    phone: '1800 651 158',
    notes: 'Underwritten by United Healthcare Global'
  },
  'Medibank-Basic': {
    name: 'Medibank OSHC (Basic)',
    full_name: 'Medibank OSHC',
    website: 'https://www.medibank.com.au/overseas-students',
    quote_url: 'https://oshcaustralia.com.au/en/quote',
    phone: '134 148',
    notes: 'Government-owned insurer; extensive GP and hospital network'
  },
  'Bupa-Basic': {
    name: 'Bupa OSHC (Basic)',
    full_name: 'Bupa OSHC',
    website: 'https://www.bupa.com.au/overseas-students',
    quote_url: 'https://oshcaustralia.com.au/en/quote',
    phone: '134 135',
    notes: 'One of the largest OSHC providers; hospital arrangements across Australia'
  }
};

// Static fallback prices (AUD per year) — used if live scraping fails
// Updated Q1 2025 from oshcaustralia.com.au
const FALLBACK_ANNUAL = {
  single:       { 'AHM-Basic': 624, 'NIB-Basic': 625, 'Worldcare-Basic': 657, 'Medibank-Basic': 667, 'Bupa-Basic': 699 },
  couple:       { 'AHM-Basic': 1248, 'NIB-Basic': 1250, 'Worldcare-Basic': 1314, 'Medibank-Basic': 1334, 'Bupa-Basic': 1398 },
  family:       { 'AHM-Basic': 1872, 'NIB-Basic': 1875, 'Worldcare-Basic': 1971, 'Medibank-Basic': 2001, 'Bupa-Basic': 2097 },
  single_parent:{ 'AHM-Basic': 1248, 'NIB-Basic': 1250, 'Worldcare-Basic': 1314, 'Medibank-Basic': 1334, 'Bupa-Basic': 1398 }
};

// What OSHC must cover (government-regulated minimum benefits)
const OSHC_COVER_INFO = {
  covers: [
    'Hospital accommodation (shared ward)',
    'Surgeons, anaesthetists and other in-hospital medical costs',
    'Most out-of-hospital GP visits (Medicare Schedule fee)',
    'Prescription medications on the Pharmaceutical Benefits Scheme (PBS)',
    'Ambulance services',
    'Emergency dental treatment',
    'Mental health services',
    'Maternity (pregnancy) and newborn services'
  ],
  does_not_cover: [
    'Pre-existing conditions excluded for first 12 months (most providers)',
    'Cosmetic surgery',
    'Physio, chiropractic, optical — NOT included in standard OSHC',
    'Dental (routine/preventive) — NOT included in standard OSHC',
    'Some specialist consultations beyond Medicare Schedule fee (gap payments apply)'
  ],
  visa_requirement: 'OSHC is a visa condition for Student visa (subclass 500). Must be held for entire visa duration.',
  regulator: 'Department of Health and Aged Care + Department of Home Affairs'
};

// Common university OSHC arrangements (some unis have preferred providers)
const UNI_OSHC_ARRANGEMENTS = {
  'University of Sydney': { provider: 'Medibank', note: 'USyd has a preferred arrangement with Medibank' },
  'UNSW Sydney': { provider: 'nib', note: 'UNSW recommends nib; may offer group rates' },
  'University of Melbourne': { provider: 'Any', note: 'Students can choose any approved provider' },
  'Monash University': { provider: 'nib', note: 'Monash recommends nib OSHC' },
  'University of Queensland': { provider: 'Bupa', note: 'UQ has arrangement with Bupa' },
  'ANU': { provider: 'Any', note: 'No specific arrangement' },
  'default': { provider: 'Any of 5 approved providers', note: 'Students can freely choose their OSHC provider' }
};

// Map cover_type to (adults, children) for oshcaustralia.com.au form
const COVER_TYPE_PARAMS = {
  single:        { adults: 1, children: 0 },
  couple:        { adults: 2, children: 0 },
  family:        { adults: 2, children: 2 },
  single_parent: { adults: 1, children: 2 }
};

function parseMonths(args) {
  if (args.duration_months) return parseFloat(args.duration_months);
  if (args.duration_weeks) return parseFloat(args.duration_weeks) / 4.348;
  if (args.duration_years) return parseFloat(args.duration_years) * 12;
  if (args.duration === 'semester') return 6;
  if (args.duration === 'year') return 12;
  if (args.duration === '2 years') return 24;
  if (args.duration === '3 years') return 36;
  return null;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Fetch live quotes from oshcaustralia.com.au
 * Returns { 'AHM-Basic': 623.50, 'NIB-Basic': 624.49, ... } or null on failure
 */
async function fetchLiveQuotes(adults, children, durationMonths) {
  try {
    const start = new Date();
    start.setDate(start.getDate() + 7); // start one week from now
    const finish = new Date(start);
    finish.setMonth(finish.getMonth() + durationMonths);

    const params = new URLSearchParams({
      adults: String(adults),
      children: String(children),
      start: formatDate(start),
      finish: formatDate(finish),
      source: 'get-a-quote',
      current_brand_visa_length_cover: 'true',
      current_brand_supports_family_package: 'true',
    });

    const url = `https://oshcaustralia.com.au/en/quote?${params}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AustralianAssistantBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!resp.ok) return null;
    const html = await resp.text();

    // Parse prices: data-provider="AHM-Basic" ... <p class="price our-price">$623.50</p>
    const pricePattern = /data-provider="([^"]+)"[\s\S]*?<p class="price our-price">([^<]+)<\/p>/g;
    const prices = {};
    let m;
    while ((m = pricePattern.exec(html)) !== null) {
      const [, provider, priceStr] = m;
      if (!prices[provider]) {
        prices[provider] = parseFloat(priceStr.replace(/[$,]/g, ''));
      }
    }
    if (Object.keys(prices).length === 0) return null;

    // Parse feature comparison: rows where each featureValue td has data-provider attr
    const features = {};
    // Feature name → object key mapping
    const FEATURE_MAP = {
      'accident and emergency services': 'hospital_access',
      'doctor services': 'doctor_services',
      'standard gp consultation': 'gp_consultation',
      'telehealth': 'telehealth',
      'specialists': 'specialists',
      'pathology and x-rays': 'pathology_xray',
      'prescription medicines': 'prescriptions',
      'pre-existing psychiatric': 'psychiatric_wait',
      'pre-existing conditions': 'pre_existing_wait',
      'obstetrics': 'obstetrics_wait',
      'refund policy': 'refund_policy',
      'support services': 'support_services',
    };

    // Match each featureRow that has data-provider attributes on its value cells
    const rowPattern = /<tr[^>]*class="featureRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      // Get feature name from key td
      const keyM = /<td[^>]*class="[^"]*key[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(rowHtml);
      if (!keyM) continue;
      const keyText = keyM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const featureKey = FEATURE_MAP[keyText];
      if (!featureKey) continue;

      // Get each provider value cell (with data-provider attr)
      const cellPattern = /<td[^>]*class="[^"]*featureValue[^"]*"[^>]*data-provider="([^"]+)"[^>]*>([\s\S]*?)<\/td>/g;
      let cellM;
      while ((cellM = cellPattern.exec(rowHtml)) !== null) {
        const [, provider, cellHtml] = cellM;
        if (!provider.endsWith('-Basic')) continue;
        if (features[provider] && features[provider][featureKey]) continue; // already set
        const hasTick = /fa-check/.test(cellHtml);
        const hasCross = /fa-times|fa-minus/.test(cellHtml);
        let val = cellHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!val && hasTick) val = 'Yes';
        else if (!val && hasCross) val = 'No';
        if (!features[provider]) features[provider] = {};
        features[provider][featureKey] = val || (hasTick ? 'Yes' : (hasCross ? 'No' : null));
      }
    }

    return { prices, features };
  } catch {
    return null;
  }
}

/**
 * Build sorted quotes array from prices + optional features
 */
function buildQuotes(priceMap, featuresMap, durationMonths) {
  return Object.entries(priceMap)
    .filter(([key]) => key.endsWith('-Basic'))
    .map(([key, totalCost]) => {
      const meta = PROVIDER_META[key] || { name: key, phone: '', notes: '', quote_url: 'https://oshcaustralia.com.au/en/quote' };
      const entry = {
        provider: meta.full_name || meta.name,
        total_cost: totalCost,
        monthly_avg: Math.round((totalCost / durationMonths) * 100) / 100,
        website: meta.website,
        quote_url: meta.quote_url,
        phone: meta.phone,
        notes: meta.notes,
      };
      if (featuresMap && featuresMap[key]) {
        entry.coverage = featuresMap[key];
      }
      return entry;
    })
    .sort((a, b) => a.total_cost - b.total_cost);
}

export async function calculateOSHC(args) {
  const coverType = (args.cover_type || args.cover || 'single').toLowerCase().replace(/\s+/g, '_');
  const validCovers = ['single', 'couple', 'family', 'single_parent'];
  const coverKey = validCovers.includes(coverType) ? coverType : 'single';
  const months = parseMonths(args) || 12;

  const { adults, children } = COVER_TYPE_PARAMS[coverKey];

  // Try live pricing first
  const liveData = await fetchLiveQuotes(adults, children, months);
  
  let quotes, dataSource;
  if (liveData && liveData.prices && Object.keys(liveData.prices).length >= 3) {
    quotes = buildQuotes(liveData.prices, liveData.features || {}, months);
    dataSource = 'live (oshcaustralia.com.au)';
  } else {
    // Fall back to static data scaled to requested duration
    const annualPrices = FALLBACK_ANNUAL[coverKey];
    const scaledPrices = {};
    for (const [k, v] of Object.entries(annualPrices)) {
      scaledPrices[k] = Math.round((v / 12) * months * 100) / 100;
    }
    quotes = buildQuotes(scaledPrices, {}, months);
    dataSource = 'estimated (2025-Q1 static rates)';
  }

  // University arrangement hint
  const uniName = args.university || '';
  let uniArrangement = null;
  if (uniName) {
    const uniKey = Object.keys(UNI_OSHC_ARRANGEMENTS).find(k =>
      uniName.toLowerCase().includes(k.toLowerCase())
    );
    uniArrangement = uniKey
      ? UNI_OSHC_ARRANGEMENTS[uniKey]
      : UNI_OSHC_ARRANGEMENTS['default'];
  }

  return {
    cover_type: coverKey,
    duration_months: months,
    currency: 'AUD',
    quotes,
    cheapest: { provider: quotes[0].provider, total: quotes[0].total_cost },
    most_expensive: { provider: quotes[quotes.length - 1].provider, total: quotes[quotes.length - 1].total_cost },
    savings_gap: Math.round((quotes[quotes.length - 1].total_cost - quotes[0].total_cost) * 100) / 100,
    key_differences: {
      hospital_access: 'AHM and Medibank cover all hospitals; nib, Worldcare, Bupa cover public + agreement hospitals only',
      specialists_pathology: 'Bupa pays 100% of MBS for specialists and pathology; all others pay 85%',
      psychiatric_wait: 'Worldcare and Medibank have 0-month wait for pre-existing psychiatric conditions; AHM/nib/Bupa have 2-month wait',
      prescriptions: 'Medibank reimburses up to $70 per prescription item; all others $50 per item',
      refund_policy: 'nib, Worldcare, Bupa charge no cancellation fees; AHM and Medibank may charge limited fees',
    },
    how_to_use: {
      gp_visit: 'Present your OSHC card at the GP. Bulk-billing GPs charge nothing; otherwise provider reimburses up to 100% of MBS fee',
      hospital: 'Show OSHC card on admission. Use public hospitals for full cover; private hospitals may have gap costs',
      prescriptions: 'Present OSHC card at pharmacy. Claim up to the per-item limit (varies by provider)',
      emergency: 'Go to hospital Emergency Department — ambulance and ED are covered',
      claim: 'Most providers have mobile apps for claims. Can also claim online or via post',
      card: 'You receive a physical + digital OSHC card after purchase; keep it accessible at all times',
    },
    what_is_covered: OSHC_COVER_INFO.covers,
    what_is_not_covered: OSHC_COVER_INFO.does_not_cover,
    visa_requirement: OSHC_COVER_INFO.visa_requirement,
    university_arrangement: uniArrangement,
    data_source: dataSource,
    compare_all: 'https://oshcaustralia.com.au/en/quote'
  };
}
