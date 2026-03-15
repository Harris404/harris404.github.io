/**
 * TransLink Queensland (SEQ/Brisbane/Gold Coast) — GTFS-RT Real-time Feed
 * Source:   https://gtfsrt.api.translink.com.au/api/realtime
 * Regions:  SEQ (Brisbane, Gold Coast, Sunshine Coast), CNS, NSI, MHB, BOW, INN
 * Auth:     None required — Queensland Open Data (Creative Commons CC-BY)
 * Spec:     https://gtfs.org/realtime/reference/
 */

const BASE = 'https://gtfsrt.api.translink.com.au/api/realtime';

// ─── Minimal Protocol Buffer Decoder (BigInt-based for int64 correctness) ────

function pbVar(data, pos) {
  let result = 0n, shift = 0n;
  while (pos < data.length) {
    const b = data[pos++];
    result |= BigInt(b & 0x7F) << shift;
    if (!(b & 0x80)) return [result, pos];
    shift += 7n;
  }
  throw new Error('truncated protobuf varint');
}

function pbParse(bytes, from = 0, to = bytes.length) {
  const fields = {};
  let pos = from;
  while (pos < to) {
    const [tag, p1] = pbVar(bytes, pos); pos = p1;
    const fn = Number(tag >> 3n);
    const wt = Number(tag & 7n);
    let val;
    switch (wt) {
      case 0: { const [v, p] = pbVar(bytes, pos); val = v; pos = p; break; }
      case 1: { val = bytes.slice(pos, pos + 8); pos += 8; break; }
      case 2: {
        const [l, p] = pbVar(bytes, pos); pos = p;
        const len = Number(l);
        val = bytes.slice(pos, pos + len); pos += len;
        break;
      }
      case 5: { val = bytes.slice(pos, pos + 4); pos += 4; break; }
      default: throw new Error(`unknown proto wire type ${wt} at byte ${pos}`);
    }
    if (fn in fields) {
      if (!Array.isArray(fields[fn])) fields[fn] = [fields[fn]];
      fields[fn].push(val);
    } else fields[fn] = val;
  }
  return fields;
}

// ─── Type Converters ──────────────────────────────────────────────────────────
const _dec = new TextDecoder();
const pbStr  = b => b instanceof Uint8Array ? _dec.decode(b) : null;
const pbF32  = b => b instanceof Uint8Array ? new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true) : null;
const pbI32  = v => v != null ? Number(BigInt.asIntN(32, v)) : null;   // signed int32 (delays)
const pbUint = v => v != null ? Number(v) : null;                       // uint32 / enum
const pbTs   = v => v != null ? new Date(Number(v) * 1000).toISOString() : null; // unix seconds → ISO
const pbMsg  = b => b instanceof Uint8Array ? pbParse(b, 0, b.length) : null;
const asArr  = v => v == null ? [] : Array.isArray(v) ? v : [v];

// ─── GTFS-RT Named Constants ──────────────────────────────────────────────────

const CAUSE = {
  1:'UNKNOWN', 2:'OTHER', 3:'TECHNICAL_PROBLEM', 4:'STRIKE', 5:'DEMONSTRATION',
  6:'ACCIDENT', 7:'HOLIDAY', 8:'WEATHER', 9:'MAINTENANCE', 10:'CONSTRUCTION',
  11:'POLICE_ACTIVITY', 12:'MEDICAL_EMERGENCY'
};
const EFFECT = {
  1:'NO_SERVICE', 2:'REDUCED_SERVICE', 3:'SIGNIFICANT_DELAYS', 4:'DETOUR',
  5:'ADDITIONAL_SERVICE', 6:'MODIFIED_SERVICE', 7:'OTHER', 8:'UNKNOWN', 9:'STOP_MOVED'
};
const TRIP_SCHED = { 0:'SCHEDULED', 1:'ADDED', 2:'UNSCHEDULED', 3:'CANCELED' };
const STOP_SCHED = { 0:'SCHEDULED', 1:'SKIPPED', 2:'NO_DATA' };

// ─── GTFS-RT Field Parsers ────────────────────────────────────────────────────

/** TripDescriptor: {1:trip_id, 2:start_time, 3:start_date, 4:schedule_rel, 5:route_id, 6:dir} */
function parseTrip(bytes) {
  const f = pbMsg(bytes);
  if (!f) return {};
  return {
    trip_id:      pbStr(f[1]),
    route_id:     pbStr(f[5]),
    direction_id: f[6] != null ? pbUint(f[6]) : null,
    schedule_rel: f[4] != null ? (TRIP_SCHED[pbUint(f[4])] || null) : null,
  };
}

