/**
 * Nearby Recommendations Tool — GPS-based nearby place discovery
 * Uses Google Places Nearby Search (New) API with user's real location
 */

// Type mappings for common queries
const TYPE_MAP = {
  // Food & Drink
  '餐厅': 'restaurant', '饭店': 'restaurant', '吃饭': 'restaurant', 'restaurant': 'restaurant',
  '中餐': 'chinese_restaurant', '中国菜': 'chinese_restaurant', 'chinese': 'chinese_restaurant',
  '日料': 'japanese_restaurant', '日本菜': 'japanese_restaurant', 'japanese': 'japanese_restaurant',
  '韩餐': 'korean_restaurant', '韩国菜': 'korean_restaurant', 'korean': 'korean_restaurant',
  '咖啡': 'cafe', '咖啡厅': 'cafe', 'cafe': 'cafe', 'coffee': 'cafe',
  '酒吧': 'bar', 'bar': 'bar', 'pub': 'bar',
  '面包': 'bakery', '蛋糕': 'bakery', 'bakery': 'bakery',
  '快餐': 'fast_food_restaurant', 'fast food': 'fast_food_restaurant',
  '甜点': 'ice_cream_shop', 'dessert': 'ice_cream_shop',
  '外卖': 'meal_takeaway', 'takeaway': 'meal_takeaway',

  // Shopping
  '超市': 'supermarket', 'supermarket': 'supermarket', 'woolworths': 'supermarket', 'coles': 'supermarket',
  '商场': 'shopping_mall', 'mall': 'shopping_mall', 'shopping': 'shopping_mall',
  '便利店': 'convenience_store', 'convenience': 'convenience_store',

  // Health
  '药房': 'pharmacy', '药店': 'pharmacy', 'pharmacy': 'pharmacy', 'chemist': 'pharmacy',
  '医院': 'hospital', 'hospital': 'hospital',
  '诊所': 'doctor', 'gp': 'doctor', 'doctor': 'doctor', 'clinic': 'doctor',
  '牙医': 'dentist', 'dentist': 'dentist',

  // Transport
  '加油站': 'gas_station', 'petrol': 'gas_station', 'gas station': 'gas_station',
  '停车场': 'parking', 'parking': 'parking',
  '火车站': 'train_station', 'train': 'train_station',
  '公交': 'bus_station', 'bus': 'bus_station',

  // Services
  '银行': 'bank', 'bank': 'bank', 'atm': 'atm',
  '邮局': 'post_office', 'post office': 'post_office',
  '洗衣': 'laundry', 'laundry': 'laundry',
  '理发': 'hair_salon', '美发': 'hair_salon', 'barber': 'hair_salon',
  '健身': 'gym', '健身房': 'gym', 'gym': 'gym',

  // Entertainment & Leisure
  '公园': 'park', 'park': 'park',
  '景点': 'tourist_attraction', '旅游': 'tourist_attraction', 'tourist': 'tourist_attraction',
  '电影': 'movie_theater', 'cinema': 'movie_theater', 'movie': 'movie_theater',
  '图书馆': 'library', 'library': 'library',
  '博物馆': 'museum', 'museum': 'museum',

  // Education
  '学校': 'school', 'school': 'school',
  '大学': 'university', 'university': 'university',
  '幼儿园': 'preschool', 'childcare': 'preschool',
};

// Default popular types for "附近有什么" type queries
const DEFAULT_TYPES = ['restaurant', 'cafe', 'supermarket', 'pharmacy'];

// Geocode any location text to coordinates using Google Geocoding API
// Supports any language (Chinese, English, etc.) — no hardcoded dictionary needed
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_COORDS = { lat: -33.8688, lng: 151.2093, resolved_name: 'Sydney, Australia' };

