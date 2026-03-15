/**
 * Victoria (Melbourne) Public Transport — GTFS-R via VIC DTP Open Data
 * API: https://api.opendata.transport.vic.gov.au
 * Requires: KeyID header (free registration at opendata.transport.vic.gov.au)
 * 
 * Confirmed endpoints (tested working):
 * - /opendata/public-transport/gtfs/realtime/v1/metro/service-alerts/
 * - /opendata/public-transport/gtfs/realtime/v1/tram/service-alerts/
 * - /opendata/public-transport/gtfs/realtime/v1/bus/service-alerts/
 * - /opendata/public-transport/gtfs/realtime/v1/regional/service-alerts/
 * - /opendata/public-transport/gtfs/realtime/v1/metro/trip-updates/
 * - /opendata/public-transport/gtfs/realtime/v1/tram/trip-updates/
 * 
 * Returns Protocol Buffer format — we extract textual info from raw bytes
 * Rate limit: 24 calls per 60 seconds
 */

const VIC_BASE = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1';

const VIC_MODES = {
  train: { endpoint: 'metro', name: 'Metro Train', emoji: '🚆' },
  tram: { endpoint: 'tram', name: 'Yarra Tram', emoji: '🚊' },
  bus: { endpoint: 'bus', name: 'Metro Bus', emoji: '🚌' },
  regional: { endpoint: 'regional', name: 'V/Line Regional', emoji: '🚂' },
};

export async function getVICAlerts(args, env) {
  const apiKey = env?.VIC_TRANSPORT_KEY;
  if (!apiKey) {
    return await fallbackVICTransport(args, env, VIC_MODES.train, 'alerts');
  }

  const mode = (args.mode || args.service || 'train').toLowerCase();
  const modeInfo = VIC_MODES[mode] || VIC_MODES.train;

  try {
    const url = `${VIC_BASE}/${modeInfo.endpoint}/service-alerts/`;
    const res = await fetch(url, {
      headers: { 'KeyID': apiKey },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { state: 'VIC', error: 'VIC Transport API key 无效或已过期。' };
      }
      throw new Error(`VIC API ${res.status}`);
    }

    // Parse protobuf text to extract alert info
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const alerts = extractAlertsFromProtobuf(text);

    return {
      state: 'VIC',
      mode: modeInfo.name,
      emoji: modeInfo.emoji,
      type: 'service_alerts',
      api_connected: true,
      alerts_count: alerts.length,
      alerts: alerts.slice(0, 10),
      source: 'VIC DTP Open Data (GTFS-R real-time)',
      disruptions_url: 'https://www.ptv.vic.gov.au/disruptions/disruptions-information/',
      tips: {
        myki: 'myki 卡可在所有火车站、711、网上购买充值',
        free_tram: '墨尔本 CBD 免费电车区域: Flinders St → Victoria St, Spencer St → Spring St',
        peak: '高峰时段: 平日 7:00-9:00, 16:00-19:00',
        emergency: 'PTV 客户服务热线: 1800 800 007',
      },
    };
  } catch (err) {
    return await fallbackVICTransport(args, env, modeInfo, 'alerts');
  }
}

