/**
 * Vehicle Tool — 车辆注册查询 + 二手车估价
 *
 * Rego Check: 通过 Tavily 搜索各州交通局网站获取注册信息
 * Car Valuation: 通过 Tavily 搜索 Redbook/CarsGuide 获取二手车估价
 *
 * 模式:
 *   mode="rego"       → 车辆注册状态查询
 *   mode="valuation"  → 二手车市场价估算
 */

import { tavilySearch } from './web-search.js';
import { ToolCache, CACHE_TTL } from '../cache.js';

// 各州 Rego Check 官方链接
const REGO_CHECK_LINKS = {
    NSW: { name: 'Service NSW', url: 'https://www.service.nsw.gov.au/transaction/check-vehicle-registration' },
    VIC: { name: 'VicRoads', url: 'https://www.vicroads.vic.gov.au/registration/registration-fees/check-registration-status' },
    QLD: { name: 'TMR Queensland', url: 'https://www.service.transport.qld.gov.au/checkrego/application/VehicleSearch.xhtml' },
    SA: { name: 'SA.GOV.AU', url: 'https://www.sa.gov.au/topics/driving-and-transport/registration/registering-a-vehicle-in-sa' },
    WA: { name: 'DOT WA', url: 'https://www.transport.wa.gov.au/licensing/check-a-vehicle-licence.asp' },
    TAS: { name: 'Service Tasmania', url: 'https://www.transport.tas.gov.au/registration' },
    NT: { name: 'MVREGA NT', url: 'https://nt.gov.au/driving/rego' },
    ACT: { name: 'Access Canberra', url: 'https://www.accesscanberra.act.gov.au' },
};

// 常见二手车价格参考 (AUD, 2025-26 估算, 私人出售)
const POPULAR_CARS = {
    'toyota corolla': { year_range: '2015-2020', price_range: '$12,000 - $22,000', demand: 'very high', tips: '最保值的车型之一，留学生首选' },
    'toyota camry': { year_range: '2015-2020', price_range: '$15,000 - $28,000', demand: 'very high', tips: '大空间，适合家庭' },
    'mazda 3': { year_range: '2015-2020', price_range: '$13,000 - $24,000', demand: 'high', tips: '操控好，颜值高' },
    'honda civic': { year_range: '2015-2020', price_range: '$14,000 - $25,000', demand: 'high', tips: '省油耐用' },
    'hyundai i30': { year_range: '2015-2020', price_range: '$10,000 - $20,000', demand: 'high', tips: '性价比之王' },
    'kia cerato': { year_range: '2015-2020', price_range: '$10,000 - $19,000', demand: 'medium', tips: '配置高，保修长' },
    'toyota rav4': { year_range: '2015-2020', price_range: '$22,000 - $38,000', demand: 'very high', tips: 'SUV 最保值' },
    'mazda cx-5': { year_range: '2015-2020', price_range: '$18,000 - $32,000', demand: 'high', tips: 'SUV 操控标杆' },
    'subaru forester': { year_range: '2015-2020', price_range: '$16,000 - $30,000', demand: 'high', tips: '全时四驱，适合户外' },
    'volkswagen golf': { year_range: '2015-2020', price_range: '$15,000 - $25,000', demand: 'medium', tips: '注意保养费用较高' },
};

