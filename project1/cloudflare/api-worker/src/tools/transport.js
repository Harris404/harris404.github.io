/**
 * Transport NSW Tool — Transport Open Data API
 * https://api.transport.nsw.gov.au
 */

const BASE_URL = 'https://api.transport.nsw.gov.au/v1/tp';

// Common station name → stop ID mapping
const STOP_IDS = {
  'central': '200060', 'central station': '200060',
  'town hall': '200070', 'town hall station': '200070',
  'wynyard': '200080', 'wynyard station': '200080',
  'circular quay': '200090', 'circular quay station': '200090',
  'martin place': '200100',
  'kings cross': '200110',
  'bondi junction': '200120',
  'redfern': '200130',
  'strathfield': '200140',
  'parramatta': '200150',
  'chatswood': '200160',
  'north sydney': '200170',
  'st leonards': '200180',
  'epping': '200190',
  'macquarie university': '200200',
  'hurstville': '200210',
  'bankstown': '200220',
  'burwood': '200230',
  'newtown': '200240',
  'sydenham': '200250'
};

function resolveStopId(stopName) {
  const lower = (stopName || '').toLowerCase().trim();
  return STOP_IDS[lower] || null;
}

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
  } catch { return isoString; }
}

export async function getDepartures(args, env) {
  const apiKey = env?.NSW_TRANSPORT_API_KEY;
  if (!apiKey) return { error: 'NSW Transport API key not configured' };

  const stopName = args.stop_name || args.station || 'Central Station';
  const limit = args.limit || 10;

  // Resolve stop ID
  let stopId = args.stop_id || resolveStopId(stopName);
  
  if (!stopId) {
    // Try to find stop by name using coord endpoint
    return {
      stop_name: stopName,
      message: `Could not resolve stop "${stopName}". Try common station names like: Central, Town Hall, Wynyard, Circular Quay, Parramatta, Chatswood.`,
      available_stations: Object.keys(STOP_IDS).filter((_, i) => i % 2 === 0) // skip duplicates
    };
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }).split('/').reverse().join('');
  const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Australia/Sydney' }).replace(':', '');

  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    coordOutputFormat: 'EPSG:4326',
    mode: 'direct',
    type_dm: 'stop',
    name_dm: stopId,
    depArrMacro: 'dep',
    itdDate: dateStr,
    itdTime: timeStr,
    TfNSWDM: 'true',
    limit: String(limit),
    version: '10.2.1.42'
  });

  try {
    const resp = await fetch(`${BASE_URL}/departure_mon?${params}`, {
      headers: {
        'Authorization': `apikey ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) throw new Error(`Transport NSW API error: ${resp.status}`);
    const data = await resp.json();

    const departures = (data.stopEvents || []).map(evt => ({
      time: formatTime(evt.departureTimePlanned),
      estimated: evt.departureTimeEstimated ? formatTime(evt.departureTimeEstimated) : null,
      delayed: evt.departureTimeEstimated && evt.departureTimeEstimated !== evt.departureTimePlanned,
      line: evt.transportation?.number || '',
      type: evt.transportation?.description || '',
      destination: evt.transportation?.destination?.name || '',
      operator: evt.transportation?.operator?.name || '',
      platform: evt.location?.properties?.platform || null
    }));

    return {
      stop_name: stopName,
      stop_id: stopId,
      timestamp: now.toISOString(),
      departures
    };
  } catch (err) {
    return { error: err.message, stop_name: stopName };
  }
}

export async function getTransportAlerts(args, env) {
  const apiKey = env?.NSW_TRANSPORT_API_KEY;
  if (!apiKey) return { error: 'NSW Transport API key not configured' };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }).split('/').map(p => p.padStart(2, '0')).join('-');

  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    coordOutputFormat: 'EPSG:4326',
    filterDateValid: dateStr,
    version: '10.2.1.42'
  });

  try {
    const resp = await fetch(`${BASE_URL}/add_info?${params}`, {
      headers: {
        'Authorization': `apikey ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) throw new Error(`Transport NSW API error: ${resp.status}`);
    const data = await resp.json();

    const alerts = (data.infos || []).slice(0, 10).map(info => ({
      title: info.title || '',
      content: info.content || '',
      priority: info.priority || '',
      valid_from: info.validFrom || '',
      valid_to: info.validTo || ''
    }));

    return { date: dateStr, alerts };
  } catch (err) {
    return { error: err.message };
  }
}
