/**
 * Healthcare Tool — Overpass API (OpenStreetMap) + MyHospitals
 */

// City coordinates database
const CITY_COORDS = {
  sydney: { lat: -33.8688, lon: 151.2093 },
  melbourne: { lat: -37.8136, lon: 144.9631 },
  brisbane: { lat: -27.4705, lon: 153.0260 },
  perth: { lat: -31.9505, lon: 115.8605 },
  adelaide: { lat: -34.9285, lon: 138.6007 },
  canberra: { lat: -35.2809, lon: 149.1300 },
  hobart: { lat: -42.8821, lon: 147.3272 },
  darwin: { lat: -12.4634, lon: 130.8456 },
  'gold coast': { lat: -28.0167, lon: 153.4000 },
  newcastle: { lat: -32.9283, lon: 151.7817 },
  wollongong: { lat: -34.4278, lon: 150.8931 },
  geelong: { lat: -38.1499, lon: 144.3617 },
  townsville: { lat: -19.2590, lon: 146.8169 },
  cairns: { lat: -16.9186, lon: 145.7781 },
  parramatta: { lat: -33.8151, lon: 151.0011 },
  bankstown: { lat: -33.9175, lon: 151.0350 },
  blacktown: { lat: -33.7688, lon: 150.9063 },
  hurstville: { lat: -33.9676, lon: 151.1021 },
  burwood: { lat: -33.8773, lon: 151.1042 },
  chatswood: { lat: -33.7969, lon: 151.1831 },
  bondi: { lat: -33.8908, lon: 151.2743 },
  'sydney cbd': { lat: -33.8688, lon: 151.2093 },
  'melbourne cbd': { lat: -37.8136, lon: 144.9631 },
  unsw: { lat: -33.9173, lon: 151.2313 },
  usyd: { lat: -33.8886, lon: 151.1873 },
  uts: { lat: -33.8834, lon: 151.2006 },
  macquarie: { lat: -33.7738, lon: 151.1126 }
};

const FACILITY_MAP = {
  gp: 'doctors', doctor: 'doctors', doctors: 'doctors', clinic: 'clinic',
  hospital: 'hospital', hospitals: 'hospital',
  pharmacy: 'pharmacy', chemist: 'pharmacy',
  dentist: 'dentist', dental: 'dentist',
  optometrist: 'optometrist', pathology: 'clinic',
  physiotherapy: 'physiotherapist', psychologist: 'psychologist',
  '药房': 'pharmacy', '医院': 'hospital', '诊所': 'doctors', '牙医': 'dentist',
  '药店': 'pharmacy', '医生': 'doctors'
};

function resolveCoords(location) {
  const lower = (location || 'sydney').toLowerCase().trim();
  if (CITY_COORDS[lower]) return CITY_COORDS[lower];
  // Try partial match
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(key) || key.includes(lower)) return coords;
  }
  return CITY_COORDS.sydney; // default
}

function resolveType(facilityType) {
  const lower = (facilityType || 'doctors').toLowerCase().trim();
  return FACILITY_MAP[lower] || lower;
}

export async function searchFacilities(args) {
  const location = args.location || 'Sydney';
  const facilityType = args.facility_type || 'doctors';
  const radius = args.radius || 2000;
  const limit = args.limit || 10;

  const coords = resolveCoords(location);
  const osmType = resolveType(facilityType);

  // Build Overpass query
  const overpassQuery = `[out:json][timeout:15];
(
  node["amenity"="${osmType}"](around:${radius},${coords.lat},${coords.lon});
  way["amenity"="${osmType}"](around:${radius},${coords.lat},${coords.lon});
);
out body ${limit};`;

  try {
    const resp = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
      { headers: { 'User-Agent': 'AustralianAssistant/1.0' } }
    );

    if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);
    const data = await resp.json();

    const facilities = (data.elements || []).map(el => ({
      name: el.tags?.name || 'Unknown',
      type: el.tags?.amenity || osmType,
      address: [el.tags?.['addr:street'], el.tags?.['addr:suburb'], el.tags?.['addr:postcode']]
        .filter(Boolean).join(', '),
      phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
      website: el.tags?.website || el.tags?.['contact:website'] || null,
      opening_hours: el.tags?.opening_hours || null,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon
    }));

    return {
      location,
      facility_type: facilityType,
      radius_m: radius,
      count: facilities.length,
      facilities
    };
  } catch (err) {
    return {
      error: `Failed to search facilities: ${err.message}`,
      location, facility_type: facilityType,
      suggestion: 'Try a major Australian city name'
    };
  }
}
