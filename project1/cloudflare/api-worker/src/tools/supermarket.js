/**
 * Supermarket & Retail Specials Tool
 * Fetches weekly specials/sales from Australian supermarkets, pharmacies and retail stores.
 *
 * Strategy:
 *   Woolworths        → Browser Rendering (API Interception) → JSON API → Tavily → Jina
 *   Coles             → Browser Rendering (API Interception) → Tavily → Jina
 *   Aldi              → Tavily → Jina
 *   IGA               → Tavily → Jina
 *   Chemist Warehouse → Browser Rendering (API Interception) → Tavily → Jina
 *   Priceline         → Tavily → Jina
 *   Big W             → Tavily → Jina
 *   Kmart             → Tavily → Jina
 *
 * All results cached in KV for 6 hours to minimise external calls.
 */

import puppeteer from '@cloudflare/puppeteer';

const KV_CACHE_PREFIX = 'supermarket:specials:';
const CACHE_TTL = 6 * 60 * 60; // seconds

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ─── Woolworths Browser Rendering ────────────────────────────────────────────

/**
 * Woolworths Browser Rendering — uses real Chrome to execute JS and scrape products
 * Requires Cloudflare Workers Paid plan ($5/month) with Browser Rendering enabled
 */
async function fetchWoolworthsBrowser(env) {
  if (!env?.BROWSER) {
    throw new Error('Browser Rendering not available (need Workers Paid plan with browser binding)');
  }

  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent(BROWSER_UA);

    // Intercept XHR/fetch API responses — Woolworths loads products via Angular API calls
    let apiProducts = null;
    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('/apis/ui/browse/category') || url.includes('/apis/ui/Search/products')) {
          const json = await response.json();
          console.log('[Woolworths Browser] Intercepted API response:', url.substring(0, 120));
          // Woolworths API returns { Bundles: [{ Products: [...] }] }
          const bundles = json?.Bundles || json?.bundles || [];
          const products = [];
          for (const bundle of bundles) {
            const prods = bundle?.Products || bundle?.products || [];
            for (const p of prods) {
              products.push({
                name: p.DisplayName || p.Name || p.displayName || '',
                brand: p.Brand || p.brand || '',
                price: p.Price || p.price || null,
                was_price: p.WasPrice || p.wasPrice || null,
                save: p.SavingsAmount ? `Save $${p.SavingsAmount}` : '',
                size: p.PackageSize || p.packageSize || '',
                image: p.SmallImageFile || p.LargeImageFile || '',
                stockcode: p.Stockcode || p.stockcode || '',
              });
            }
          }
          if (products.length > 0) {
            apiProducts = products;
            console.log(`[Woolworths Browser] Got ${products.length} products from API`);
          }
        }
      } catch (e) {
        // ignore non-JSON responses
      }
    });

    console.log('[Woolworths Browser] Navigating to half-price page...');
    await page.goto('https://www.woolworths.com.au/shop/browse/specials/half-price', {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    // Wait a bit for late API calls
    await new Promise(r => setTimeout(r, 3000));

    if (apiProducts && apiProducts.length > 0) {
      console.log(`[Woolworths Browser] Success via API interception: ${apiProducts.length} products`);
      await browser.close();
      return {
        store: 'Woolworths',
        items: apiProducts.slice(0, 36),
        count: Math.min(apiProducts.length, 36),
        fetched_via: 'Browser Rendering (API Interception)'
      };
    }

    // Fallback: scroll and wait more for Angular to render
    console.log('[Woolworths Browser] No API interception, trying DOM extraction...');
    await page.evaluate(() => window.scrollTo(0, 800));
    await new Promise(r => setTimeout(r, 3000));

    // Try extracting from rendered DOM
    const items = await page.evaluate(() => {
      // Check if Angular has rendered the product tiles
      const tiles = document.querySelectorAll('.product-grid-v2--tile');
      const products = [];
      for (const tile of tiles) {
        const text = tile.innerText.trim();
        if (!text) continue;
        
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let name = '', price = null, was_price = null, save = '';
        
        for (const line of lines) {
          const priceMatch = line.match(/^\$(\d+\.?\d*)/);
          const wasMatch = line.match(/was\s*\$(\d+\.?\d*)/i);
          const saveMatch = line.match(/save\s*\$(\d+\.?\d*)/i);
          
          if (priceMatch && !price) price = parseFloat(priceMatch[1]);
          else if (wasMatch) was_price = parseFloat(wasMatch[1]);
          else if (saveMatch) save = line;
          else if (!name && line.length > 3 && !line.startsWith('$')) name = line;
        }
        
        if (name && price) {
          products.push({ name, brand: '', price, was_price, save, size: '' });
        }
      }
      return products.slice(0, 36);
    });

    await browser.close();

    if (items.length > 0) {
      console.log(`[Woolworths Browser] DOM extraction got ${items.length} products`);
      return {
        store: 'Woolworths',
        items,
        count: items.length,
        fetched_via: 'Browser Rendering (DOM)'
      };
    }

    throw new Error('No products found via API interception or DOM');
  } catch (err) {
    console.error('[Woolworths Browser] Error:', err.message);
    await browser.close().catch(() => {});
    throw err;
  }
}

