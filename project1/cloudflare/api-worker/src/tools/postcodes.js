/**
 * Postcodes Tool — Australian postcode lookup
 * Uses D1 database or inline data
 */

// Common postcodes for quick lookup (top ~80 suburbs)
const COMMON_POSTCODES = {
  '2000': { suburb: 'Sydney', state: 'NSW', lat: -33.8688, lon: 151.2093 },
  '2010': { suburb: 'Surry Hills', state: 'NSW', lat: -33.8838, lon: 151.2116 },
  '2011': { suburb: 'Potts Point', state: 'NSW', lat: -33.8697, lon: 151.2264 },
  '2020': { suburb: 'Mascot', state: 'NSW', lat: -33.9275, lon: 151.1942 },
  '2021': { suburb: 'Paddington', state: 'NSW', lat: -33.8842, lon: 151.2267 },
  '2031': { suburb: 'Randwick', state: 'NSW', lat: -33.9138, lon: 151.2410 },
  '2040': { suburb: 'Leichhardt', state: 'NSW', lat: -33.8826, lon: 151.1569 },
  '2042': { suburb: 'Newtown', state: 'NSW', lat: -33.8970, lon: 151.1785 },
  '2050': { suburb: 'Camperdown', state: 'NSW', lat: -33.8891, lon: 151.1764 },
  '2060': { suburb: 'North Sydney', state: 'NSW', lat: -33.8369, lon: 151.2083 },
  '2065': { suburb: 'Chatswood', state: 'NSW', lat: -33.7969, lon: 151.1831 },
  '2077': { suburb: 'Hornsby', state: 'NSW', lat: -33.7025, lon: 151.0990 },
  '2100': { suburb: 'Brookvale', state: 'NSW', lat: -33.7646, lon: 151.2738 },
  '2113': { suburb: 'Macquarie Park', state: 'NSW', lat: -33.7738, lon: 151.1126 },
  '2140': { suburb: 'Homebush', state: 'NSW', lat: -33.8659, lon: 151.0847 },
  '2145': { suburb: 'Westmead', state: 'NSW', lat: -33.8080, lon: 150.9878 },
  '2150': { suburb: 'Parramatta', state: 'NSW', lat: -33.8151, lon: 151.0011 },
  '2170': { suburb: 'Liverpool', state: 'NSW', lat: -33.9209, lon: 150.9234 },
  '2200': { suburb: 'Bankstown', state: 'NSW', lat: -33.9175, lon: 151.0350 },
  '2220': { suburb: 'Hurstville', state: 'NSW', lat: -33.9676, lon: 151.1021 },
  '2250': { suburb: 'Gosford', state: 'NSW', lat: -33.4258, lon: 151.3420 },
  '2300': { suburb: 'Newcastle', state: 'NSW', lat: -32.9283, lon: 151.7817 },
  '2500': { suburb: 'Wollongong', state: 'NSW', lat: -34.4278, lon: 150.8931 },
  '2600': { suburb: 'Canberra', state: 'ACT', lat: -35.2809, lon: 149.1300 },
  '2611': { suburb: 'Weston Creek', state: 'ACT', lat: -35.3407, lon: 149.0566 },
  '2617': { suburb: 'Belconnen', state: 'ACT', lat: -35.2384, lon: 149.0674 },
  '3000': { suburb: 'Melbourne', state: 'VIC', lat: -37.8136, lon: 144.9631 },
  '3004': { suburb: 'St Kilda Road', state: 'VIC', lat: -37.8393, lon: 144.9742 },
  '3006': { suburb: 'Southbank', state: 'VIC', lat: -37.8226, lon: 144.9641 },
  '3008': { suburb: 'Docklands', state: 'VIC', lat: -37.8158, lon: 144.9466 },
  '3053': { suburb: 'Carlton', state: 'VIC', lat: -37.8000, lon: 144.9692 },
  '3121': { suburb: 'Richmond', state: 'VIC', lat: -37.8182, lon: 145.0000 },
  '3141': { suburb: 'South Yarra', state: 'VIC', lat: -37.8389, lon: 144.9913 },
  '3168': { suburb: 'Clayton', state: 'VIC', lat: -37.9145, lon: 145.1290 },
  '3175': { suburb: 'Dandenong', state: 'VIC', lat: -37.9870, lon: 145.2162 },
  '3220': { suburb: 'Geelong', state: 'VIC', lat: -38.1499, lon: 144.3617 },
  '4000': { suburb: 'Brisbane City', state: 'QLD', lat: -27.4705, lon: 153.0260 },
  '4006': { suburb: 'Fortitude Valley', state: 'QLD', lat: -27.4574, lon: 153.0347 },
  '4101': { suburb: 'South Brisbane', state: 'QLD', lat: -27.4803, lon: 153.0189 },
  '4217': { suburb: 'Gold Coast', state: 'QLD', lat: -28.0167, lon: 153.4000 },
  '4350': { suburb: 'Toowoomba', state: 'QLD', lat: -27.5584, lon: 151.9537 },
  '4670': { suburb: 'Bundaberg', state: 'QLD', lat: -24.8662, lon: 152.3479 },
  '4810': { suburb: 'Townsville', state: 'QLD', lat: -19.2590, lon: 146.8169 },
  '4870': { suburb: 'Cairns', state: 'QLD', lat: -16.9186, lon: 145.7781 },
  '5000': { suburb: 'Adelaide', state: 'SA', lat: -34.9285, lon: 138.6007 },
  '5006': { suburb: 'North Adelaide', state: 'SA', lat: -34.9060, lon: 138.6006 },
  '6000': { suburb: 'Perth', state: 'WA', lat: -31.9505, lon: 115.8605 },
  '6005': { suburb: 'West Perth', state: 'WA', lat: -31.9500, lon: 115.8439 },
  '6027': { suburb: 'Joondalup', state: 'WA', lat: -31.7466, lon: 115.7667 },
  '6230': { suburb: 'Bunbury', state: 'WA', lat: -33.3271, lon: 115.6381 },
  '7000': { suburb: 'Hobart', state: 'TAS', lat: -42.8821, lon: 147.3272 },
  '7250': { suburb: 'Launceston', state: 'TAS', lat: -41.4332, lon: 147.1441 },
  '0800': { suburb: 'Darwin', state: 'NT', lat: -12.4634, lon: 130.8456 },
  '0870': { suburb: 'Alice Springs', state: 'NT', lat: -23.6980, lon: 133.8807 }
};

