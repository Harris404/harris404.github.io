/**
 * Adelaide Metro GTFS-R Transport Tool — with Protobuf Decoding
 * API: https://gtfs.adelaidemetro.com.au/v1/
 * FREE — no API key required!
 *
 * Endpoints (binary protobuf):
 * - /realtime/vehicle_positions  → live GPS positions (every 15s)
 * - /realtime/trip_updates       → trip predictions / delays (every 60s)
 * - /realtime/service_alerts     → disruptions & alerts (every 5 min)
 *
 * Fallback endpoints (debug text format):
 * - /realtime/vehicle_positions/debug
 * - /realtime/trip_updates/debug
 * - /realtime/service_alerts/debug
 */

const SA_BASE = 'https://gtfs.adelaidemetro.com.au/v1';

// ── GTFS-R Protobuf Mini-Decoder ───────────────────────────────
// Handles GTFS-R FeedMessage without external dependencies.
// GTFS-R proto: transit_realtime.proto (field numbers are standard)

class ProtobufReader {
  constructor(buf) {
    this.bytes = new Uint8Array(buf);
    this.pos = 0;
  }

  readVarint() {
    let result = 0, shift = 0;
    while (this.pos < this.bytes.length) {
      const b = this.bytes[this.pos++];
      result |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return result;
      shift += 7;
      if (shift > 35) break;
    }
    return result;
  }

  readString() {
    const len = this.readVarint();
    const str = new TextDecoder().decode(this.bytes.slice(this.pos, this.pos + len));
    this.pos += len;
    return str;
  }

  readBytes() {
    const len = this.readVarint();
    const data = this.bytes.slice(this.pos, this.pos + len);
    this.pos += len;
    return data;
  }

  readFloat32() {
    const dv = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 4);
    const v = dv.getFloat32(0, true);
    this.pos += 4;
    return v;
  }

  skip(wireType) {
    if (wireType === 0) this.readVarint();
    else if (wireType === 1) this.pos += 8;
    else if (wireType === 2) this.readBytes();
    else if (wireType === 5) this.pos += 4;
  }

  hasMore() {
    return this.pos < this.bytes.length;
  }

  readTag() {
    const v = this.readVarint();
    return { field: v >> 3, wire: v & 0x7 };
  }
}

// Parse sub-message bytes into a new ProtobufReader
function subReader(bytes) {
  const r = new ProtobufReader(bytes.buffer);
  r.bytes = bytes;
  r.pos = 0;
  return r;
}

// ── Parse GTFS-R FeedMessage → entities ──────────────────────

function parseFeedMessage(buffer) {
  const r = new ProtobufReader(buffer);
  const entities = [];
  let header = {};

  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) {
      // FeedHeader
      header = parseFeedHeader(r.readBytes());
    } else if (field === 2 && wire === 2) {
      // FeedEntity
      entities.push(parseFeedEntity(r.readBytes()));
    } else {
      r.skip(wire);
    }
  }
  return { header, entities };
}

function parseFeedHeader(bytes) {
  const r = subReader(bytes);
  const h = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) h.gtfs_version = r.readString();
    else if (field === 3 && wire === 0) h.timestamp = r.readVarint();
    else r.skip(wire);
  }
  return h;
}

function parseFeedEntity(bytes) {
  const r = subReader(bytes);
  const entity = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) entity.id = r.readString();
    else if (field === 3 && wire === 2) entity.trip_update = parseTripUpdate(r.readBytes());
    else if (field === 4 && wire === 2) entity.vehicle = parseVehiclePosition(r.readBytes());
    else if (field === 5 && wire === 2) entity.alert = parseAlert(r.readBytes());
    else r.skip(wire);
  }
  return entity;
}

// ── Parse Alert ──────────────────────────────────────────────

function parseAlert(bytes) {
  const r = subReader(bytes);
  const alert = { informed_entities: [] };
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 5 && wire === 2) alert.informed_entities.push(parseEntitySelector(r.readBytes()));
    else if (field === 6 && wire === 0) alert.cause = r.readVarint();
    else if (field === 7 && wire === 0) alert.effect = r.readVarint();
    else if (field === 10 && wire === 2) alert.header_text = parseTranslatedString(r.readBytes());
    else if (field === 11 && wire === 2) alert.description_text = parseTranslatedString(r.readBytes());
    else r.skip(wire);
  }
  return alert;
}