// 买二手车防坑指南
const BUYING_TIPS = {
    must_check: [
        '✅ 在各州官网做免费 Rego Check（注册到期日期、是否被注销）',
        '✅ 在 PPSR (ppsr.gov.au) 做 $2 的车辆历史查询（是否有欠贷、是否报废过、是否偷盗车）',
        '✅ 查看 Service History（保养记录），尤其是正时链/皮带是否更换',
        '✅ 检查 Odometer（里程表）是否与保养记录一致',
        '✅ 试驾时注意变速箱是否顿挫、方向盘是否跑偏',
    ],
    red_flags: [
        '🚩 卖家拒绝让你独立检查（Pre-purchase inspection ~$150-250）',
        '🚩 价格明显低于市场价（可能有暗病或事故车）',
        '🚩 Rego 快到期（可能 RWC/Safety check 过不了）',
        '🚩 只接受现金且拒绝提供身份证明',
        '🚩 无PPSR证明或不愿意你去查',
    ],
    useful_links: {
        ppsr: 'https://www.ppsr.gov.au (车辆历史查询 $2)',
        redbook: 'https://www.redbook.com.au (估价)',
        carsales: 'https://www.carsales.com.au (最大二手车平台)',
        carsguide: 'https://www.carsguide.com.au (估价+比较)',
        facebook: 'Facebook Marketplace（常有华人直卖好价格）',
    }
};

/**
 * Vehicle tool handler
 * @param {Object} args - { mode: "rego"|"valuation", plate?: "ABC123", state?: "NSW", make?: "Toyota", model?: "Corolla", year?: 2018 }
 * @param {Object} env - Cloudflare Workers env
 */
export async function searchVehicle(args, env) {
    const mode = (args.mode || 'valuation').toLowerCase();

    if (mode === 'rego') {
        return await regoCheck(args, env);
    } else {
        return await carValuation(args, env);
    }
}

async function regoCheck(args, env) {
    const plate = args.plate || '';
    const state = (args.state || 'NSW').toUpperCase();

    if (!plate) {
        // 如果没给车牌号，返回各州 rego check 链接
        return {
            mode: 'rego_links',
            message: 'To check vehicle registration, visit your state\'s official website:',
            message_zh: '请前往你所在州的官方网站查询车辆注册状态：',
            links: REGO_CHECK_LINKS,
            ppsr: {
                name: 'PPSR (Personal Property Securities Register)',
                url: 'https://www.ppsr.gov.au',
                cost: '$2 per check',
                description: 'Check if the car has outstanding finance, has been written off, or is stolen',
                description_zh: '查询车辆是否有贷款未还清、是否为事故报废车、是否被盗 — 买二手车必做！',
            },
            buying_tips: BUYING_TIPS,
        };
    }

    // 有车牌号 — 1) /markdown 抓取官网, 2) Tavily 搜索
    // 1. 尝试直接抓取州政府 rego check 页面
    const stateLink = REGO_CHECK_LINKS[state] || REGO_CHECK_LINKS.NSW;
    try {
      const { crawlPage } = await import('./cf-crawl.js');
      const page = await crawlPage(stateLink.url, env, { maxLength: 2000 });
      if (page && !page.error && page.content) {
        return {
          mode: 'rego',
          plate,
          state,
          page_title: page.title || stateLink.name,
          content: page.content,
          url: stateLink.url,
          source: `${stateLink.name} 官网 (Cloudflare Browser Rendering)`,
          important: '⚠️ 请在上方官网链接中输入车牌号查询确切注册状态。',
          ppsr_reminder: '🔑 买二手车前务必花 $2 在 ppsr.gov.au 做车辆历史查询！',
        };
      }
    } catch {}

    // 2. Tavily 搜索 fallback
    const tavilyKey = env?.TAVILY_API_KEY;
    if (!tavilyKey) {
        return {
            mode: 'rego',
            plate,
            state,
            message: `Please check registration for plate ${plate} (${state}) directly:`,
            link: stateLink,
            ppsr: 'https://www.ppsr.gov.au',
        };
    }

    const cache = new ToolCache(env);
    const cacheKey = `rego:${plate}:${state}`;
    const cached = await cache.get('vehicle', cacheKey);
    if (cached) return cached;

    try {
        const query = `check vehicle registration ${plate} ${state} Australia`;
        const data = await tavilySearch(query, tavilyKey, {
            maxResults: 5,
            depth: 'basic',
            rawContent: false,
            answer: 'basic',
            includeDomains: ['nsw.gov.au', 'vicroads.vic.gov.au', 'service.transport.qld.gov.au', 'transport.wa.gov.au'],
        });

        const result = {
            mode: 'rego',
            plate,
            state,
            search_results: (data.results || []).slice(0, 3).map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
            })),
            ai_summary: data.ai_answer || null,
            manual_check: REGO_CHECK_LINKS[state] || REGO_CHECK_LINKS.NSW,
            important: '⚠️ For definitive registration status, always verify on the official government website above.',
            ppsr_reminder: '🔑 Also do a $2 PPSR check at ppsr.gov.au before buying any used car!',
        };

        await cache.set('vehicle', cacheKey, [], result, CACHE_TTL.WEB_SEARCH);
        return result;
    } catch (err) {
        return {
            mode: 'rego',
            plate,
            state,
            error: err.message,
            manual_check: REGO_CHECK_LINKS[state] || REGO_CHECK_LINKS.NSW,
        };
    }
}

