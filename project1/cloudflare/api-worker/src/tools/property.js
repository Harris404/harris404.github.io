/**
 * Property Search Tool — Domain.com.au API + 内置数据
 * 
 * Domain API: https://developer.domain.com.au/
 * Free tier: 500 calls/day
 * 
 * 如果没有 Domain API key，使用内置市场数据 + web search fallback
 */

// 各城市各区中位租金 (2025-2026 estimates, weekly)
const RENT_GUIDE = {
  sydney: {
    overall: { house: 700, unit: 550, room: 280 },
    suburbs: {
      'cbd': { house: null, unit: 750, room: 350 },
      'surry hills': { house: 1100, unit: 650, room: 320 },
      'bondi': { house: 1200, unit: 700, room: 350 },
      'newtown': { house: 900, unit: 600, room: 300 },
      'parramatta': { house: 650, unit: 500, room: 250 },
      'chatswood': { house: 800, unit: 580, room: 280 },
      'hurstville': { house: 700, unit: 520, room: 250 },
      'burwood': { house: 750, unit: 550, room: 270 },
      'strathfield': { house: 800, unit: 530, room: 260 },
      'bankstown': { house: 600, unit: 450, room: 230 },
      'blacktown': { house: 550, unit: 420, room: 220 },
      'liverpool': { house: 550, unit: 430, room: 220 },
      'epping': { house: 750, unit: 550, room: 270 },
      'hornsby': { house: 700, unit: 500, room: 260 },
      'mascot': { house: 850, unit: 620, room: 300 },
      'zetland': { house: null, unit: 680, room: 320 },
      'waterloo': { house: null, unit: 650, room: 310 },
      'randwick': { house: 1000, unit: 600, room: 300 },
      'marrickville': { house: 900, unit: 580, room: 290 },
      'ashfield': { house: 750, unit: 500, room: 260 }
    }
  },
  melbourne: {
    overall: { house: 550, unit: 480, room: 230 },
    suburbs: {
      'cbd': { house: null, unit: 520, room: 280 },
      'south yarra': { house: 800, unit: 500, room: 280 },
      'richmond': { house: 700, unit: 480, room: 260 },
      'carlton': { house: 650, unit: 450, room: 250 },
      'fitzroy': { house: 750, unit: 500, room: 270 },
      'st kilda': { house: 700, unit: 470, room: 260 },
      'footscray': { house: 500, unit: 400, room: 220 },
      'box hill': { house: 550, unit: 430, room: 230 },
      'clayton': { house: 500, unit: 420, room: 220 },
      'glen waverley': { house: 600, unit: 450, room: 240 },
      'docklands': { house: null, unit: 520, room: 280 },
      'southbank': { house: null, unit: 550, room: 290 },
      'brunswick': { house: 600, unit: 450, room: 240 },
      'preston': { house: 550, unit: 420, room: 230 },
      'dandenong': { house: 450, unit: 380, room: 200 }
    }
  },
  brisbane: {
    overall: { house: 580, unit: 480, room: 230 },
    suburbs: {
      'cbd': { house: null, unit: 550, room: 280 },
      'south brisbane': { house: 700, unit: 530, room: 270 },
      'fortitude valley': { house: null, unit: 500, room: 260 },
      'west end': { house: 700, unit: 500, room: 260 },
      'toowong': { house: 600, unit: 470, room: 240 },
      'sunnybank': { house: 550, unit: 430, room: 220 },
      'indooroopilly': { house: 600, unit: 450, room: 230 },
      'chermside': { house: 530, unit: 430, room: 220 }
    }
  },
  perth: {
    overall: { house: 600, unit: 480, room: 220 },
    suburbs: {
      'cbd': { house: null, unit: 520, room: 270 },
      'subiaco': { house: 700, unit: 480, room: 250 },
      'fremantle': { house: 650, unit: 470, room: 240 },
      'victoria park': { house: 550, unit: 430, room: 220 },
      'east perth': { house: null, unit: 500, room: 260 }
    }
  },
  adelaide: {
    overall: { house: 480, unit: 380, room: 200 },
    suburbs: {
      'cbd': { house: null, unit: 420, room: 230 },
      'north adelaide': { house: 550, unit: 400, room: 220 },
      'glenelg': { house: 500, unit: 380, room: 210 },
      'norwood': { house: 500, unit: 380, room: 210 }
    }
  },
  canberra: {
    overall: { house: 620, unit: 500, room: 250 },
    suburbs: {
      'civic': { house: null, unit: 520, room: 270 },
      'belconnen': { house: 580, unit: 460, room: 240 },
      'woden': { house: 600, unit: 480, room: 240 }
    }
  }
};