async function geocodeLocation(text, apiKey) {
  if (!text || !apiKey) return DEFAULT_COORDS;
  try {
    const url = `${GEOCODE_BASE}?address=${encodeURIComponent(text + ' Australia')}&key=${apiKey}&region=au&language=en`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status === 'OK' && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng, resolved_name: data.results[0].formatted_address };
    }
  } catch (e) { /* geocoding failed, use default */ }
  return DEFAULT_COORDS;
}

/**
 * Resolve query text to Google Places type
 */
function resolveType(query) {
  if (!query) return null;
  const lower = query.toLowerCase();
  
  // Direct match
  for (const [keyword, type] of Object.entries(TYPE_MAP)) {
    if (lower.includes(keyword)) return type;
  }
  return null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format distance for display
 */
function formatDistance(meters) {
  if (meters < 100) return `${Math.round(meters)}m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Nearby search using Google Places API (New) - Nearby Search
 */
export async function searchNearby(args, env) {
  const apiKey = env?.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { error: 'Google Places API key not configured' };

  let latitude = args.latitude;
  let longitude = args.longitude;
  const query = args.query || '';
  const radius = args.radius || 1500; // default 1.5km
  const maxResults = args.max_results || 10;
  let locationSource = 'gps';

  // Fallback to geocoded coordinates if no GPS provided
  if (!latitude || !longitude) {
    const cityName = args.location || args.city;
    if (!cityName) {
      return { error: 'Location required: provide latitude+longitude (GPS) or location city name' };
    }
    const coords = await geocodeLocation(cityName, apiKey);
    latitude = coords.lat;
    longitude = coords.lng;
    locationSource = `city:${coords.resolved_name}`;
  }

  // Resolve type from query
  const resolvedType = args.type || resolveType(query);
  const useTextSearch = !resolvedType;

  const fieldMask = 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.nationalPhoneNumber,places.googleMapsUri,places.currentOpeningHours,places.location,places.primaryType';

  try {
    let data;

    if (useTextSearch && query) {
      // Use Text Search with location bias for free-form queries
      const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: maxResults,
          languageCode: 'zh-CN',
          locationBias: {
            circle: {
              center: { latitude, longitude },
              radius: radius
            }
          }
        })
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Places API error: ${resp.status} - ${err.slice(0, 200)}`);
      }
      data = await resp.json();
    } else {
      // Use Nearby Search for typed queries
      const types = resolvedType ? [resolvedType] : DEFAULT_TYPES;
      
      const resp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify({
          includedTypes: types,
          maxResultCount: maxResults,
          languageCode: 'zh-CN',
          locationRestriction: {
            circle: {
              center: { latitude, longitude },
              radius: radius
            }
          },
          rankPreference: 'DISTANCE'
        })
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Places Nearby API error: ${resp.status} - ${err.slice(0, 200)}`);
      }
      data = await resp.json();
    }

    const places = (data.places || []).map(p => {
      const placeLat = p.location?.latitude;
      const placeLon = p.location?.longitude;
      const distance = (placeLat && placeLon) ? calcDistance(latitude, longitude, placeLat, placeLon) : null;

      return {
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        rating: p.rating || null,
        reviews: p.userRatingCount || 0,
        price_level: p.priceLevel || null,
        phone: p.nationalPhoneNumber || null,
        maps_url: p.googleMapsUri || null,
        open_now: p.currentOpeningHours?.openNow ?? null,
        distance: distance ? formatDistance(distance) : null,
        distance_meters: distance ? Math.round(distance) : null,
        type: p.primaryType || (p.types || [])[0] || null
      };
    });

    // Sort by distance
    places.sort((a, b) => (a.distance_meters || 99999) - (b.distance_meters || 99999));

    return {
      query: query || '附近推荐',
      type: resolvedType || 'mixed',
      location_source: locationSource,
      user_location: { latitude, longitude },
      radius_m: radius,
      count: places.length,
      places
    };
  } catch (err) {
    return { error: err.message, query, latitude, longitude };
  }
}
