/**
 * Directions Tool — Google Maps Directions API
 * 路线规划：支持公共交通、驾车、步行、骑行
 * 覆盖全澳大利亚（不限于 NSW）
 */

const DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * 解析地理坐标为最近的人类可读地址（reverse geocode）
 */
async function coordsToAddress(lat, lng, apiKey) {
  try {
    const url = `${GEOCODE_BASE}?latlng=${lat},${lng}&key=${apiKey}&language=en`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.results?.[0]) {
      return data.results[0].formatted_address;
    }
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * 格式化时长（秒 → "X小时Y分钟"）
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

/**
 * 格式化距离（米 → "X.X km" 或 "XXX m"）
 */
function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

/**
 * 解析路线步骤（transit 模式特别详细）
 */
function parseSteps(steps) {
  return steps.map((step, i) => {
    const base = {
      step: i + 1,
      instruction: step.html_instructions?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      distance: step.distance?.text,
      duration: step.duration?.text,
      travel_mode: step.travel_mode
    };

    if (step.travel_mode === 'TRANSIT' && step.transit_details) {
      const td = step.transit_details;
      base.transit = {
        line_name: td.line?.name || td.line?.short_name,
        line_color: td.line?.color,
        vehicle_type: td.line?.vehicle?.type,
        departure_stop: td.departure_stop?.name,
        arrival_stop: td.arrival_stop?.name,
        num_stops: td.num_stops,
        departure_time: td.departure_time?.text,
        arrival_time: td.arrival_time?.text,
        headsign: td.headsign
      };
    }

    if (step.travel_mode === 'WALKING' && step.steps) {
      base.sub_steps = step.steps.map(s =>
        s.html_instructions?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      ).filter(Boolean);
    }

    return base;
  });
}
/**
 * Get Unix timestamp for next 7:00 AM AEST (UTC+10)
 */
function _getNext7amAEST() {
  const now = new Date();
  // AEST = UTC + 10
  const aestOffset = 10 * 60 * 60 * 1000;
  const aestNow = new Date(now.getTime() + aestOffset);
  // Set to 7 AM today AEST
  const target = new Date(aestNow);
  target.setUTCHours(7, 0, 0, 0);
  // If 7 AM already passed in AEST, use tomorrow
  if (target <= aestNow) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  // Convert back to UTC timestamp
  return Math.floor((target.getTime() - aestOffset) / 1000);
}

/**
 * Parse Google Directions routes into structured format
 */
function _parseRoutes(rawRoutes) {
  const routes = rawRoutes.map((route, ri) => {
    const leg = route.legs[0];
    const steps = parseSteps(leg.steps || []);
    const transitSummary = steps
      .filter(s => s.travel_mode === 'TRANSIT' && s.transit)
      .map(s => `${s.transit.vehicle_type || '公交'} ${s.transit.line_name} (${s.transit.departure_stop} → ${s.transit.arrival_stop})`);
    return {
      route_index: ri + 1,
      summary: route.summary || (transitSummary.length ? transitSummary.join(' → ') : ''),
      total_distance: leg.distance?.text,
      total_distance_m: leg.distance?.value,
      total_duration: leg.duration?.text,
      total_duration_s: leg.duration?.value,
      departure_time: leg.departure_time?.text,
      arrival_time: leg.arrival_time?.text,
      start_address: leg.start_address,
      end_address: leg.end_address,
      transit_connections: transitSummary,
      has_transit_steps: transitSummary.length > 0,
      warnings: route.warnings || [],
      steps
    };
  });
  routes.sort((a, b) => (a.total_duration_s || 0) - (b.total_duration_s || 0));
  return routes;
}

export async function getDirections(args, env) {
  const apiKey = env?.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { error: 'Google Maps API key not configured' };

  let origin = args.origin || args.from;
  const destination = args.destination || args.to;

  if (!destination) {
    return { error: 'destination is required', example: { origin: 'UniLodge Park Central Brisbane', destination: 'University of Queensland' } };
  }

  // 如果提供了 GPS 坐标，转换为地址（提高 Google Maps 识别准确率）
  if (!origin && args.latitude && args.longitude) {
    const addr = await coordsToAddress(args.latitude, args.longitude, apiKey);
    origin = addr || `${args.latitude},${args.longitude}`;
  }

  if (!origin) {
    return { error: 'origin is required (either origin text or latitude/longitude)' };
  }

  // 出行方式：transit（公共交通）、driving、walking、bicycling
  const mode = (args.mode || 'transit').toLowerCase();

  // 构建请求参数
  const params = new URLSearchParams({
    origin,
    destination,
    mode,
    key: apiKey,
    language: 'zh-CN',  // 返回中文路线说明
    region: 'au',       // 偏好澳大利亚结果
    units: 'metric'
  });

  // 公共交通额外参数
  if (mode === 'transit') {
    // transit_mode 需要多次 append（URLSearchParams 会把 | 编成 %7C 导致 400）
    ['bus', 'rail', 'subway', 'tram'].forEach(m => params.append('transit_mode', m));
    // 出发时间（必须是 Unix 秒，或保留空让 Google 默认用当前时间）
    if (args.departure_time) {
      params.set('departure_time', String(args.departure_time));
    } else {
      params.set('departure_time', String(Math.floor(Date.now() / 1000)));
    }
    if (args.transit_preference) {
      params.set('transit_routing_preference', args.transit_preference);
    }
  }

  // 可选：请求多个备选路线
  const alternatives = args.alternatives !== false;
  if (alternatives && mode !== 'transit') {
    params.set('alternatives', 'true');
  }

  // Helper to fetch directions
  async function _fetchDirections(params) {
    const resp = await fetch(`${DIRECTIONS_BASE}?${params}`);
    return await resp.json();
  }

  try {
    const resp = await fetch(`${DIRECTIONS_BASE}?${params}`);
    const data = await resp.json();

    if (!resp.ok) {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
      return {
        error: `Directions API HTTP ${resp.status}`,
        google_error: data?.error_message || JSON.stringify(data),
        api_key_hint: resp.status === 400 || resp.status === 403
          ? 'Please enable "Directions API" in Google Cloud Console: https://console.cloud.google.com/apis/library/directions-backend.googleapis.com'
          : '',
        fallback_url: mapsUrl,
        message: `Route lookup unavailable. Open in Google Maps: ${mapsUrl}`,
        origin, destination
      };
    }

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;

    // ZERO_RESULTS for transit → retry with next morning departure
    if (data.status === 'ZERO_RESULTS' && mode === 'transit') {
      console.log('[Directions] Transit ZERO_RESULTS, retrying with next 7AM AEST...');
      const nextMorning = _getNext7amAEST();
      params.set('departure_time', String(nextMorning));
      const retryData = await _fetchDirections(params);

      if (retryData.status === 'OK') {
        const routes = _parseRoutes(retryData.routes);
        return {
          origin, destination, mode,
          transit_available: true,
          current_service: false,
          note: '当前时段没有公交服务。以下是明早的公交路线，供您参考。',
          routes_count: routes.length,
          fastest_route: routes[0],
          all_routes: routes,
          google_maps_url: googleMapsUrl
        };
      }
      // Still no results — fall through to error
      return {
        error: 'No transit route found',
        origin, destination, mode,
        google_maps_url: googleMapsUrl,
        suggestion: '未找到公共交通路线。请直接打开 Google Maps 查看。'
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      return { error: 'No route found', origin, destination, mode, suggestion: 'Try different origin/destination names' };
    }

    if (data.status !== 'OK') {
      return { error: `Google Maps API error: ${data.status}`, message: data.error_message || '' };
    }

    // Parse routes
    const routes = _parseRoutes(data.routes);

    // Detect walking-only when transit was requested → retry with next morning
    const hasAnyTransit = routes.some(r => r.has_transit_steps);
    if (mode === 'transit' && !hasAnyTransit) {
      console.log('[Directions] Transit returned walking-only, retrying with next 7AM AEST...');
      const nextMorning = _getNext7amAEST();
      params.set('departure_time', String(nextMorning));
      const retryData = await _fetchDirections(params);

      if (retryData.status === 'OK') {
        const retryRoutes = _parseRoutes(retryData.routes);
        const hasTransitRetry = retryRoutes.some(r => r.has_transit_steps);
        if (hasTransitRetry) {
          return {
            origin, destination, mode,
            transit_available: true,
            current_service: false,
            note: '当前时段公交已停运。以下是明早最早的公交路线，供您提前规划。',
            routes_count: retryRoutes.length,
            fastest_route: retryRoutes[0],
            all_routes: retryRoutes,
            google_maps_url: googleMapsUrl
          };
        }
      }

      // Retry also walking-only — Directions API might not have transit for this area
      return {
        origin, destination, mode,
        transit_available: false,
        warning: '未找到公共交通路线（可能该区域没有公交覆盖或 Directions API 未启用 transit）。以下是步行路线。',
        walking_route: routes[0] || null,
        google_maps_url: googleMapsUrl,
        tip: '请直接打开 Google Maps 查看实时公交信息。'
      };
    }

    return {
      origin, destination, mode,
      transit_available: true,
      current_service: true,
      routes_count: routes.length,
      fastest_route: routes[0],
      all_routes: routes,
      google_maps_url: googleMapsUrl
    };

  } catch (err) {
    // Fallback: provide Google Maps URL even if API fails
    return {
      error: `Directions API failed: ${err.message}`,
      fallback_url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`,
      message: `Could not fetch route data. You can open Google Maps directly with the link above.`,
      origin, destination
    };
  }
}