async function carValuation(args, env) {
    const make = args.make || '';
    const model = args.model || '';
    const year = args.year || '';

    if (!make && !model) {
        return {
            mode: 'valuation',
            error: 'Please provide a car make and model (e.g., make: "Toyota", model: "Corolla")',
            popular_cars: Object.entries(POPULAR_CARS).map(([name, info]) => ({
                name, ...info
            })),
            buying_tips: BUYING_TIPS,
        };
    }

    const searchKey = `${make} ${model}`.toLowerCase().trim();

    // Check built-in data first
    const builtIn = Object.entries(POPULAR_CARS).find(([k]) =>
        searchKey.includes(k) || k.includes(searchKey)
    );

    // 1. /markdown 抓取 CarsGuide 估价页
    let tavilyResult = null;
    try {
      const { crawlPage } = await import('./cf-crawl.js');
      const cgUrl = `https://www.carsguide.com.au/car-valuations/${make.toLowerCase()}-${model.toLowerCase().replace(/\s/g,'-')}${year ? `-${year}` : ''}`;
      const page = await crawlPage(cgUrl, env, { maxLength: 2000 });
      if (page && !page.error && page.content) {
        tavilyResult = {
          ai_valuation: null,
          sources: [{ title: page.title || `${make} ${model} Valuation`, url: cgUrl, snippet: page.content.substring(0, 400), source: 'CarsGuide (Browser Rendering)' }],
        };
      }
    } catch {}

    // 2. Tavily fallback
    const tavilyKey = env?.TAVILY_API_KEY;
    if (!tavilyResult && tavilyKey) {
        const cache = new ToolCache(env);
        const cacheKey = `valuation:${searchKey}:${year}`;
        const cached = await cache.get('vehicle', cacheKey);
        if (cached) return cached;

        try {
            const query = `${year} ${make} ${model} used car price Australia market value`.trim();
            const data = await tavilySearch(query, tavilyKey, {
                maxResults: 6,
                depth: 'basic',
                rawContent: false,
                answer: 'basic',
                includeDomains: ['redbook.com.au', 'carsguide.com.au', 'carsales.com.au'],
            });

            tavilyResult = {
                ai_valuation: data.ai_answer || null,
                sources: (data.results || []).slice(0, 4).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet?.substring(0, 300),
                })),
            };
        } catch (err) {
            console.error('Vehicle Tavily search failed:', err.message);
        }
    }

    const result = {
        mode: 'valuation',
        query: { make, model, year: year || 'any' },
        built_in_estimate: builtIn ? { name: builtIn[0], ...builtIn[1] } : null,
        live_search: tavilyResult,
        buying_tips: BUYING_TIPS,
        source: tavilyResult ? 'Redbook/CarsGuide/Carsales via Tavily + built-in data' : 'built-in estimates',
    };

    if (tavilyKey) {
        const cache = new ToolCache(env);
        await cache.set('vehicle', `valuation:${searchKey}:${year}`, [], result, CACHE_TTL.WEB_SEARCH);
    }

    return result;
}
