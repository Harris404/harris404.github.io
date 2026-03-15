/**
 * Supermarket Product Search Tool
 * Search for specific products across Australian supermarkets & retail stores.
 *
 * Strategy:
 *   Woolworths        → Direct JSON API (fully open)
 *   Coles             → Browser Rendering (DOM extraction from search results)
 *   Aldi              → Direct JSON API (api.aldi.com.au/v3/product-search)
 *   Big W             → Direct POST API (api.bigw.com.au/search/v1/search)
 *   Chemist Warehouse → Direct Algolia API (Sigma Healthcare, prod_cwr-cw-au)
 *   Priceline         → Direct Algolia API (Sigma Healthcare, prod_cwr-ub-au)
 *   IKEA              → Direct SIK API (sik.search.blue.cdtapps.com/au/en)
 *   Daiso             → Direct Shopify API (mydaiso.com.au/search/suggest.json)
 *   Target            → Direct Constructor.io API (ac.cnstrc.com)
 *   Genki Mart        → Direct WooCommerce Store API (genkimart.com.au/wp-json/wc/store)
 *   Kmart / IGA       → Tavily site-scoped search
 *   Asian supermarkets→ Lasoo catalogue + general web search
 *   Other stores      → Generic Tavily web search
 */

import puppeteer from '@cloudflare/puppeteer';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ─── Woolworths Direct API ───────────────────────────────────────────────────

async function searchWoolworths(query) {
  const params = new URLSearchParams({
    searchTerm: query,
    pageSize: '24',
    pageNumber: '1',
    sortType: 'TraderRelevance',
    url: `/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
  });

  const resp = await fetch(
    `https://www.woolworths.com.au/apis/ui/Search/products?${params}`,
    {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-AU,en;q=0.9',
        Referer: `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
        Origin: 'https://www.woolworths.com.au',
      },
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!resp.ok) throw new Error(`Woolworths search API ${resp.status}`);
  const data = await resp.json();

  const products = (data?.Products || []).slice(0, 24);
  const items = [];
  for (const wrapper of products) {
    // Products[].Products[0] — same nested structure as specials endpoint
    const inner = wrapper?.Products || [wrapper];
    const p = inner[0];
    if (!p || !p.Price) continue;
    items.push({
      name: p?.DisplayName || p?.Name || '',
      brand: p?.Brand || '',
      price: p?.Price ?? null,
      was_price: (p?.IsOnSpecial || p?.IsHalfPrice) ? (p?.WasPrice ?? null) : null,
      save: p?.SavingsAmount > 0 ? `Save $${p.SavingsAmount.toFixed(2)}` : (p?.IsHalfPrice ? 'Half Price' : ''),
      size: p?.PackageSize || p?.CupMeasure || '',
      on_special: p?.IsOnSpecial || p?.IsHalfPrice || false,
      cup_price: p?.CupString || '',
      url: p?.UrlFriendlyName
        ? `https://www.woolworths.com.au/shop/productdetails/${p?.Stockcode}/${p?.UrlFriendlyName}`
        : '',
    });
  }
  const finalItems = items.filter(p => p.name && p.price !== null);

  return {
    store: 'Woolworths',
    query,
    items: finalItems,
    total: data?.TotalRecordCount || finalItems.length,
    fetched_via: 'Direct API',
  };
}

// ─── Aldi Direct API ────────────────────────────────────────────────────────