// 城市中位房价 (2025-2026 estimates)
const HOUSE_PRICES = {
  sydney: { house: 1450000, unit: 820000 },
  melbourne: { house: 950000, unit: 580000 },
  brisbane: { house: 850000, unit: 520000 },
  perth: { house: 750000, unit: 450000 },
  adelaide: { house: 720000, unit: 430000 },
  canberra: { house: 880000, unit: 550000 },
  hobart: { house: 650000, unit: 450000 },
  darwin: { house: 550000, unit: 350000 },
  'gold coast': { house: 900000, unit: 580000 }
};

// City resolution — LLM translates Chinese to English, tool matches English city names
function resolveCity(location) {
  const lower = (location || 'sydney').toLowerCase().trim();
  // Direct match against known cities
  for (const city of Object.keys(RENT_GUIDE)) {
    if (lower === city || lower.includes(city)) return city;
  }
  // Reverse check: city name within input
  for (const city of Object.keys(RENT_GUIDE)) {
    if (city.includes(lower) && lower.length >= 3) return city;
  }
  return 'sydney';
}

function resolveSuburb(location) {
  const lower = (location || '').toLowerCase().trim();
  // Try to extract suburb from input like "Sydney Newtown"
  const words = lower.split(/[\s,]+/);
  for (const word of words) {
    // Check all cities' suburbs
    for (const city of Object.values(RENT_GUIDE)) {
      if (city.suburbs[word]) return word;
    }
  }
  return null;
}