export async function getVICDepartures(args, env) {
  const apiKey = env?.VIC_TRANSPORT_KEY;
  const stopName = args.stop_name || args.station || args.stop || '';
  const mode = (args.mode || args.service || 'train').toLowerCase();
  const modeInfo = VIC_MODES[mode] || VIC_MODES.train;

  if (!apiKey) {
    return await fallbackVICTransport(args, env, modeInfo, 'departures');
  }

  try {
    const url = `${VIC_BASE}/${modeInfo.endpoint}/trip-updates/`;
    const res = await fetch(url, {
      headers: { 'KeyID': apiKey },
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const updates = extractTripUpdatesFromProtobuf(text, stopName);

    return {
      state: 'VIC',
      mode: modeInfo.name,
      emoji: modeInfo.emoji,
      stop: stopName || 'Melbourne Metro',
      api_connected: true,
      updates_count: updates.length,
      departures: updates.slice(0, 15),
      journey_planner: stopName
        ? `https://www.ptv.vic.gov.au/journey/?destination=${encodeURIComponent(stopName)}`
        : 'https://www.ptv.vic.gov.au/journey/',
      source: 'VIC DTP Open Data (GTFS-R real-time)',
      tips: {
        myki: 'myki 卡可在火车站、711、网上购买和充值',
        free_tram: '墨尔本 CBD 内有免费电车区域（Free Tram Zone）！',
        peak: '火车高峰时段: 平日7:00-9:00, 16:00-19:00',
      },
    };
  } catch (err) {
    return await fallbackVICTransport(args, env, modeInfo, 'departures');
  }
}

// Extract alerts from protobuf binary (text-readable portions)
function extractAlertsFromProtobuf(rawText) {
  const alerts = [];
  
  // Extract readable strings from protobuf
  // Look for route IDs (vic:rail:XXX, vic:tram:XXX, etc.)
  const routeMatches = rawText.match(/vic:(rail|tram|bus|coach):[A-Z0-9]+/g) || [];
  const uniqueRoutes = [...new Set(routeMatches)];
  
  // Extract alert IDs  
  const alertIds = rawText.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g) || [];
  
  // Extract any readable text blocks (descriptions)
  const textBlocks = rawText.match(/[A-Z][a-zA-Z\s,\.\-\:]{20,200}/g) || [];
  
  if (uniqueRoutes.length > 0) {
    // Group by alert
    const routesByType = {};
    for (const route of uniqueRoutes) {
      const [, type, code] = route.split(':');
      if (!routesByType[type]) routesByType[type] = [];
      routesByType[type].push(code);
    }

    for (const [type, codes] of Object.entries(routesByType)) {
      alerts.push({
        type: type === 'rail' ? '🚆 火车' : type === 'tram' ? '🚊 电车' : type === 'bus' ? '🚌 巴士' : '🚂 长途',
        affected_routes: codes.slice(0, 10),
        routes_count: codes.length,
        note: `${codes.length} 条线路受影响`,
      });
    }
  }
  
  // Add readable text blocks as descriptions
  for (const block of textBlocks.slice(0, 5)) {
    const cleaned = block.trim();
    if (cleaned.length > 25 && !cleaned.includes('xmlns')) {
      alerts.push({ description: cleaned });
    }
  }

  return alerts;
}

// Extract trip updates from protobuf
function extractTripUpdatesFromProtobuf(rawText, stopFilter) {
  const updates = [];
  
  // Extract trip IDs and route info
  const tripMatches = rawText.match(/\d+\.\w+\.\d+-\d+-\w+/g) || [];
  const routeMatches = rawText.match(/vic:(rail|tram|bus):[A-Z0-9]+/g) || [];
  
  const filterLower = (stopFilter || '').toLowerCase();
  
  // Extract stop IDs
  const stopMatches = rawText.match(/[A-Z]{3,5}/g) || [];
  const relevantStops = filterLower 
    ? stopMatches.filter(s => s.toLowerCase().includes(filterLower))
    : stopMatches.slice(0, 20);

  if (routeMatches.length > 0) {
    const uniqueRoutes = [...new Set(routeMatches)].slice(0, 15);
    for (const route of uniqueRoutes) {
      const [, type, code] = route.split(':');
      updates.push({
        route: code,
        type: type === 'rail' ? '🚆' : type === 'tram' ? '🚊' : '🚌',
        status: 'Active',
      });
    }
  }

  return updates;
}

async function fallbackVICTransport(args, env, modeInfo, type) {
  const tavilyKey = env?.TAVILY_API_KEY;
  const stopName = args.stop_name || args.station || '';
  
  if (tavilyKey) {
    try {
      const { tavilySearch } = await import('./web-search.js');
      const query = type === 'alerts'
        ? `PTV Melbourne ${modeInfo.name} disruptions delays today 2026`
        : `PTV ${modeInfo.name} ${stopName || 'Melbourne'} departures schedule`;
      
      const data = await tavilySearch(query, tavilyKey, {
        maxResults: 5,
        includeDomains: ['ptv.vic.gov.au', 'metrotrains.com.au', 'yarratrams.com.au'],
      });

      return {
        state: 'VIC',
        mode: modeInfo.name,
        emoji: modeInfo.emoji,
        results: (data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: (r.snippet || '').substring(0, 200),
        })).slice(0, 5),
        source: 'PTV via web search',
        journey_planner: 'https://www.ptv.vic.gov.au/journey/',
      };
    } catch {}
  }

  return {
    state: 'VIC',
    mode: modeInfo.name,
    emoji: modeInfo.emoji,
    message: `请直接访问 PTV 网站查看${modeInfo.name}信息。`,
    journey_planner: 'https://www.ptv.vic.gov.au/journey/',
    disruptions: 'https://www.ptv.vic.gov.au/disruptions/',
  };
}
