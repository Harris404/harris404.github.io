/**
 * Fuel Prices Tool — Australian fuel/petrol prices
 * NSW: FuelCheck API
 * WA: FuelWatch WA
 * Others: fallback info
 */

// NSW FuelCheck API
async function getNSWFuelPrices(fuelType) {
  const FUEL_MAP = {
    'U91': 'P95', 'E10': 'E10', 'P95': 'P95', 'P98': 'P98',
    'diesel': 'DL', 'DL': 'DL', 'LPG': 'LPG',
    '91': 'P95', '95': 'P95', '98': 'P98',
    '汽油': 'P95', '柴油': 'DL'
  };

  const code = FUEL_MAP[(fuelType || 'U91').toUpperCase()] || 'P95';

  try {
    // NSW FuelCheck public endpoint
    const resp = await fetch('https://api.onegov.nsw.gov.au/FuelCheckApp/v2/fuel/prices/bylocation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'FuelCheckApp',
        'User-Agent': 'AustralianAssistant/1.0'
      },
      body: JSON.stringify({
        fueltype: code,
        latitude: -33.8688,
        longitude: 151.2093,
        radius: 5,
        sortby: 'price',
        sortascending: 'true'
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      const stations = (data.stations || []).slice(0, 10).map(s => ({
        name: s.name || s.brand,
        address: s.address,
        price: s.price,
        brand: s.brand
      }));
      return { state: 'NSW', fuel_type: fuelType, stations, source: 'NSW FuelCheck' };
    }
  } catch (e) {
    // NSW FuelCheck API unavailable
  }

  return null;
}

// WA FuelWatch RSS → simplified
async function getWAFuelPrices(fuelType) {
  const FUEL_MAP = { 'U91': '1', 'P95': '2', 'P98': '4', 'diesel': '5', 'LPG': '6', 'E10': '12' };
  const code = FUEL_MAP[(fuelType || 'U91')] || '1';

  try {
    const resp = await fetch(
      `https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS?Product=${code}&Suburb=Perth&Day=today`,
      { headers: { 'User-Agent': 'AustralianAssistant/1.0' } }
    );

    if (resp.ok) {
      const xml = await resp.text();
      // Simple XML parsing for price items
      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
        const getTag = (tag) => {
          const m = match[1].match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
          return m ? m[1] : '';
        };
        items.push({
          name: getTag('trading-name'),
          address: `${getTag('address')}, ${getTag('location')}`,
          price: parseFloat(getTag('price')) || 0,
          brand: getTag('brand')
        });
      }
      if (items.length) {
        return { state: 'WA', fuel_type: fuelType, stations: items, source: 'FuelWatch WA' };
      }
    }
  } catch (e) {
    // FuelWatch WA unavailable
  }

  return null;
}

export async function getFuelPrices(args) {
  const state = (args.state || 'NSW').toUpperCase();
  const fuelType = args.fuel_type || 'U91';

  let result;
  if (state === 'NSW') {
    result = await getNSWFuelPrices(fuelType);
  } else if (state === 'WA') {
    result = await getWAFuelPrices(fuelType);
  }

  if (result) return result;

  // Fallback with useful info — explicit anti-fabrication
  return {
    state,
    fuel_type: fuelType,
    _DO_NOT_FABRICATE: true,
    instruction: `无法获取${state}的实时油价数据。严禁编造任何价格数字。请告诉用户访问以下官方网站查询。`,
    message: `Live fuel prices for ${state} are not available through this service.`,
    resources: {
      NSW: 'https://www.fuelcheck.nsw.gov.au',
      VIC: 'https://www.fuelmap.com.au',
      QLD: 'https://www.qld.gov.au/transport/fuel',
      WA: 'https://www.fuelwatch.wa.gov.au',
      SA: 'https://www.safuelpricinginformation.com.au',
      TAS: 'Visit Google Maps for local prices',
      NT: 'https://www.ntgov.au/fuel-prices',
      ACT: 'https://www.fuelcheck.nsw.gov.au (covers ACT)'
    },
    tip: 'Costco, Woolworths (via Ampol/Caltex vouchers), and 7-Eleven lock-in are often cheapest.'
  };
}