async function searchAldi(query) {
  // Aldi uses a Spryker-based Glue API. Allowed limit values: 12,16,24,30,32,48,60
  const resp = await fetch(
    `https://api.aldi.com.au/v3/product-search?q=${encodeURIComponent(query)}&limit=24`,
    {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json',
        Origin: 'https://www.aldi.com.au',
        Referer: `https://www.aldi.com.au/search?q=${encodeURIComponent(query)}`,
      },
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!resp.ok) throw new Error(`Aldi API ${resp.status}`);
  const data = await resp.json();
  if (data.errors?.length) throw new Error(`Aldi API: ${data.errors[0].message}`);

  const rawItems = data?.data || [];
  const items = rawItems
    .map(p => {
      const price = p?.price;
      return {
        name: p?.name || '',
        brand: p?.brandName || '',
        price: price?.amountRelevant != null ? price.amountRelevant / 100 : null,
        price_display: price?.amountRelevantDisplay || '',
        was_price_display: price?.wasPriceDisplay || '',
        was_price: price?.wasPriceDisplay
          ? parseFloat((price.wasPriceDisplay || '').replace(/[^\d.]/g, '')) || null
          : null,
        on_special: !!price?.wasPriceDisplay,
        save: price?.savingsDisplay || '',
        cup_price: price?.comparisonDisplay || '',
        in_store_only: p?.notForSale === true,
        url: p?.urlSlugText ? `https://www.aldi.com.au/p/${p.urlSlugText}` : '',
      };
    })
    .filter(p => p.name && p.price !== null);

  return {
    store: 'Aldi',
    query,
    items,
    total: data?.meta?.pagination?.totalCount || items.length,
    note: 'Aldi products are in-store only (not available for online delivery)',
    fetched_via: 'Direct API',
  };
}

// ─── Big W Direct API ────────────────────────────────────────────────────────

