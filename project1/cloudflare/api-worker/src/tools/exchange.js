/**
 * Exchange Rate Tool — Frankfurter API
 * https://api.frankfurter.dev/v1
 */

const BASE_URL = 'https://api.frankfurter.dev/v1';

const CURRENCY_NAMES = {
  AUD: '澳元', CNY: '人民币', USD: '美元', HKD: '港币', JPY: '日元',
  GBP: '英镑', EUR: '欧元', NZD: '新西兰元', SGD: '新加坡元',
  KRW: '韩元', TWD: '新台币', INR: '印度卢比', CAD: '加拿大元',
  THB: '泰铢', MYR: '马来西亚林吉特', IDR: '印尼盾', PHP: '菲律宾比索',
  VND: '越南盾'
};

export async function convertCurrency(args) {
  const amount = parseFloat(args.amount || 100);
  const from = (args.from_currency || 'AUD').toUpperCase();
  const to = (args.to_currency || 'CNY').toUpperCase();

  const url = `${BASE_URL}/latest?amount=${amount}&from=${from}&to=${to}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'AustralianAssistant/1.0' }
  });

  if (!resp.ok) throw new Error(`Frankfurter API error: ${resp.status}`);
  const data = await resp.json();

  const converted = data.rates?.[to];
  if (converted === undefined) throw new Error(`Unsupported currency pair: ${from}→${to}`);

  return {
    amount,
    from: { code: from, name: CURRENCY_NAMES[from] || from },
    to: { code: to, name: CURRENCY_NAMES[to] || to },
    converted: Math.round(converted * 100) / 100,
    rate: Math.round((converted / amount) * 10000) / 10000,
    date: data.date
  };
}

export async function getExchangeRates(args) {
  const base = (args.base || 'AUD').toUpperCase();
  const symbols = 'CNY,USD,HKD,JPY,GBP,EUR,NZD,SGD,KRW,TWD';

  const resp = await fetch(`${BASE_URL}/latest?base=${base}&symbols=${symbols}`, {
    headers: { 'User-Agent': 'AustralianAssistant/1.0' }
  });

  if (!resp.ok) throw new Error(`Frankfurter API error: ${resp.status}`);
  const data = await resp.json();

  const rates = Object.entries(data.rates || {}).map(([code, rate]) => ({
    code,
    name: CURRENCY_NAMES[code] || code,
    rate: Math.round(rate * 10000) / 10000
  }));

  return { base, date: data.date, rates };
}