/** StopTimeEvent: {1:delay int32, 2:time int64, 3:uncertainty} */
function parseStopEvent(bytes) {
  const f = pbMsg(bytes);
  if (!f) return null;
  return {
    delay: f[1] != null ? pbI32(f[1]) : null,  // seconds, can be negative
    time:  f[2] != null ? pbTs(f[2]) : null,
  };
}

/** TranslatedString → returns first English/default text */
function parseTranslated(bytes) {
  const f = pbMsg(bytes);
  if (!f) return null;
  for (const t of asArr(f[1])) {
    const tf = pbMsg(t);
    if (tf && tf[1]) return pbStr(tf[1]);
  }
  return null;
}

// ─── HTTP Feed Fetcher ────────────────────────────────────────────────────────

async function fetchFeed(region, feedType) {
  const url = `${BASE}/${region.toUpperCase()}/${feedType}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'AustralianAssistant/1.0' },
      signal: ac.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${feedType} for ${region.toUpperCase()}`);
    return new Uint8Array(await resp.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

// ─── Exported Tool: Real-time Departures & Delays ────────────────────────────

/**
 * Get real-time trip delay information from TransLink QLD GTFS-RT TripUpdates feed.
 *
 * Args:
 *   region         - Region code (seq, cns, nsi, mhb, bow, inn). Default: seq
 *   transport_mode - Filter hint: bus, rail, tram, ferry (informational only)
 *   route_id       - Filter by route ID substring (e.g. "66" for route 66B)
 *   limit          - Max results to return (default: 20, max: 100)
 */
export async function getQldDepartures(args, _env) {
  const region      = (args.region || 'seq').toLowerCase();
  const modeHint    = (args.transport_mode || args.mode || '').toLowerCase() || 'all';
  const routeFilter = (args.route_id || args.route || '').toLowerCase() || null;
  const limit       = Math.min(args.limit || 20, 100);

  try {
    const buf  = await fetchFeed(region, 'TripUpdates');
    // FeedMessage: {1: FeedHeader, 2: FeedEntity (repeated)}
    const feed = pbParse(buf, 0, buf.length);

    // FeedHeader: {1: version string, 2: incrementality, 3: timestamp uint64}
    const hdr      = feed[1] ? pbMsg(feed[1]) : {};
    const feedTime = hdr[3] ? pbTs(hdr[3]) : null;

    const entities = asArr(feed[2]);
    const departures = [];
    let delayedCount = 0, cancelledCount = 0;

    for (const entityBytes of entities) {
      if (departures.length >= limit) break;

      // FeedEntity: {1:id, 2:is_deleted, 3:trip_update, 4:vehicle, 5:alert}
      const entity = pbMsg(entityBytes);
      if (!entity || !entity[3]) continue;

      // TripUpdate: {1:trip, 2:stop_time_update (repeated), 3:vehicle, 4:timestamp, 5:delay}
      const tu   = pbMsg(entity[3]);
      if (!tu) continue;

      const trip = parseTrip(tu[1]);

      // Apply route filter
      if (routeFilter && trip.route_id && !trip.route_id.toLowerCase().includes(routeFilter)) continue;

      if (trip.schedule_rel === 'CANCELED') { cancelledCount++; }

      // Take the first StopTimeUpdate as the next upcoming stop
      const firstStop = asArr(tu[2])[0];
      if (!firstStop) continue;

      // StopTimeUpdate: {1:stop_sequence, 2:stop_id, 3:arrival, 4:departure, 5:schedule_rel}
      const su = pbMsg(firstStop);
      if (!su) continue;

      const arr = parseStopEvent(su[3]);
      const dep = parseStopEvent(su[4]);

      // Skip entries with no timing information
      if (!arr?.time && !dep?.time) continue;

      const delaySec = dep?.delay ?? arr?.delay ?? null;
      if (delaySec != null && delaySec > 60) delayedCount++;

      const item = {
        trip_id:   trip.trip_id,
        route_id:  trip.route_id,
        stop_id:   pbStr(su[2]),
      };
      if (dep?.time)  item.departure_time = dep.time;
      if (dep?.delay != null) {
        item.delay_seconds = dep.delay;
        item.delay_minutes = Math.round(dep.delay / 60);
      }
      if (arr?.time)  item.arrival_time  = arr.time;
      if (trip.schedule_rel && trip.schedule_rel !== 'SCHEDULED') {
        item.status = trip.schedule_rel;
      }
      departures.push(item);
    }

    const summary = [];
    if (delayedCount > 0)   summary.push(`${delayedCount} delayed`);
    if (cancelledCount > 0) summary.push(`${cancelledCount} cancelled`);

    return {
      region:          region.toUpperCase(),
      transport_mode:  modeHint,
      feed_timestamp:  feedTime,
      total_active_trips: entities.length,
      showing:         departures.length,
      summary:         summary.length > 0 ? summary.join(', ') : 'On time',
      delayed_count:   delayedCount,
      cancelled_count: cancelledCount,
      departures,
    };
  } catch (err) {
    return {
      error: err.message,
      region: region.toUpperCase(),
      feed: 'TripUpdates',
      _DO_NOT_FABRICATE: true,
      instruction: '工具调用失败。严禁编造任何公交线路、时刻或站点信息。请告知用户该服务暂时不可用，并提供以下官方链接。',
      fallback_url: 'https://translink.com.au/plan-your-journey/journey-planner',
      tip: '请访问 TransLink Journey Planner 查看实时公交信息。'
    };
  }
}

// ─── Exported Tool: Service Alerts & Disruptions ─────────────────────────────

/**
 * Get service alerts and disruptions for Queensland public transport.
 *
 * Args:
 *   region         - Region code (seq, cns, nsi, mhb, bow, inn). Default: seq
 *   transport_mode - Filter hint: bus, rail, tram, ferry
 *   severity       - all | severe (NO_SERVICE/REDUCED/DELAYS) | info. Default: all
 */
export async function getQldAlerts(args, _env) {
  const region   = (args.region || 'seq').toLowerCase();
  const severity = (args.severity || 'all').toLowerCase();

  try {
    const buf  = await fetchFeed(region, 'Alerts');
    const feed = pbParse(buf, 0, buf.length);

    const hdr      = feed[1] ? pbMsg(feed[1]) : {};
    const feedTime = hdr[3] ? pbTs(hdr[3]) : null;

    const severeEffects = ['NO_SERVICE', 'REDUCED_SERVICE', 'SIGNIFICANT_DELAYS'];
    const alerts = [];

    for (const entityBytes of asArr(feed[2])) {
      // FeedEntity: {1:id, 2:is_deleted, 3:trip_update, 4:vehicle, 5:alert}
      const entity = pbMsg(entityBytes);
      if (!entity || !entity[5]) continue;

      // Alert: {1:active_period, 2:informed_entity, 3:cause, 4:effect,
      //         5:url, 6:header_text, 7:description_text, 8:severity_level}
      const a = pbMsg(entity[5]);
      if (!a) continue;

      const effect = EFFECT[pbUint(a[4])] || null;
      const cause  = CAUSE[pbUint(a[3])] || null;

      // Severity filter
      if (severity === 'severe' && !severeEffects.includes(effect)) continue;
      if (severity === 'info'   &&  severeEffects.includes(effect)) continue;

      const header = parseTranslated(a[6]);
      const desc   = parseTranslated(a[7]);

      // Active periods — TimeRange: {1:start uint64, 2:end uint64}
      const periods = asArr(a[1]).map(b => {
        const f = pbMsg(b);
        return { start: f?.[1] ? pbTs(f[1]) : null, end: f?.[2] ? pbTs(f[2]) : null };
      });

      // Affected routes/stops — EntitySelector: {1:agency_id, 2:route_id, 3:route_type, 4:trip, 5:stop_id}
      const affected = asArr(a[2]).map(b => {
        const f = pbMsg(b);
        const sel = {};
        if (f?.[2]) sel.route_id = pbStr(f[2]);
        if (f?.[5]) sel.stop_id  = pbStr(f[5]);
        return sel;
      }).filter(s => s.route_id || s.stop_id);

      alerts.push({ cause, effect, header, description: desc, active_periods: periods, affected });
    }

    return {
      region:         region.toUpperCase(),
      feed_timestamp: feedTime,
      severity_filter: severity,
      count:          alerts.length,
      has_disruptions: alerts.some(a => severeEffects.includes(a.effect)),
      alerts,
    };
  } catch (err) {
    return {
      error: err.message,
      region: region.toUpperCase(),
      feed: 'Alerts',
      _DO_NOT_FABRICATE: true,
      instruction: '工具调用失败。严禁编造任何服务中断信息。请告知用户该服务暂时不可用，并提供以下官方链接。',
      fallback_url: 'https://translink.com.au/service-updates',
    };
  }
}