function parseEntitySelector(bytes) {
  const r = subReader(bytes);
  const es = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 2 && wire === 2) es.route_id = r.readString();
    else if (field === 3 && wire === 0) es.route_type = r.readVarint();
    else if (field === 4 && wire === 2) es.stop_id = r.readString();
    else r.skip(wire);
  }
  return es;
}

function parseTranslatedString(bytes) {
  const r = subReader(bytes);
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) {
      // translation sub-message
      const tr = subReader(r.readBytes());
      let text = '';
      while (tr.hasMore()) {
        const t = tr.readTag();
        if (t.field === 1 && t.wire === 2) text = tr.readString();
        else tr.skip(t.wire);
      }
      return text;
    } else r.skip(wire);
  }
  return '';
}

// ── Parse TripUpdate ─────────────────────────────────────────

function parseTripUpdate(bytes) {
  const r = subReader(bytes);
  const tu = { stop_time_updates: [] };
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) tu.trip = parseTripDescriptor(r.readBytes());
    else if (field === 3 && wire === 2) tu.vehicle = parseVehicleDescriptor(r.readBytes());
    else if (field === 2 && wire === 2) tu.stop_time_updates.push(parseStopTimeUpdate(r.readBytes()));
    else if (field === 4 && wire === 0) tu.timestamp = r.readVarint();
    else r.skip(wire);
  }
  return tu;
}

function parseTripDescriptor(bytes) {
  const r = subReader(bytes);
  const td = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) td.trip_id = r.readString();
    else if (field === 2 && wire === 2) td.start_date = r.readString();
    else if (field === 5 && wire === 2) td.route_id = r.readString();
    else if (field === 4 && wire === 0) td.schedule_relationship = r.readVarint();
    else if (field === 6 && wire === 0) td.direction_id = r.readVarint();
    else r.skip(wire);
  }
  return td;
}

function parseVehicleDescriptor(bytes) {
  const r = subReader(bytes);
  const v = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) v.id = r.readString();
    else if (field === 2 && wire === 2) v.label = r.readString();
    else r.skip(wire);
  }
  return v;
}

function parseStopTimeUpdate(bytes) {
  const r = subReader(bytes);
  const stu = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 0) stu.stop_sequence = r.readVarint();
    else if (field === 4 && wire === 2) stu.stop_id = r.readString();
    else if (field === 2 && wire === 2) stu.arrival = parseStopTimeEvent(r.readBytes());
    else if (field === 3 && wire === 2) stu.departure = parseStopTimeEvent(r.readBytes());
    else if (field === 5 && wire === 0) stu.schedule_relationship = r.readVarint();
    else r.skip(wire);
  }
  return stu;
}

function parseStopTimeEvent(bytes) {
  const r = subReader(bytes);
  const e = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 0) e.delay = r.readVarint();
    else if (field === 2 && wire === 0) e.time = r.readVarint();
    else r.skip(wire);
  }
  return e;
}

// ── Parse VehiclePosition ────────────────────────────────────

function parseVehiclePosition(bytes) {
  const r = subReader(bytes);
  const vp = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 2) vp.trip = parseTripDescriptor(r.readBytes());
    else if (field === 2 && wire === 2) vp.position = parsePosition(r.readBytes());
    else if (field === 5 && wire === 0) vp.timestamp = r.readVarint();
    else if (field === 8 && wire === 2) vp.vehicle = parseVehicleDescriptor(r.readBytes());
    else r.skip(wire);
  }
  return vp;
}

function parsePosition(bytes) {
  const r = subReader(bytes);
  const p = {};
  while (r.hasMore()) {
    const { field, wire } = r.readTag();
    if (field === 1 && wire === 5) p.latitude = r.readFloat32();
    else if (field === 2 && wire === 5) p.longitude = r.readFloat32();
    else if (field === 3 && wire === 5) p.bearing = r.readFloat32();
    else if (field === 4 && wire === 5) p.speed = r.readFloat32();
    else r.skip(wire);
  }
  return p;
}

// ── Utility ──────────────────────────────────────────────────

const CAUSE_MAP = {
  1: 'Unknown', 2: 'Other', 3: 'Technical', 4: 'Strike',
  5: 'Demonstration', 6: 'Accident', 7: 'Holiday', 8: 'Weather',
  9: 'Maintenance', 10: 'Construction', 11: 'Police Activity',
  12: 'Medical Emergency',
};
const EFFECT_MAP = {
  1: 'No Service', 2: 'Reduced Service', 3: 'Significant Delays',
  4: 'Detour', 5: 'Additional Service', 6: 'Modified Service',
  7: 'Other Effect', 8: 'Unknown Effect', 9: 'Stop Moved',
};

