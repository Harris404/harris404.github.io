/**
 * Events Tool — 澳洲同城活动/周末娱乐搜索
 *
 * 通过 Tavily 站内搜索主流活动平台获取同城活动信息
 * 覆盖 Eventbrite、TimeOut、What's On 等活动源
 */

import { tavilySearch } from './web-search.js';
import { ToolCache, CACHE_TTL } from '../cache.js';

// 主要城市活动信息平台
const EVENT_SOURCES = {
    sydney: {
        whats_on: 'https://whatson.cityofsydney.nsw.gov.au',
        timeout: 'https://www.timeout.com/sydney',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--sydney/events/',
        city_of_sydney: 'https://www.cityofsydney.nsw.gov.au/things-to-do',
    },
    melbourne: {
        whats_on: 'https://whatson.melbourne.vic.gov.au',
        timeout: 'https://www.timeout.com/melbourne',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--melbourne/events/',
        city_of_melbourne: 'https://www.melbourne.vic.gov.au/community/events-ede/pages/events.aspx',
    },
    brisbane: {
        whats_on: 'https://www.visitbrisbane.com.au/whats-on',
        timeout: 'https://www.timeout.com/brisbane',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--brisbane/events/',
    },
    perth: {
        whats_on: 'https://www.experienceperth.com/events',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--perth/events/',
    },
    adelaide: {
        whats_on: 'https://www.cityofadelaide.com.au/explore-the-city/whats-on',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--adelaide/events/',
    },
    canberra: {
        whats_on: 'https://visitcanberra.com.au/events',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--canberra/events/',
    },
    goldcoast: {
        whats_on: 'https://www.destinationgoldcoast.com/things-to-do/events',
        eventbrite: 'https://www.eventbrite.com.au/d/australia--gold-coast/events/',
    },
};

// 华人特色活动类型
const POPULAR_CATEGORIES = {
    free: { zh: '免费活动', query_suffix: 'free events' },
    markets: { zh: '市集/夜市', query_suffix: 'markets weekend night market' },
    food: { zh: '美食节/美食活动', query_suffix: 'food festival foodie events' },
    music: { zh: '音乐会/演唱会', query_suffix: 'concert music live' },
    art: { zh: '展览/艺术', query_suffix: 'art exhibition gallery museum' },
    chinese: { zh: '华人社区活动', query_suffix: 'chinese community lunar new year' },
    festival: { zh: '节日/庆典', query_suffix: 'festival celebration' },
    outdoor: { zh: '户外活动', query_suffix: 'outdoor hiking beach walking' },
    family: { zh: '亲子活动', query_suffix: 'family kids children' },
    networking: { zh: '社交/交友', query_suffix: 'networking meetup social' },
};

/**
 * Events tool handler
 * @param {Object} args - { city: "Sydney", category?: "free"|"markets"|"food"|etc, query?: "custom search", when?: "this weekend"|"today"|"this week" }
 * @param {Object} env
 */
export async function searchEvents(args, env) {
    const city = (args.city || args.location || 'Sydney').toLowerCase().replace(/\s+/g, '');
    const category = (args.category || '').toLowerCase();
    const customQuery = args.query || '';
    const when = args.when || 'this weekend';

    const tavilyKey = env?.TAVILY_API_KEY;
    if (!tavilyKey) {
        // No Tavily key — return curated links
        const cityLinks = EVENT_SOURCES[city] || EVENT_SOURCES.sydney;
        return {
            city,
            message: `Browse events in ${city}:`,
            links: cityLinks,
            categories: POPULAR_CATEGORIES,
            tip_zh: '关注各城市的 What\'s On 官方网站，免费活动很多！',
        };
    }

    // Build search query
    let searchQuery;
    if (customQuery) {
        searchQuery = `${customQuery} ${city} ${when} Australia`;
    } else if (category && POPULAR_CATEGORIES[category]) {
        searchQuery = `${POPULAR_CATEGORIES[category].query_suffix} ${city} ${when} Australia`;
    } else {
        searchQuery = `things to do events ${city} ${when} Australia`;
    }

    // Check cache
    const cache = new ToolCache(env);
    const cacheKey = `events:${city}:${category || customQuery}:${when}`;
    const cached = await cache.get('events', cacheKey);
    if (cached) return cached;

    // Search across event platforms
    const domains = [
        'eventbrite.com.au',
        'timeout.com',
        'whatson.cityofsydney.nsw.gov.au',
        'whatson.melbourne.vic.gov.au',
        'visitbrisbane.com.au',
        'broadsheet.com.au',
        'concreteplayground.com',
    ];

    try {
        const data = await tavilySearch(searchQuery, tavilyKey, {
            maxResults: 10,
            depth: 'basic',
            rawContent: false,
            answer: 'basic',
            includeDomains: domains,
        });

        const events = (data.results || []).map(r => ({
            title: r.title || '',
            url: r.url || '',
            snippet: (r.snippet || '').substring(0, 400),
            source: extractSource(r.url),
        })).slice(0, 8);

        const cityLinks = EVENT_SOURCES[city] || EVENT_SOURCES.sydney;

        const result = {
            city: city.charAt(0).toUpperCase() + city.slice(1),
            category: category || 'all',
            when,
            ai_summary: data.ai_answer || null,
            events_count: events.length,
            events,
            browse_more: cityLinks,
            categories: POPULAR_CATEGORIES,
            source: 'Eventbrite/TimeOut/What\'s On via Tavily',
            tip_zh: '很多活动需要提前注册或购票。Eventbrite 上有大量免费活动！',
        };

        await cache.set('events', cacheKey, domains, result, 3600); // 1 hour cache (events are time-sensitive)
        return result;
    } catch (err) {
        return {
            city,
            error: err.message,
            browse_more: EVENT_SOURCES[city] || EVENT_SOURCES.sydney,
        };
    }
}

function extractSource(url) {
    if (!url) return 'Unknown';
    if (url.includes('eventbrite')) return 'Eventbrite';
    if (url.includes('timeout')) return 'TimeOut';
    if (url.includes('whatson')) return "What's On";
    if (url.includes('broadsheet')) return 'Broadsheet';
    if (url.includes('concreteplayground')) return 'Concrete Playground';
    try { return new URL(url).hostname.replace('www.', ''); } catch { return 'Web'; }
}