export async function searchPostcode(args) {
  const query = (args.query || '').trim();
  if (!query) return { error: 'Please provide a postcode or suburb name' };

  // Exact postcode match
  if (/^\d{4}$/.test(query)) {
    const match = COMMON_POSTCODES[query];
    if (match) {
      return {
        query,
        results: [{ postcode: query, ...match }],
        count: 1
      };
    }
    return {
      query,
      results: [],
      message: `Postcode ${query} not found in quick lookup. It may still be valid.`,
      state_hint: query[0] === '2' ? 'NSW/ACT' : query[0] === '3' ? 'VIC' : query[0] === '4' ? 'QLD' : query[0] === '5' ? 'SA' : query[0] === '6' ? 'WA' : query[0] === '7' ? 'TAS' : 'NT'
    };
  }

  // Suburb name search
  const lower = query.toLowerCase();
  const results = [];
  for (const [code, data] of Object.entries(COMMON_POSTCODES)) {
    if (data.suburb.toLowerCase().includes(lower) || lower.includes(data.suburb.toLowerCase())) {
      results.push({ postcode: code, ...data });
    }
  }

  if (results.length > 0) {
    return { query, results: results.slice(0, 10), count: results.length };
  }

  return {
    query,
    results: [],
    message: `No results for "${query}". Try a major Australian city, suburb, or 4-digit postcode.`,
    tip: 'Australian postcodes: NSW=2xxx, VIC=3xxx, QLD=4xxx, SA=5xxx, WA=6xxx, TAS=7xxx, NT=08xx'
  };
}