async function searchBigW(query) {
  // Big W proprietary personalisation search API
  const resp = await fetch('https://api.bigw.com.au/search/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_UA,
      'Origin': 'https://www.bigw.com.au',
      'Referer': 'https://www.bigw.com.au/',
    },
    body: JSON.stringify({
      query: { text: query },
      sessionId: crypto.randomUUID(),
      clientId: 'web',
      page: 0,
      perPage: 20,
      format: '1',
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) throw new Error(`Big W API ${resp.status}`);
  const data = await resp.json();

  const results = data?.organic?.results || [];
  const items = results
    .map(p => {
      const info = p.information || {};
      const ident = p.identifiers || {};
      const prices = p.prices || {};
      // Prefer NAT (national) price; fallback to NSW or first available state
      const natPrice = prices.NAT || prices.NSW || Object.values(prices)[0] || {};
      const priceCents = natPrice?.price?.cents;
      if (priceCents == null) return null;
      const savingCents = natPrice?.saving?.cents || 0;
      const wasPriceCents = savingCents > 0 ? priceCents + savingCents : null;
      const isOnSale = natPrice?.priceType === 'PROMO' || natPrice?.clearance || savingCents > 0;
      const articleId = ident.articleId || '';
      const nameSafe = (info.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
      return {
        name: info.name || '',
        brand: info.brand?.name || '',
        price: priceCents / 100,
        was_price: wasPriceCents != null ? wasPriceCents / 100 : null,
        on_special: isOnSale,
        save: savingCents > 0
          ? `Save $${(savingCents / 100).toFixed(2)}`
          : (natPrice?.clearance ? 'Clearance' : ''),
        url: articleId
          ? `https://www.bigw.com.au/product/${nameSafe}/${articleId}`
          : '',
      };
    })
    .filter(p => p && p.name && p.price > 0);

  return {
    store: 'Big W',
    query,
    items,
    total: items.length,
    fetched_via: 'Direct API',
  };
}

// ─── Sigma Healthcare Algolia (Chemist Warehouse + Priceline) ────────────────

const CWR_ALGOLIA_APP_ID = '42NP1V2I98';
const CWR_ALGOLIA_API_KEY = '3ce54af79eae81a18144a7aa7ee10ec2';

const CWR_STORE_CONFIG = {
  chemistwarehouse: {
    displayName: 'Chemist Warehouse',
    indexName: 'prod_cwr-cw-au_products_en',
    baseUrl: 'https://www.chemistwarehouse.com.au/buy',
  },
  priceline: {
    displayName: 'Priceline',
    indexName: 'prod_cwr-ub-au_products_en',
    baseUrl: 'https://www.priceline.com.au/buy',
  },
};

async function searchAlgoliaStore(storeKey, query) {
  const cfg = CWR_STORE_CONFIG[storeKey];
  if (!cfg) throw new Error(`Unknown Algolia store: ${storeKey}`);

  const resp = await fetch(
    `https://${CWR_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${cfg.indexName}/query`,
    {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': CWR_ALGOLIA_APP_ID,
        'X-Algolia-API-Key': CWR_ALGOLIA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, hitsPerPage: 20 }),
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!resp.ok) throw new Error(`${cfg.displayName} Algolia ${resp.status}`);
  const data = await resp.json();

  const items = (data.hits || [])
    .map(hit => {
      const attrs = hit.attributes || {};
      const priceCents = parseInt(attrs['cwr-algolia-price'] || '0', 10);
      if (!priceCents) return null;
      const discount = parseFloat(attrs['PIMS_percentage_discount'] || '0');
      const wasCents = discount > 0 ? Math.round(priceCents / (1 - discount / 100)) : null;

      const nameVal = hit.name;
      const name = typeof nameVal === 'object' ? (nameVal?.en || '') : (nameVal || '');
      const slugVal = hit.slug;
      const slug = typeof slugVal === 'object' ? (slugVal?.en || '') : (slugVal || '');
      const catSlugsVal = hit.categorySlugs;
      const catSlug = typeof catSlugsVal === 'object' ? (catSlugsVal?.en?.[0] || '') : '';
      const url = slug && catSlug ? `${cfg.baseUrl}/${catSlug}/${slug}` : '';

      const brandVal = attrs['cwr-brand'];
      const brand = brandVal?.label?.en || brandVal?.key || '';

      return {
        name,
        brand,
        price: priceCents / 100,
        was_price: wasCents != null ? wasCents / 100 : null,
        on_special: discount > 0,
        save: discount > 0 ? `${Math.round(discount)}% off` : '',
        url,
      };
    })
    .filter(p => p && p.name && p.price > 0);

  return {
    store: cfg.displayName,
    query,
    items,
    total: data.nbHits || items.length,
    fetched_via: 'Direct API (Algolia)',
  };
}

async function searchChemistWarehouse(query) {
  return searchAlgoliaStore('chemistwarehouse', query);
}

async function searchPriceline(query) {
  return searchAlgoliaStore('priceline', query);
}

// ─── Coles Browser Rendering ─────────────────────────────────────────────────

async function searchColesBrowser(query, env) {
  if (!env?.BROWSER) throw new Error('Browser binding not available');

  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent(BROWSER_UA);

    const url = `https://www.coles.com.au/search?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3000));

    const items = await page.evaluate(() => {
      const tiles = document.querySelectorAll('[data-testid="product-tile"]');
      const results = [];
      for (const tile of tiles) {
        const text = tile.innerText || '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        const priceMatch = text.match(/\$(\d+(?:\.\d{1,2})?)/);
        const wasMatch = text.match(/Was\s+\$(\d+(?:\.\d{1,2})?)/i);
        const saveMatch = text.match(/Save\s+\$(\d+(?:\.\d{1,2})?)/i);
        const cupMatch = text.match(/\$[\d.]+\s*\/\s*\w+/);

        const price = priceMatch ? parseFloat(priceMatch[1]) : null;
        const wasPrice = wasMatch ? parseFloat(wasMatch[1]) : null;

        if (!price || price <= 0) continue;

        const nonPriceLines = lines.filter(l =>
          !/^\$[\d.]+/.test(l) &&
          !/^Was/i.test(l) &&
          !/^Save/i.test(l) &&
          !/^per\s/i.test(l) &&
          !/^\d+\s*for\s*/i.test(l) &&
          l.length > 2
        );
        const name = nonPriceLines.reduce((a, b) => a.length >= b.length ? a : b, '');

        // Get product URL from anchor
        const anchor = tile.querySelector('a[href*="/product"]');
        const href = anchor ? 'https://www.coles.com.au' + anchor.getAttribute('href') : '';

        results.push({
          name,
          price,
          was_price: wasPrice,
          save: saveMatch ? `Save $${saveMatch[1]}` : '',
          cup_price: cupMatch ? cupMatch[0] : '',
          on_special: wasPrice !== null && wasPrice > price,
          url: href,
        });
      }
      return results;
    });

    await browser.close();
    return {
      store: 'Coles',
      query,
      items: items.slice(0, 20),
      total: items.length,
      fetched_via: 'Browser Rendering',
    };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}
// ─── Daiso Direct Shopify API ──────────────────────────────────────────────

async function searchDaiso(query) {
  const params = new URLSearchParams({
    q: query,
    'resources[type]': 'product',
    'resources[limit]': '15',
    'resources[options][unavailable_products]': 'last',
  });
  const resp = await fetch(`https://mydaiso.com.au/search/suggest.json?${params}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`Daiso API ${resp.status}`);
  const data = await resp.json();

  const raw = data?.resources?.results?.products || [];
  const items = raw.slice(0, 15).map(p => ({
    name: p.title || '',
    type: p.type || '',
    price: p.price ? parseFloat(p.price) : null,
    price_str: p.price ? `$${parseFloat(p.price).toFixed(2)}` : null,
    available: p.available !== false,
    url: p.url ? `https://mydaiso.com.au${p.url.split('?')[0]}` : '',
  })).filter(i => i.price !== null);

  if (items.length === 0) throw new Error(`No Daiso results for: ${query}`);

  return {
    store: 'Daiso',
    query,
    items,
    total: items.length,
    fetched_via: 'Daiso Shopify API',
    search_url: `https://mydaiso.com.au/search?q=${encodeURIComponent(query)}`,
    note: 'All Daiso items are $2.80 unless otherwise listed.',
  };
}

// ─── Genki Mart Direct WooCommerce Store API ─────────────────────────────────

async function searchGenkiMart(query) {
  const url = `https://genkimart.com.au/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}&per_page=15`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`Genki Mart API ${resp.status}`);
  const data = await resp.json();

  const items = (Array.isArray(data) ? data : []).slice(0, 15).map(p => {
    const pr = p.prices || {};
    const minor = pr.currency_minor_unit ?? 2;
    const divisor = Math.pow(10, minor);
    const price = pr.price != null ? parseInt(pr.price) / divisor : null;
    const regPrice = pr.regular_price != null ? parseInt(pr.regular_price) / divisor : null;
    const onSale = p.on_sale === true && regPrice !== null && regPrice > price;
    // Decode HTML entities in name
    const name = (p.name || '').replace(/&#038;/g, '&').replace(/&#8211;/g, '–').replace(/&amp;/g, '&');
    return {
      name,
      price,
      was_price: onSale ? regPrice : null,
      price_str: price != null ? `$${price.toFixed(2)}` : null,
      on_special: onSale,
      in_stock: p.is_in_stock !== false,
      url: p.permalink || 'https://genkimart.com.au/online-store',
    };
  }).filter(i => i.price !== null);

  if (items.length === 0) throw new Error(`No Genki Mart results for: ${query}`);

  return {
    store: 'Genki Mart',
    query,
    items,
    total: items.length,
    fetched_via: 'Genki Mart WooCommerce Store API',
    search_url: `https://genkimart.com.au/?s=${encodeURIComponent(query)}&post_type=product`,
  };
}

// ─── Target Direct Constructor.io API ──────────────────────────────────────

async function searchTarget(query) {
  const url = `https://ac.cnstrc.com/search/${encodeURIComponent(query)}?key=key_kWcXakjuyHSxpu75&num_results_per_page=15`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`Target API ${resp.status}`);
  const data = await resp.json();

  const rawItems = data?.response?.results || [];
  const items = rawItems.slice(0, 15).map(r => {
    const d = r.data || {};
    const price = d.price != null ? parseFloat(d.price) : null;
    const salePrice = d.sale_price != null ? parseFloat(d.sale_price) : null;
    const isClearance = !!(d.clearance);
    const finalPrice = salePrice ?? price;
    const isOnSpecial = (salePrice !== null && salePrice < price) || isClearance;
    return {
      name: r.value || '',
      price: finalPrice,
      was_price: isOnSpecial && price !== finalPrice ? price : null,
      price_str: finalPrice != null ? `$${finalPrice.toFixed(2)}` : null,
      on_special: isOnSpecial,
      in_stock: d.instock !== false && d.availableonlineqty !== 0,
      url: d.url || `https://www.target.com.au/search?q=${encodeURIComponent(query)}`,
    };
  }).filter(i => i.price !== null);

  if (items.length === 0) throw new Error(`No Target results for: ${query}`);

  return {
    store: 'Target',
    query,
    items,
    total: data?.response?.total_num_results || items.length,
    fetched_via: 'Target Constructor.io API',
    search_url: `https://www.target.com.au/search?q=${encodeURIComponent(query)}`,
  };
}