function timestampToAdelaide(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Adelaide',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Exported Functions ───────────────────────────────────────

export async function getSAAlerts(args, env) {
  try {
    const res = await fetch(`${SA_BASE}/realtime/service_alerts`);
    if (!res.ok) throw new Error(`Adelaide Metro API returned ${res.status}`);

    const { entities } = parseFeedMessage(await res.arrayBuffer());
    const alerts = entities
      .filter(e => e.alert)
      .map(e => {
        const a = e.alert;
        return {
          title: a.header_text || '',
          description: (a.description_text || '').substring(0, 300),
          routes: a.informed_entities?.map(ie => ie.route_id).filter(Boolean),
          cause: CAUSE_MAP[a.cause] || undefined,
          effect: EFFECT_MAP[a.effect] || undefined,
        };
      });

    return {
      state: 'SA',
      city: 'Adelaide',
      type: 'service_alerts',
      api_connected: true,
      alerts_count: alerts.length,
      alerts: alerts.slice(0, 10),
      source: 'Adelaide Metro GTFS-R (real-time protobuf)',
      url: 'https://www.adelaidemetro.com.au/disruptions',
      tip: '阿德莱德公共交通使用 metroCARD（类似 Opal/Go card），可乘 bus/train/tram。',
    };
  } catch (err) {
    // Fallback to debug text format
    return await getSAAlertsFallback(args, env, err);
  }
}

export async function getSADepartures(args, env) {
  const stopName = args.stop_name || args.station || args.stop || '';

  try {
    const res = await fetch(`${SA_BASE}/realtime/trip_updates`);
    if (!res.ok) throw new Error(`Adelaide Metro API returned ${res.status}`);

    const { entities } = parseFeedMessage(await res.arrayBuffer());
    const filterLower = stopName.toLowerCase();

    const departures = [];
    for (const e of entities) {
      const tu = e.trip_update;
      if (!tu) continue;

      for (const stu of tu.stop_time_updates || []) {
        if (filterLower && !stu.stop_id?.toLowerCase().includes(filterLower)) continue;

        const depTime = stu.departure?.time || stu.arrival?.time;
        const delay = stu.departure?.delay || stu.arrival?.delay || 0;

        departures.push({
          route: tu.trip?.route_id || '',
          trip_id: tu.trip?.trip_id || '',
          stop: stu.stop_id || '',
          stop_sequence: stu.stop_sequence,
          departure: timestampToAdelaide(depTime),
          delay_seconds: delay,
          delay_minutes: Math.round(delay / 60),
          on_time: Math.abs(delay) < 60,
          vehicle: tu.vehicle?.label || '',
        });
      }
    }

    // Sort by departure time
    departures.sort((a, b) => a.departure.localeCompare(b.departure));

    return {
      state: 'SA',
      city: 'Adelaide',
      type: 'departures',
      api_connected: true,
      stop: stopName || 'All stops',
      total_trips: entities.length,
      departures_count: departures.length,
      departures: departures.slice(0, 15),
      source: 'Adelaide Metro GTFS-R (real-time protobuf, updated every 60s)',
      url: 'https://www.adelaidemetro.com.au',
      tip: stopName
        ? `显示 "${stopName}" 附近的到站预测。`
        : '提供站点名/ID 可过滤特定站点，如 "Adelaide Railway Station"',
    };
  } catch (err) {
    return await getSADeparturesFallback(args, env, err);
  }
}

export async function getSAVehicles(args, env) {
  const routeFilter = args.route || args.line || '';

  try {
    const res = await fetch(`${SA_BASE}/realtime/vehicle_positions`);
    if (!res.ok) throw new Error(`Adelaide Metro API returned ${res.status}`);

    const { entities } = parseFeedMessage(await res.arrayBuffer());
    const filterLower = routeFilter.toLowerCase();

    const vehicles = entities
      .filter(e => e.vehicle)
      .map(e => {
        const v = e.vehicle;
        return {
          vehicle_label: v.vehicle?.label || '',
          route: v.trip?.route_id || '',
          trip_id: v.trip?.trip_id || '',
          latitude: v.position?.latitude?.toFixed(5),
          longitude: v.position?.longitude?.toFixed(5),
          bearing: v.position?.bearing?.toFixed(0),
          speed_kmh: v.position?.speed ? (v.position.speed * 3.6).toFixed(0) : undefined,
          last_update: timestampToAdelaide(v.timestamp),
        };
      })
      .filter(v => !filterLower || v.route.toLowerCase().includes(filterLower));

    return {
      state: 'SA',
      city: 'Adelaide',
      type: 'vehicle_positions',
      api_connected: true,
      route_filter: routeFilter || 'All routes',
      vehicles_count: vehicles.length,
      vehicles: vehicles.slice(0, 20),
      source: 'Adelaide Metro GTFS-R (real-time GPS, updated every 15s)',
      url: 'https://www.adelaidemetro.com.au',
      tip: routeFilter
        ? `显示 "${routeFilter}" 线路的实时车辆位置。`
        : '提供线路号可过滤（如 route: "G10"）。覆盖 bus、train、tram。',
    };
  } catch (err) {
    return {
      state: 'SA',
      error: `Adelaide Metro vehicle positions error: ${err.message}`,
      fallback: 'https://www.adelaidemetro.com.au',
    };
  }
}

// ── Fallbacks (debug text format) ────────────────────────────

async function getSAAlertsFallback(args, env, originalErr) {
  try {
    const res = await fetch(`${SA_BASE}/realtime/service_alerts/debug`,
      { headers: { 'Accept': 'text/plain' } });
    if (!res.ok) throw originalErr;

    const text = await res.text();
    const entities = text.split(/entity\s*\{/g).filter(e => e.includes('alert'));
    const alerts = [];

    for (const entity of entities.slice(0, 15)) {
      const headerText = entity.match(/header_text[\s\S]*?text:\s*"([^"]+)"/)?.[1] || '';
      const descText = entity.match(/description_text[\s\S]*?text:\s*"([^"]+)"/)?.[1] || '';
      const routeId = entity.match(/route_id:\s*"([^"]+)"/)?.[1] || '';
      if (headerText || descText) {
        alerts.push({ title: headerText, description: descText.substring(0, 300), route: routeId });
      }
    }

    return {
      state: 'SA', city: 'Adelaide', type: 'service_alerts',
      api_connected: true, alerts_count: alerts.length,
      alerts: alerts.slice(0, 10),
      source: 'Adelaide Metro GTFS-R (debug text fallback)',
      url: 'https://www.adelaidemetro.com.au/disruptions',
    };
  } catch {
    return {
      state: 'SA',
      error: `Adelaide Metro API error: ${originalErr.message}`,
      fallback: 'https://www.adelaidemetro.com.au/disruptions',
    };
  }
}