// ─── Coles Browser Rendering ────────────────────────────────────────────────

/**
 * Coles Browser Rendering — Coles is a Next.js SSR app behind Imperva WAF.
 * Strategy: __NEXT_DATA__ (structured JSON) → DOM product tiles → throw
 */
async function fetchColesBrowser(env) {
  if (!env?.BROWSER) throw new Error('Browser Rendering not available');

  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent(BROWSER_UA);

    console.log('[Coles Browser] Navigating to specials page...');
    await page.goto('https://www.coles.com.au/on-special', {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    await new Promise(r => setTimeout(r, 3000));

    // Strategy 1: Extract from __NEXT_DATA__ (Coles uses Next.js SSR)
    const nextDataProducts = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script) return { products: [], debug: 'no __NEXT_DATA__ script' };
      try {
        const data = JSON.parse(script.textContent);
        const pp = data?.props?.pageProps || {};
        const keys = Object.keys(pp).join(',');
        const results = pp?.searchResults?.results || pp?.results || pp?.products || [];
        if (!Array.isArray(results) || results.length === 0)
          return { products: [], debug: 'pageProps keys: ' + keys + ', results: 0' };

        const products = [];
        for (const p of results) {
          const name = p.name || p.displayName || p.title || '';
          if (!name) continue;
          products.push({
            name,
            brand: p.brand || p.brandName || '',
            price: p.pricing?.now || p.price || p.salePrice || null,
            was_price: p.pricing?.was || p.wasPrice || null,
            save: p.pricing?.saveAmount ? ('Save $' + p.pricing.saveAmount) :
                  (p.pricing?.saveStatement || ''),
            size: p.size || p.packageSize || '',
            image: p.imageUris?.[0]?.uri || p.image || '',
          });
        }
        return { products, debug: 'keys: ' + keys + ', found: ' + products.length + '/' + results.length };
      } catch (e) {
        return { products: [], debug: 'parse_error: ' + e.message };
      }
    });

    console.log('[Coles Browser] __NEXT_DATA__: ' + nextDataProducts.debug);

    if (nextDataProducts.products.length > 0) {
      await browser.close();
      return {
        store: 'Coles',
        items: nextDataProducts.products.slice(0, 36),
        count: Math.min(nextDataProducts.products.length, 36),
        fetched_via: 'Browser Rendering (__NEXT_DATA__)',
      };
    }

    // Strategy 2: DOM product tiles (data-testid="product-tile")
    await page.evaluate(() => window.scrollTo(0, 800));
    await new Promise(r => setTimeout(r, 2000));

    const items = await page.evaluate(() => {
      const tiles = document.querySelectorAll('[data-testid="product-tile"]');
      if (tiles.length === 0) return [];
      const products = [];
      for (const tile of tiles) {
        const text = tile.innerText?.trim();
        if (!text || text.length < 10) continue;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let name = '', price = null, was_price = null, save = '';
        for (const line of lines) {
          const priceMatch = line.match(/^\$([0-9]+\.?[0-9]*)/);
          const nowMatch = line.match(/now\s*\$([0-9]+\.?[0-9]*)/i);
          const wasMatch = line.match(/was\s*\$([0-9]+\.?[0-9]*)/i);
          const saveMatch = line.match(/save\s*\$([0-9]+\.?[0-9]*)/i);
          const halfPrice = line.match(/half\s*price/i);
          if (nowMatch && !price) price = parseFloat(nowMatch[1]);
          else if (priceMatch && !price) price = parseFloat(priceMatch[1]);
          if (wasMatch) was_price = parseFloat(wasMatch[1]);
          if (saveMatch) save = line;
          if (halfPrice && !save) save = 'Half Price';
          if (!priceMatch && !nowMatch && !wasMatch && !saveMatch && !halfPrice &&
              line.length > 5 && line.length < 150 &&
              !line.match(/^(save|was|now|\$|half|add to|out of stock)/i)) {
            if (line.length > name.length) name = line;
          }
        }
        if (name && price && price > 0) {
          products.push({ name, brand: '', price, was_price, save, size: '' });
        }
      }
      return products.slice(0, 36);
    });

    await browser.close();

    if (items.length > 0) {
      console.log('[Coles Browser] DOM tiles: ' + items.length + ' products');
      return { store: 'Coles', items, count: items.length, fetched_via: 'Browser Rendering (DOM)' };
    }

    throw new Error('No products found via Coles browser');
  } catch (err) {
    console.error('[Coles Browser] Error:', err.message);
    await browser.close().catch(() => {});
    throw err;
  }
}