export async function searchProperty(args, env) {
  const location = args.location || args.query || 'Sydney';
  const type = (args.type || args.property_type || 'rent').toLowerCase();
  const bedrooms = args.bedrooms || null;

  const city = resolveCity(location);
  const suburb = resolveSuburb(location);

  // If Domain API key is available, try real search
  if (env?.DOMAIN_API_KEY) {
    try {
      return await domainAPISearch(env.DOMAIN_API_KEY, location, type, bedrooms);
    } catch (e) {
      console.error('Domain API failed:', e.message);
      // Fall through to built-in data
    }
  }

  if (type === 'buy' || type === 'sale' || type === '买房') {
    const prices = HOUSE_PRICES[city];
    if (!prices) {
      return {
        location, type: 'buy',
        message: `No price data for ${location}`,
        tip: 'Try Sydney, Melbourne, Brisbane, Perth, Adelaide, or Canberra'
      };
    }
    return {
      location: city,
      type: 'buy',
      median_prices: {
        house: `$${(prices.house / 1000).toFixed(0)}k`,
        unit: `$${(prices.unit / 1000).toFixed(0)}k`,
        house_raw: prices.house,
        unit_raw: prices.unit
      },
      stamp_duty_estimate: {
        first_home_buyer: `~$${Math.round(prices.unit * 0.02 / 1000)}k (concessions may apply)`,
        investor: `~$${Math.round(prices.house * 0.045 / 1000)}k`
      },
      tips: [
        'First Home Buyer schemes available in all states',
        'Consider stamp duty concessions for properties under thresholds',
        'Check First Home Super Saver Scheme (FHSSS) for saving through super'
      ],
      search_links: {
        domain: `https://www.domain.com.au/sale/${city}/`,
        realestate: `https://www.realestate.com.au/buy/in-${city}/`
      },
      source: 'built-in market estimates',
      disclaimer: 'Prices are approximate median values. Actual prices vary significantly by suburb and property.'
    };
  }

  // Rental search
  const cityData = RENT_GUIDE[city];
  if (!cityData) {
    return {
      location, type: 'rent',
      message: `No rental data for ${location}`,
      tip: 'Try Sydney, Melbourne, Brisbane, Perth, Adelaide, or Canberra'
    };
  }

  let suburbData = null;
  let suburbName = suburb;
  if (suburb && cityData.suburbs[suburb]) {
    suburbData = cityData.suburbs[suburb];
  }

  const result = {
    location: city,
    suburb: suburbName || 'all',
    type: 'rent',
    weekly_rent: suburbData || cityData.overall,
    monthly_estimate: {
      house: suburbData ? `$${Math.round((suburbData.house || 0) * 52 / 12)}` : `$${Math.round(cityData.overall.house * 52 / 12)}`,
      unit: suburbData ? `$${Math.round((suburbData.unit || 0) * 52 / 12)}` : `$${Math.round(cityData.overall.unit * 52 / 12)}`,
      room: suburbData ? `$${Math.round((suburbData.room || 0) * 52 / 12)}` : `$${Math.round(cityData.overall.room * 52 / 12)}`
    },
    popular_suburbs: Object.entries(cityData.suburbs).slice(0, 8).map(([name, data]) => ({
      suburb: name,
      unit_weekly: data.unit,
      room_weekly: data.room
    })),
    tips: [
      `${city} average rental vacancy rate: ~1-2%`,
      'Bond/deposit is typically 4 weeks rent',
      'Apply through domain.com.au or realestate.com.au',
      'Inspect in person before signing lease',
      'Check public transport access and walk score'
    ],
    search_links: {
      domain: `https://www.domain.com.au/rent/${suburb || city}/`,
      realestate: `https://www.realestate.com.au/rent/in-${suburb || city}/`
    },
    source: 'built-in market estimates (2025-2026)',
    disclaimer: 'Prices are approximate. Check listing sites for current availability.'
  };

  // Forum enrichment: race with 1.5s timeout
  try {
    const { forumEnrich } = await import('./cn-forums.js');
    const area = suburb || city;
    const timeout = new Promise(r => setTimeout(() => r([]), 1500));
    const forumData = await Promise.race([forumEnrich(`${area} 租房 经验 怎么样`, 'rental', env), timeout]);
    if (forumData.length > 0) {
      result.community_experiences = forumData;
      result.community_note = '💬 以上为华人论坛租房经验分享，仅供参考。';
    }
  } catch {}

  return result;
}

// Domain.com.au API integration (when API key available)
async function domainAPISearch(apiKey, location, type, bedrooms) {
  const listingType = type === 'buy' || type === 'sale' ? 'Sale' : 'Rent';

  const body = {
    listingType,
    locations: [{ state: '', suburb: location }],
    pageSize: 10
  };
  if (bedrooms) body.minBedrooms = bedrooms;

  const resp = await fetch('https://api.domain.com.au/v1/listings/residential/_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) throw new Error(`Domain API error: ${resp.status}`);
  const data = await resp.json();

  return {
    location, type, source: 'Domain.com.au API',
    listings: (data || []).slice(0, 5).map(l => ({
      headline: l.listing?.headline || '',
      price: l.listing?.priceDetails?.displayPrice || '',
      address: l.listing?.propertyDetails?.displayableAddress || '',
      bedrooms: l.listing?.propertyDetails?.bedrooms || 0,
      bathrooms: l.listing?.propertyDetails?.bathrooms || 0,
      url: l.listing?.seoUrl ? `https://www.domain.com.au/${l.listing.seoUrl}` : ''
    }))
  };
}
