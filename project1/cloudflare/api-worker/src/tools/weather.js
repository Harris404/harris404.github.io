/**
 * Weather Tool — BOM (Bureau of Meteorology) API
 * https://api.weather.bom.gov.au/v1
 */

const BOM_BASE = 'https://api.weather.bom.gov.au/v1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function searchLocation(query) {
  const resp = await fetch(`${BOM_BASE}/locations?search=${encodeURIComponent(query)}`, { headers: HEADERS });
  if (!resp.ok) throw new Error(`BOM location search failed: ${resp.status}`);
  const data = await resp.json();
  return data?.data || [];
}

async function getDailyForecast(geohash) {
  const resp = await fetch(`${BOM_BASE}/locations/${geohash}/forecasts/daily`, { headers: HEADERS });
  if (!resp.ok) throw new Error(`BOM forecast failed: ${resp.status}`);
  return await resp.json();
}

async function getObservations(geohash) {
  const resp = await fetch(`${BOM_BASE}/locations/${geohash}/observations`, { headers: HEADERS });
  if (!resp.ok) return null;
  return await resp.json();
}

export async function getWeather(args) {
  const location = args.location || 'Sydney';

  // Step 1: Search location → get geohash
  const locations = await searchLocation(location);
  if (!locations.length) {
    return { error: `Location "${location}" not found`, suggestion: 'Try an Australian city or suburb name' };
  }

  const loc = locations[0];
  const geohash = loc.geohash;

  // Step 2: Get forecast + observations in parallel
  const [forecast, observations] = await Promise.all([
    getDailyForecast(geohash),
    getObservations(geohash).catch(() => null)
  ]);

  // Step 3: Format response
  const days = (forecast?.data || []).slice(0, 5).map(d => ({
    date: d.date,
    temp_max: d.temp_max,
    temp_min: d.temp_min,
    description: d.short_text || d.extended_text,
    rain_chance: d.rain?.chance,
    rain_amount: d.rain?.amount?.max,
    uv_category: d.uv?.category,
    fire_danger: d.fire_danger
  }));

  const current = observations?.data ? {
    temp: observations.data.temp,
    humidity: observations.data.humidity,
    wind_speed: observations.data.wind?.speed_kilometre,
    wind_direction: observations.data.wind?.direction,
    rain_since_9am: observations.data.rain_since_9am
  } : null;

  return {
    location: loc.name || location,
    state: loc.state,
    geohash,
    current,
    forecast: days
  };
}
