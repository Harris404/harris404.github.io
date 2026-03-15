/**
 * Air Quality Index (AQI) Tool
 * Uses free APIs:
 * - WAQI (World Air Quality Index): https://aqicn.org/data-platform/token/
 * - NSW Air Quality API (fallback)
 * 
 * No API key needed for basic station feeds
 */

// WAQI provides free JSON feed per city
const WAQI_BASE = 'https://api.waqi.info/feed';

// Free public token for WAQI (demo token, rate limited)
// Users can register their own at https://aqicn.org/data-platform/token/
const WAQI_TOKEN = 'demo';

// Major Australian city station mappings
const CITY_STATIONS = {
  sydney: { waqi: 'sydney', nsw_id: 'CBD', name: 'Sydney CBD' },
  melbourne: { waqi: 'melbourne', name: 'Melbourne CBD' },
  brisbane: { waqi: 'brisbane', name: 'Brisbane CBD' },
  perth: { waqi: 'perth', name: 'Perth CBD' },
  adelaide: { waqi: 'adelaide', name: 'Adelaide CBD' },
  canberra: { waqi: 'canberra', name: 'Canberra' },
  hobart: { waqi: 'hobart', name: 'Hobart' },
  darwin: { waqi: 'darwin', name: 'Darwin' },
  'gold coast': { waqi: 'gold-coast', name: 'Gold Coast' },
  parramatta: { waqi: 'parramatta', name: 'Parramatta' },
  chatswood: { waqi: 'chatswood', name: 'Chatswood' },
};

// AQI level descriptions
const AQI_LEVELS = [
  { max: 50, level: 'Good', emoji: '🟢', cn: '优', advice: '空气质量优良，适合户外活动' },
  { max: 100, level: 'Moderate', emoji: '🟡', cn: '良', advice: '空气质量可接受，敏感人群可能有轻微影响' },
  { max: 150, level: 'Unhealthy for Sensitive', emoji: '🟠', cn: '轻度污染', advice: '哮喘/心脏病患者应减少户外活动' },
  { max: 200, level: 'Unhealthy', emoji: '🔴', cn: '中度污染', advice: '所有人应减少长时间户外运动' },
  { max: 300, level: 'Very Unhealthy', emoji: '🟣', cn: '重度污染', advice: '避免户外活动，关闭门窗' },
  { max: 999, level: 'Hazardous', emoji: '⬛', cn: '严重污染', advice: '所有人留在室内，佩戴P2口罩' },
];

export async function getAirQuality(args, env) {
  const city = (args.city || args.location || args.query || 'sydney').toLowerCase().trim();
  
  // Find station
  const station = CITY_STATIONS[city] || { waqi: city, name: city };
  
  try {
    // Try WAQI API
    const data = await fetchWAQI(station.waqi, env);
    if (data) return formatResult(data, station, city);
    
    // Fallback: try geo-based search
    const geoData = await fetchWAQIByGeo(city, env);
    if (geoData) return formatResult(geoData, station, city);
    
  } catch (err) {
    // continue to fallback
  }
  
  return {
    city: station.name || city,
    available: false,
    message: `暂时无法获取 ${station.name || city} 的空气质量数据。`,
    tip: '可以浏览 aqicn.org 查看实时空气质量。',
    available_cities: Object.keys(CITY_STATIONS),
    manual_check: `https://aqicn.org/#/c/-25.274/133.775/z5`,
  };
}

async function fetchWAQI(stationId, env) {
  // Try with env token first, then demo token
  const token = env?.WAQI_TOKEN || WAQI_TOKEN;
  const url = `${WAQI_BASE}/${stationId}/?token=${token}`;
  
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  
  if (!res.ok) return null;
  const data = await res.json();
  
  if (data.status !== 'ok' || !data.data) return null;
  return data.data;
}

async function fetchWAQIByGeo(city, env) {
  // Approximate coords for Australian cities
  const coords = {
    sydney: [-33.87, 151.21],
    melbourne: [-37.81, 144.96],
    brisbane: [-27.47, 153.03],
    perth: [-31.95, 115.86],
    adelaide: [-34.93, 138.60],
    canberra: [-35.28, 149.13],
    hobart: [-42.88, 147.33],
    darwin: [-12.46, 130.84],
  };
  
  const coord = coords[city];
  if (!coord) return null;
  
  const token = env?.WAQI_TOKEN || WAQI_TOKEN;
  const url = `${WAQI_BASE}/geo:${coord[0]};${coord[1]}/?token=${token}`;
  
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  
  if (data.status !== 'ok') return null;
  return data.data;
}

function formatResult(data, station, city) {
  const aqi = data.aqi;
  const level = AQI_LEVELS.find(l => aqi <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
  
  // Extract pollutant values
  const iaqi = data.iaqi || {};
  const pollutants = {};
  if (iaqi.pm25?.v !== undefined) pollutants.PM2_5 = { value: iaqi.pm25.v, unit: 'μg/m³' };
  if (iaqi.pm10?.v !== undefined) pollutants.PM10 = { value: iaqi.pm10.v, unit: 'μg/m³' };
  if (iaqi.o3?.v !== undefined) pollutants.O3 = { value: iaqi.o3.v, unit: 'ppb' };
  if (iaqi.no2?.v !== undefined) pollutants.NO2 = { value: iaqi.no2.v, unit: 'ppb' };
  if (iaqi.so2?.v !== undefined) pollutants.SO2 = { value: iaqi.so2.v, unit: 'ppb' };
  if (iaqi.co?.v !== undefined) pollutants.CO = { value: iaqi.co.v, unit: 'ppm' };
  
  // Weather data if available
  const weather = {};
  if (iaqi.t?.v !== undefined) weather.temperature = `${iaqi.t.v}°C`;
  if (iaqi.h?.v !== undefined) weather.humidity = `${iaqi.h.v}%`;
  if (iaqi.w?.v !== undefined) weather.wind = `${iaqi.w.v} m/s`;
  if (iaqi.p?.v !== undefined) weather.pressure = `${iaqi.p.v} hPa`;
  
  // Forecast if available
  const forecast = {};
  if (data.forecast?.daily) {
    for (const [pollutant, days] of Object.entries(data.forecast.daily)) {
      if (days?.length > 0) {
        forecast[pollutant] = days.slice(0, 3).map(d => ({
          date: d.day, avg: d.avg, min: d.min, max: d.max,
        }));
      }
    }
  }
  
  return {
    city: station.name || city,
    aqi,
    level: level.level,
    level_cn: level.cn,
    emoji: level.emoji,
    health_advice: level.advice,
    dominant_pollutant: data.dominentpol || 'pm25',
    pollutants,
    weather: Object.keys(weather).length > 0 ? weather : undefined,
    forecast: Object.keys(forecast).length > 0 ? forecast : undefined,
    station: data.city?.name || station.name,
    updated: data.time?.s || new Date().toISOString(),
    source: 'World Air Quality Index (WAQI) + EPA monitoring stations',
    url: data.city?.url ? `https://aqicn.org${data.city.url}` : `https://aqicn.org/#/c/-25.274/133.775/z5`,
    available_cities: Object.keys(CITY_STATIONS),
    tips: {
      bushfire_season: '11月-3月是丛林火灾季节，空气质量可能快速恶化。',
      masks: 'AQI > 150 时建议佩戴 P2/N95 口罩。',
      indoor: '如 AQI > 100，保持窗户关闭，使用空气净化器。',
    },
  };
}