// ─── IKEA Direct API ──────────────────────────────────────────────────────

async function searchIKEA(query) {
  const url = `https://sik.search.blue.cdtapps.com/au/en/search-result-page?q=${encodeURIComponent(query)}&size=10&c=listaf`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`IKEA API ${resp.status}`);
  const data = await resp.json();

  const rawItems = data?.searchResultPage?.products?.main?.items || [];
  const items = rawItems.slice(0, 15).map(it => {
    const p = it.product || {};
    const sp = p.salesPrice || {};
    const price = sp.numeral || null;
    const wholeNum = sp.current?.wholeNumber || '';
    const decimals = sp.current?.decimals || '00';
    const priceStr = price ? `$${wholeNum}${decimals ? '.' + decimals : ''}` : null;
    const discount = sp.discount || '';
    const isOnSale = !!(discount && discount !== '');
    const prodId = String(p.itemNo || '');
    const pipUrl = p.pipUrl || `https://www.ikea.com/au/en/search/?q=${encodeURIComponent(query)}`;
    return {
      name: [p.name, p.typeName].filter(Boolean).join(' — '),
      description: p.itemMeasureReferenceText || '',
      price: price,
      price_str: priceStr,
      was_price: isOnSale ? null : null,
      on_sale: isOnSale,
      discount_label: discount || '',
      url: pipUrl,
    };
  }).filter(i => i.price !== null);

  if (items.length === 0) throw new Error(`No IKEA results for: ${query}`);

  return {
    store: 'IKEA',
    query,
    items,
    total: items.length,
    fetched_via: 'IKEA SIK API',
    search_url: `https://www.ikea.com/au/en/search/?q=${encodeURIComponent(query)}`,
  };
}