// ─── Woolworths JSON API ─────────────────────────────────────────────────────

async function fetchWoolworthsSpecials(categoryId = 'specialsfeatured') {
  const params = new URLSearchParams({
    categoryId,
    pageSize: '24',
    pageNumber: '1',
    sortType: 'TraderRelevance',
    url: '/shop/browse/specials',
  });

  const resp = await fetch(
    `https://www.woolworths.com.au/apis/ui/browse/category?${params}`,
    {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-AU,en;q=0.9',
        Referer: 'https://www.woolworths.com.au/shop/browse/specials',
        Origin: 'https://www.woolworths.com.au',
      },
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!resp.ok) throw new Error(`Woolworths API ${resp.status}`);
  const data = await resp.json();

  const bundles = data?.Bundles || [];
  const items = [];
  for (const bundle of bundles.slice(0, 30)) {
    const products = bundle?.Products || [bundle];
    const p = products[0];
    if (!p) continue;
    const name = p?.Name || p?.DisplayName || '';
    if (!name) continue;
    items.push({
      name,
      brand: p?.Brand || '',
      price: p?.Price ?? p?.SalePrice ?? null,
      was_price: p?.WasPrice ?? null,
      save: p?.SavePercent
        ? `Save ${p.SavePercent}%`
        : p?.SaveAmount
        ? `Save $${p.SaveAmount}`
        : '',
      size: p?.PackageSize || p?.CupMeasure || '',
    });
  }

  return { store: 'Woolworths', items, count: items.length };
}

// ─── Tavily search fallback ──────────────────────────────────────────────────

const TAVILY_STORE_CONFIG = {
  woolworths: {
    query: 'Woolworths Australia half price specials products list this week',
  },
  coles: {
    query: 'Coles Australia half price on special products list this week',
  },
  aldi: {
    query: 'Aldi Australia Super Savers weekly special buys products this week',
  },
  iga: {
    query: 'IGA Australia weekly specials products list this week',
  },
  chemistwarehouse: {
    query: 'Chemist Warehouse Australia catalogue sale products prices site:chemistwarehouse.com.au OR site:catalogueoffers.com.au',
  },
  priceline: {
    query: 'Priceline Pharmacy Australia catalogue sale specials products this week site:priceline.com.au OR site:salefinder.com.au',
  },
  bigw: {
    query: 'Big W Australia sale specials low prices this week',
  },
  kmart: {
    query: 'Kmart Australia sale low prices deals this week',
  },
};

const EXCLUDE_DOMAINS = new Set([
  'ozbargain.com.au', 'reddit.com', 'facebook.com', 'twitter.com',
  'youtube.com', 'instagram.com', 'tiktok.com',
  'thenewdaily.com.au', 'lifehacker.com', 'au.lifehacker.com',
  'bhg.com.au', 'finder.com.au',
]);

async function fetchViaTavily(storeName, tavilyKey) {
  const cfg = TAVILY_STORE_CONFIG[storeName.toLowerCase()];
  if (!cfg) throw new Error(`No Tavily config for ${storeName}`);

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: cfg.query,
      max_results: 8,
      search_depth: 'advanced',
      include_raw_content: true,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) throw new Error(`Tavily ${resp.status} for ${storeName}`);
  const data = await resp.json();

  const pages = (data.results || [])
    .filter(r => {
      try {
        const host = new URL(r.url).hostname.replace(/^www\./, '');
        return !EXCLUDE_DOMAINS.has(host);
      } catch { return false; }
    })
    .map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: (r.raw_content || r.content || '').substring(0, 4000),
    }))
    .filter(r => r.content.length > 100)
    .slice(0, 3);

  if (pages.length === 0) throw new Error(`Tavily returned no usable content for ${storeName} after domain filter`);

  return {
    store: storeName,
    specials_pages: pages,
    fetched_via: `Tavily (${pages[0].url.split('/')[2]})`,
  };
}