async function getSADeparturesFallback(args, env, originalErr) {
  const stopName = args.stop_name || args.station || args.stop || '';
  try {
    const res = await fetch(`${SA_BASE}/realtime/trip_updates/debug`,
      { headers: { 'Accept': 'text/plain' } });
    if (!res.ok) throw originalErr;

    const text = await res.text();
    const entities = text.split(/entity\s*\{/g).filter(e => e.includes('trip_update'));
    const filterLower = stopName.toLowerCase();
    const updates = [];

    for (const entity of entities.slice(0, 50)) {
      const routeId = entity.match(/route_id:\s*"([^"]+)"/)?.[1] || '';
      const tripId = entity.match(/trip_id:\s*"([^"]+)"/)?.[1] || '';
      const stopUpdates = entity.match(/stop_time_update\s*\{[\s\S]*?\}/g) || [];

      for (const stu of stopUpdates.slice(0, 3)) {
        const stopId = stu.match(/stop_id:\s*"([^"]+)"/)?.[1] || '';
        if (filterLower && !stopId.toLowerCase().includes(filterLower)) continue;
        const departure = stu.match(/departure\s*\{[\s\S]*?time:\s*(\d+)/)?.[1];
        const delay = stu.match(/delay:\s*(-?\d+)/)?.[1];
        updates.push({
          route: routeId, trip: tripId, stop: stopId,
          departure: departure ? timestampToAdelaide(Number(departure)) : '',
          delay_seconds: delay ? Number(delay) : 0,
          on_time: delay ? Math.abs(Number(delay)) < 60 : true,
        });
      }
    }
    return {
      state: 'SA', city: 'Adelaide', type: 'departures',
      stop: stopName || 'All stops',
      updates_count: updates.length, departures: updates.slice(0, 15),
      source: 'Adelaide Metro GTFS-R (debug text fallback)',
    };
  } catch {
    return {
      state: 'SA',
      error: `Adelaide Metro departures error: ${originalErr.message}`,
      fallback: 'https://www.adelaidemetro.com.au/plan-a-trip',
    };
  }
}