// ─── Asian / Ethnic Supermarket Search (Lasoo + general web) ─────────────────

async function searchAsianSupermarket(storeName, query, tavilyKey) {
  // Search 1: Lasoo catalogue aggregator (covers big Asian chains like Hanaromart)
  const lasooQuery = `"${query}" site:lasoo.com.au OR site:tiendeo.com.au`;
  // Search 2: General web search covering Chinese/Korean/Japanese stores in Australia
  const generalQuery = `"${query}" "${storeName}" Australia price buy grocery`;

  // Run both Tavily searches in parallel
  const [lasooResp, generalResp] = await Promise.allSettled([
    fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavilyKey, query: lasooQuery, max_results: 4, search_depth: 'basic' }),
      signal: AbortSignal.timeout(12000),
    }),
    fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavilyKey, query: generalQuery, max_results: 5, search_depth: 'basic' }),
      signal: AbortSignal.timeout(12000),
    }),
  ]);

  const allPages = [];

  if (lasooResp.status === 'fulfilled' && lasooResp.value.ok) {
    const d = await lasooResp.value.json();
    for (const r of (d.results || []).slice(0, 2)) {
      if ((r.content || '').length > 50)
        allPages.push({ title: r.title, url: r.url, snippet: r.content.substring(0, 500), source: 'Lasoo/Tiendeo catalogue' });
    }
  }
  if (generalResp.status === 'fulfilled' && generalResp.value.ok) {
    const d = await generalResp.value.json();
    for (const r of (d.results || []).slice(0, 3)) {
      if ((r.content || '').length > 50)
        allPages.push({ title: r.title, url: r.url, snippet: r.content.substring(0, 500), source: 'Web' });
    }
  }

  if (allPages.length === 0) throw new Error(`No results for ${storeName}: ${query}`);

  return {
    store: storeName,
    query,
    search_results: allPages.slice(0, 4),
    fetched_via: 'Lasoo + Web Search',
    note: `Asian supermarket prices vary by store and location. Check Lasoo.com.au or the store’s WeChat/Facebook for the latest specials.`,
    search_url: `https://www.lasoo.com.au/search/?q=${encodeURIComponent(query)}`,
  };
}
// ─── Tavily site-scoped search ───────────────────────────────────────────────