// ─── Jina Reader helper ─────────────────────────────────────────────────────

async function fetchViaJina(url, storeName, jinaKey) {
  const resp = await fetch('https://r.jina.ai/' + url, {
    headers: {
      Authorization: `Bearer ${jinaKey}`,
      Accept: 'application/json',
      'X-Return-Format': 'markdown',
      'X-Remove-Selector': 'nav,footer,header,.cookie-banner,.newsletter',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`Jina ${resp.status} for ${storeName}`);
  const data = await resp.json();
  const content = data?.data?.content || data?.content || '';
  if (content.length < 100) throw new Error(`Empty page for ${storeName}`);

  return {
    store: storeName,
    specials_text: content.substring(0, 3500),
    source_url: url,
    fetched_via: 'Jina Reader',
  };
}

// ─── Per-store fetchers ──────────────────────────────────────────────────────

async function fetchColesSpecials(tavilyKey, jinaKey, env) {
  if (env?.BROWSER) {
    try { return await fetchColesBrowser(env); } catch (e) {
      console.log(`[Coles] Browser failed: ${e.message}, falling back`);
    }
  }
  if (tavilyKey) return fetchViaTavily('coles', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.coles.com.au/on-special', 'Coles', jinaKey);
  throw new Error('No API key available');
}

async function fetchAldiSpecials(tavilyKey, jinaKey) {
  if (tavilyKey) return fetchViaTavily('aldi', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.aldi.com.au/en/specials/', 'Aldi', jinaKey);
  throw new Error('No API key available');
}

async function fetchIGASpecials(tavilyKey, jinaKey) {
  if (tavilyKey) return fetchViaTavily('iga', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.iga.com.au/specials/', 'IGA', jinaKey);
  throw new Error('No API key available');
}

async function fetchChemistWarehouseSpecials(tavilyKey, jinaKey) {
  if (tavilyKey) return fetchViaTavily('chemistwarehouse', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.chemistwarehouse.com.au/catalogue', 'Chemist Warehouse', jinaKey);
  throw new Error('No API key available');
}

async function fetchPricelineSpecials(tavilyKey, jinaKey) {
  if (tavilyKey) return fetchViaTavily('priceline', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.priceline.com.au/on-sale', 'Priceline', jinaKey);
  throw new Error('No API key available');
}

async function fetchBigWSpecials(tavilyKey, jinaKey) {
  if (tavilyKey) return fetchViaTavily('bigw', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.bigw.com.au/sale', 'Big W', jinaKey);
  throw new Error('No API key available');
}

async function fetchKmartSpecials(tavilyKey, jinaKey) {
  if (tavilyKey) return fetchViaTavily('kmart', tavilyKey);
  if (jinaKey)   return fetchViaJina('https://www.kmart.com.au/collection/low-prices/', 'Kmart', jinaKey);
  throw new Error('No API key available');
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function getSupermarketSpecials(args, env) {
  const store = (args.store || 'all').toLowerCase();
  const query = (args.query || '').toLowerCase();
  const tavilyKey = env?.TAVILY_API_KEY;
  const jinaKey = env?.JINA_API_KEY;

  const storeAliases = {
    'chemist': 'chemistwarehouse', 'cw': 'chemistwarehouse', 'chemist warehouse': 'chemistwarehouse',
    'big w': 'bigw', 'big_w': 'bigw',
  };
  const normalised = storeAliases[store] || store;

  const SUPERMARKETS = ['woolworths', 'coles', 'aldi'];
  const PHARMACIES   = ['chemistwarehouse', 'priceline'];
  const RETAIL       = ['bigw', 'kmart'];
  const ALL_STORES   = [...SUPERMARKETS, ...PHARMACIES, ...RETAIL, 'iga'];

  let storesToFetch = [];
  if (normalised === 'all')            storesToFetch = [...SUPERMARKETS];
  else if (normalised === 'supermarkets') storesToFetch = [...SUPERMARKETS];
  else if (normalised === 'pharmacy')     storesToFetch = [...PHARMACIES];
  else if (normalised === 'retail')       storesToFetch = [...RETAIL];
  else if (normalised === 'everything')   storesToFetch = [...ALL_STORES];
  else storesToFetch = [normalised];

  const cacheKey = `${KV_CACHE_PREFIX}${normalised}`;

  // ── KV cache read
  if (env?.KV) {
    try {
      const cached = await env.KV.get(cacheKey, 'json');
      if (cached) {
        const result = { ...cached, cached: true };
        if (query) {
          for (const [, data] of Object.entries(result.stores || {})) {
            if (data.items) {
              data.items = data.items.filter(
                p => p.name.toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query)
              );
            }
          }
        }
        return result;
      }
    } catch { /* cache miss */ }
  }

  // ── Live fetch
  const result = { query_time: new Date().toISOString(), stores: {}, errors: [] };

  const fetchMap = {
    woolworths: async () => {
      if (env?.BROWSER) {
        try { return await fetchWoolworthsBrowser(env); } catch (e) {
          result.errors.push(`Woolworths Browser: ${e.message}`);
        }
      }
      try { return await fetchWoolworthsSpecials('specialsfeatured'); } catch (e) {
        result.errors.push(`Woolworths API: ${e.message}`);
      }
      if (tavilyKey) {
        try { return await fetchViaTavily('woolworths', tavilyKey); } catch (e) {
          result.errors.push(`Woolworths Tavily: ${e.message}`);
        }
      }
      return null;
    },
    coles: async () => {
      try { return await fetchColesSpecials(tavilyKey, jinaKey, env); } catch (e) {
        result.errors.push(`Coles: ${e.message}`); return null;
      }
    },
    aldi: async () => {
      try { return await fetchAldiSpecials(tavilyKey, jinaKey); } catch (e) {
        result.errors.push(`Aldi: ${e.message}`); return null;
      }
    },
    iga: async () => {
      try { return await fetchIGASpecials(tavilyKey, jinaKey); } catch (e) {
        result.errors.push(`IGA: ${e.message}`); return null;
      }
    },
    chemistwarehouse: async () => {
      try { return await fetchChemistWarehouseSpecials(tavilyKey, jinaKey); } catch (e) {
        result.errors.push(`Chemist Warehouse: ${e.message}`); return null;
      }
    },
    priceline: async () => {
      try { return await fetchPricelineSpecials(tavilyKey, jinaKey); } catch (e) {
        result.errors.push(`Priceline: ${e.message}`); return null;
      }
    },
    bigw: async () => {
      try { return await fetchBigWSpecials(tavilyKey, jinaKey); } catch (e) {
        result.errors.push(`Big W: ${e.message}`); return null;
      }
    },
    kmart: async () => {
      try { return await fetchKmartSpecials(tavilyKey, jinaKey); } catch (e) {
        result.errors.push(`Kmart: ${e.message}`); return null;
      }
    },
  };

  for (const s of storesToFetch) {
    const fetcher = fetchMap[s];
    if (!fetcher) { result.errors.push(`Unknown store: ${s}`); continue; }
    const data = await fetcher();
    if (data) result.stores[s] = data;
  }

  // ── KV cache write
  const hasData = Object.keys(result.stores).length > 0;
  if (hasData && env?.KV) {
    try { await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL }); } catch { /* non-fatal */ }
  }

  // ── Filter by query keyword
  if (query) {
    for (const [, data] of Object.entries(result.stores)) {
      if (data.items) {
        data.items = data.items.filter(
          p => p.name.toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query)
        );
      }
    }
  }

  if (!hasData) {
    result._DO_NOT_FABRICATE = true;
    result.instruction = '无法获取超市特价数据。严禁编造任何商品名称或价格。请告知用户该服务暂时不可用，建议访问以下超市官网查看最新特价。';
    result.message = 'Unable to fetch specials. Available stores: woolworths, coles, aldi, iga, chemistwarehouse, priceline, bigw, kmart.';
    result.official_sites = {
      woolworths: 'https://www.woolworths.com.au/shop/browse/specials',
      coles: 'https://www.coles.com.au/on-special',
      aldi: 'https://www.aldi.com.au/en/specials/',
    };
  }

  return result;
}

/**
 * Refresh all supermarket KV caches — called by the cron scheduler.
 */
export async function refreshSupermarketCache(env) {
  const stores = ['woolworths', 'coles', 'aldi', 'chemistwarehouse'];
  for (const store of stores) {
    try {
      const fresh = await getSupermarketSpecials({ store }, env);
      console.log(`[cron] refreshed ${store}: ${Object.keys(fresh.stores).length} stores, errors: ${fresh.errors.length}`);
    } catch (e) {
      console.error(`[cron] failed to refresh ${store}: ${e.message}`);
    }
  }
}