// Tavily fallback config — only for stores without direct API support
const STORE_SEARCH_CONFIG = {
  kmart: {
    displayName: 'Kmart',
    query: (q) => `${q} product price site:kmart.com.au`,
    url: (q) => `https://www.kmart.com.au/search/?q=${encodeURIComponent(q)}`,
  },
  iga: {
    displayName: 'IGA',
    query: (q) => `${q} price site:iga.com.au`,
    url: (q) => `https://www.iga.com.au/search/?q=${encodeURIComponent(q)}`,
  },
};

// Domain map for generic store search (IKEA and Daiso handled separately via direct API)
const GENERIC_STORE_DOMAINS = {
  'hanaromart': 'hanaromartonline.com', 'hanaro mart': 'hanaromartonline.com', 'hanaro': 'hanaromartonline.com',
  'jbhifi': 'jbhifi.com.au', 'jb hi-fi': 'jbhifi.com.au', 'jb hifi': 'jbhifi.com.au',
  'bunnings': 'bunnings.com.au',
  'dan murphys': 'danmurphys.com.au', "dan murphy's": 'danmurphys.com.au',
  'officeworks': 'officeworks.com.au',
  'harvey norman': 'harveynorman.com.au',
  'myer': 'myer.com.au',
  'david jones': 'davidjones.com',
  'catch': 'catch.com.au',
  'amazon': 'amazon.com.au',
  'ebay': 'ebay.com.au',
  'costco': 'costco.com.au',
  'terry white': 'terrywhitechemmart.com.au',
  'chemplus': 'chemplus.com.au',
  'my chemist': 'mychemist.com.au',
};

// Ethnic/Asian supermarket keywords — no fixed domain, use general web search
const ETHNIC_MARKET_KEYWORDS = /asian|chinese|korean|japanese|vietnamese|indian|thai|taiwanese|t&t|h-mart|hmart|african|middle.?east|halal\s*(super|market|grocery)/i;

async function searchGenericStoreTavily(storeName, query, tavilyKey) {
  const storeNameLower = storeName.toLowerCase().trim();
  const domain = GENERIC_STORE_DOMAINS[storeNameLower];
  const isEthnicMarket = ETHNIC_MARKET_KEYWORDS.test(storeNameLower);

  // Build search query depending on whether we have a known domain
  let searchQuery;
  let searchUrl;
  if (domain) {
    searchQuery = `${query} price site:${domain}`;
    searchUrl = `https://www.${domain}/search?q=${encodeURIComponent(query)}`;
  } else if (isEthnicMarket) {
    // No fixed website — do a general web search for the product at this type of store
    searchQuery = `"${query}" buy "${storeName}" Australia price grocery`;
    searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' ' + storeName + ' Australia')}`;
  } else {
    // Unknown store: guess domain and search
    const guessedDomain = `${storeNameLower.replace(/[^a-z0-9]/g, '')}.com.au`;
    searchQuery = `${query} price site:${guessedDomain}`;
    searchUrl = `https://www.${guessedDomain}/search?q=${encodeURIComponent(query)}`;
  }

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: searchQuery,
      max_results: 5,
      search_depth: 'basic',
      include_raw_content: false,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`Tavily ${resp.status}`);
  const data = await resp.json();

  let pages = (data.results || [])
    .map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.content || '').substring(0, 500),
    }))
    .filter(r => r.snippet.length > 50)
    .slice(0, 3);

  // If domain-specific search returned nothing, fall back to general search
  if (pages.length === 0 && domain) {
    const fallbackResp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${query} buy ${storeName} Australia price`,
        max_results: 5,
        search_depth: 'basic',
        include_raw_content: false,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();
      pages = (fallbackData.results || [])
        .map(r => ({ title: r.title || '', url: r.url || '', snippet: (r.content || '').substring(0, 500) }))
        .filter(r => r.snippet.length > 50)
        .slice(0, 3);
    }
  }

  if (pages.length === 0) throw new Error(`No results found for ${storeName}: ${query}`);

  return {
    store: storeName,
    query,
    search_results: pages,
    search_url: searchUrl,
    fetched_via: 'Tavily (Web Search)',
    note: isEthnicMarket
      ? `General web search results for ${storeName} — prices may vary by location`
      : domain
        ? `Web search results from ${domain}`
        : `Web search results for ${storeName}`,
  };
}

async function searchViaTavily(storeKey, query, tavilyKey) {
  const cfg = STORE_SEARCH_CONFIG[storeKey];
  if (!cfg) throw new Error(`Unknown store: ${storeKey}`);

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: cfg.query(query),
      max_results: 5,
      search_depth: 'basic',
      include_raw_content: false,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`Tavily ${resp.status}`);
  const data = await resp.json();

  const pages = (data.results || [])
    .map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.content || '').substring(0, 500),
    }))
    .filter(r => r.snippet.length > 50)
    .slice(0, 3);

  if (pages.length === 0) throw new Error(`No results for ${cfg.displayName}: ${query}`);

  return {
    store: cfg.displayName,
    query,
    search_results: pages,
    search_url: cfg.url(query),
    fetched_via: 'Tavily',
  };
}

// ─── Jina Reader fallback ────────────────────────────────────────────────────

async function searchViaJina(storeKey, query, jinaKey) {
  const cfg = STORE_SEARCH_CONFIG[storeKey];
  if (!cfg) throw new Error(`Unknown store: ${storeKey}`);

  const targetUrl = cfg.url(query);
  const resp = await fetch('https://r.jina.ai/' + targetUrl, {
    headers: {
      Authorization: `Bearer ${jinaKey}`,
      Accept: 'application/json',
      'X-Return-Format': 'markdown',
      'X-Remove-Selector': 'nav,footer,header,.cookie-banner',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`Jina ${resp.status}`);
  const data = await resp.json();
  const content = data?.data?.content || data?.content || '';
  if (content.length < 100) throw new Error('Empty response');

  return {
    store: cfg.displayName,
    query,
    search_results: [{ title: `${cfg.displayName} search: ${query}`, url: targetUrl, snippet: content.substring(0, 1500) }],
    fetched_via: 'Jina Reader',
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function searchSupermarketProduct(args, env) {
  const rawStore = (args.store || 'woolworths').toLowerCase();
  const query = (args.query || '').trim();

  if (!query) {
    return { error: 'Missing required parameter: query (product name to search for)' };
  }

  const storeAliases = {
    'chemist': 'chemistwarehouse', 'cw': 'chemistwarehouse', 'chemist warehouse': 'chemistwarehouse',
    'big w': 'bigw', 'big_w': 'bigw',
    'wws': 'woolworths', 'woolies': 'woolworths',
    'genki': 'genkimart', 'genki mart': 'genkimart',
    'hanaro': 'hanaromart', 'hanaro mart': 'hanaromart', 'hanaromartonline': 'hanaromart',
  };
  const store = storeAliases[rawStore] || rawStore;

  const tavilyKey = env?.TAVILY_API_KEY;
  const jinaKey = env?.JINA_API_KEY;

  const SUPERMARKETS = ['woolworths', 'coles', 'aldi'];
  const PHARMACY = ['chemistwarehouse', 'priceline'];
  const RETAIL = ['bigw', 'kmart'];
  const ALL = [...SUPERMARKETS, ...PHARMACY, ...RETAIL];

  let storesToSearch;
  if (store === 'all')             storesToSearch = [...SUPERMARKETS];
  else if (store === 'supermarkets') storesToSearch = [...SUPERMARKETS];
  else if (store === 'pharmacy')   storesToSearch = [...PHARMACY];
  else if (store === 'retail')     storesToSearch = [...RETAIL];
  else if (store === 'everything') storesToSearch = [...ALL];
  else                             storesToSearch = [store];

  const result = {
    query,
    query_time: new Date().toISOString(),
    results: {},
    errors: [],
  };

  for (const s of storesToSearch) {
    try {
      if (s === 'woolworths') {
        result.results[s] = await searchWoolworths(query);
      } else if (s === 'aldi') {
        result.results[s] = await searchAldi(query);
      } else if (s === 'bigw') {
        result.results[s] = await searchBigW(query);
      } else if (s === 'chemistwarehouse') {
        result.results[s] = await searchChemistWarehouse(query);
      } else if (s === 'priceline') {
        result.results[s] = await searchPriceline(query);
      } else if (s === 'ikea') {
        result.results[s] = await searchIKEA(query);
      } else if (s === 'daiso') {
        result.results[s] = await searchDaiso(query);
      } else if (s === 'target') {
        result.results[s] = await searchTarget(query);
      } else if (s === 'genkimart') {
        result.results[s] = await searchGenkiMart(query);
      } else if (ETHNIC_MARKET_KEYWORDS.test(s)) {
        if (tavilyKey) {
          result.results[s] = await searchAsianSupermarket(s, query, tavilyKey);
        } else {
          result.errors.push(`${s}: no Tavily key available`);
        }
      } else if (s === 'coles') {
        if (env?.BROWSER) {
          result.results[s] = await searchColesBrowser(query, env);
        } else if (tavilyKey) {
          result.results[s] = await searchViaTavily('coles', query, tavilyKey);
        } else {
          result.errors.push('Coles: no browser or Tavily key available');
        }
      } else if (STORE_SEARCH_CONFIG[s]) {
        // Kmart, IGA — bot-blocked, use Tavily
        if (tavilyKey) {
          result.results[s] = await searchViaTavily(s, query, tavilyKey);
        } else if (jinaKey) {
          result.results[s] = await searchViaJina(s, query, jinaKey);
        } else {
          result.errors.push(`${s}: no Tavily or Jina key available`);
        }
      } else {
        // Unknown store — try generic Tavily web search
        if (tavilyKey) {
          result.results[s] = await searchGenericStoreTavily(s, query, tavilyKey);
        } else {
          result.errors.push(`Unknown store: ${s}. Search directly at the store website.`);
        }
      }
    } catch (e) {
      result.errors.push(`${s}: ${e.message}`);
    }
  }

  const hasResults = Object.values(result.results).some(r => r.items?.length > 0 || r.search_results?.length > 0);
  if (!hasResults && result.errors.length > 0) {
    result.message = `Could not retrieve results. Search directly at the store website.`;
  }

  return result;
}
