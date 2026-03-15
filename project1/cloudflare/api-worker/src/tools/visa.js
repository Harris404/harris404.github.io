/**
 * Visa Processing Times Tool — 澳洲签证审理进度查询
 *
 * 通过 Tavily 搜索内政部 (homeaffairs.gov.au) 获取最新签证处理时间
 * 配合内置热门签证基础信息，为华人留学生/移民提供签证进度参考
 */

import { tavilySearch } from './web-search.js';
import { ToolCache, CACHE_TTL } from '../cache.js';

// 华人最关注的签证类型 — 内置基础数据
const VISA_INFO = {
    '500': {
        name: 'Student Visa',
        name_zh: '学生签证',
        subclass: '500',
        typical_processing: '1-4 weeks (75%), up to 2-3 months (90%)',
        key_requirements: ['CoE from CRICOS provider', 'GTE statement', 'Financial capacity', 'OSHC', 'English proficiency'],
        work_rights: '48 hours per fortnight during study, unlimited during breaks',
        cost: '$710',
        tip_zh: '提前准备 GTE 声明是关键，避免因材料不足被拒',
    },
    '485': {
        name: 'Temporary Graduate Visa',
        name_zh: '毕业生临时签证',
        subclass: '485',
        typical_processing: '3-8 months (varies by stream)',
        streams: ['Graduate Work Stream (18 months)', 'Post-Study Work Stream (2-6 years based on qualification)'],
        key_requirements: ['Completed eligible course', 'Applied within 6 months of completion', 'English requirement', 'Under 50 years'],
        cost: '$1,895',
        tip_zh: '毕业后6个月内必须递交，越早越好',
    },
    '189': {
        name: 'Skilled Independent Visa',
        name_zh: '独立技术移民签证',
        subclass: '189',
        typical_processing: '6-18 months (varies significantly)',
        key_requirements: ['Invited to apply (points-based)', 'Skills assessment', 'Minimum 65 points', 'Under 45 years', 'Competent English'],
        cost: '$4,640',
        tip_zh: '189 邀请分数在 65-90+ 不等，热门职业分数线较高',
    },
    '190': {
        name: 'Skilled Nominated Visa',
        name_zh: '州担保技术移民签证',
        subclass: '190',
        typical_processing: '6-15 months',
        key_requirements: ['State/territory nomination', 'Invited to apply', 'Skills assessment', 'Minimum 65 points (including 5 points for nomination)'],
        cost: '$4,640',
        tip_zh: '各州担保条件不同，偏远地区更容易获邀',
    },
    '491': {
        name: 'Skilled Work Regional (Provisional)',
        name_zh: '偏远地区技术签证（临时）',
        subclass: '491',
        typical_processing: '6-18 months',
        key_requirements: ['State nomination or family sponsorship in regional area', '65 points (incl. 15 for nomination)', 'Live and work in regional area'],
        cost: '$4,640',
        tip_zh: '偏远地区 3 年后可转 191 永居',
    },
    '600': {
        name: 'Visitor Visa',
        name_zh: '访客/旅游签证',
        subclass: '600',
        typical_processing: '1-4 weeks (tourist stream)',
        streams: ['Tourist', 'Sponsored Family', 'Business Visitor', 'Frequent Traveller'],
        cost: '$190-1,135 (varies by stream)',
        tip_zh: '父母来探亲建议申请 Sponsored Family stream，停留时间更长',
    },
    '820/801': {
        name: 'Partner Visa (Onshore)',
        name_zh: '配偶签证（境内）',
        subclass: '820/801',
        typical_processing: '20-30 months for 820 (temp), then 801 (perm)',
        cost: '$8,850',
        tip_zh: '审理时间很长，关系真实性证据越充分越好',
    },
    '309/100': {
        name: 'Partner Visa (Offshore)',
        name_zh: '配偶签证（境外）',
        subclass: '309/100',
        typical_processing: '18-28 months for 309 (temp), then 100 (perm)',
        cost: '$8,850',
        tip_zh: '需要在境外等待审批',
    },
    '143': {
        name: 'Contributory Parent Visa',
        name_zh: '付费类父母移民签证',
        subclass: '143',
        typical_processing: '12+ years queue (non-contributory 103), 5-7 years (143 contributory)',
        cost: '$4,990 + $43,600 second instalment per parent',
        tip_zh: '排队极长，建议先办 600 或 870 父母临时签',
    },
    '870': {
        name: 'Sponsored Parent (Temporary)',
        name_zh: '担保类临时父母签证',
        subclass: '870',
        typical_processing: '6-12 months',
        cost: '$5,285 (3 years) or $10,570 (5 years)',
        tip_zh: '适合等待永居签证期间的临时方案',
    },
};

/**
 * Visa tool handler
 * @param {Object} args - { subclass?: "500", query?: "student visa processing time" }
 * @param {Object} env
 */
export async function searchVisa(args, env) {
    const subclass = args.subclass || '';
    const query = args.query || '';

    // If specific subclass requested
    if (subclass) {
        return await getVisaInfo(subclass, env);
    }

    // If general query
    if (query) {
        return await searchVisaInfo(query, env);
    }

    // No input — return overview of popular visas
    return {
        message: 'Popular visa types for Chinese nationals in Australia:',
        message_zh: '华人最关注的澳洲签证类型：',
        visas: Object.entries(VISA_INFO).map(([key, v]) => ({
            subclass: v.subclass,
            name: v.name,
            name_zh: v.name_zh,
            typical_processing: v.typical_processing,
            cost: v.cost,
        })),
        official_link: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times',
        source: 'built-in reference data (verify on official website for latest)',
    };
}

async function getVisaInfo(subclass, env) {
    const info = VISA_INFO[subclass] || VISA_INFO[Object.keys(VISA_INFO).find(k => k.includes(subclass))];

    // Try to get latest processing time: 1) /markdown crawl, 2) Tavily
    let liveData = null;

    // 1. Cloudflare /markdown — 直接抓取签证处理时间页面
    try {
      const { crawlPage } = await import('./cf-crawl.js');
      const visaUrl = `https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times#`;
      const page = await crawlPage(visaUrl, env, { maxLength: 2000 });
      if (page && !page.error && page.content) {
        liveData = {
          ai_summary: null,
          sources: [{
            title: 'Visa Processing Times - Home Affairs',
            url: visaUrl,
            snippet: page.content.substring(0, 500),
            source: 'Home Affairs 官网 (Cloudflare Browser Rendering)',
          }],
        };
      }
    } catch {}

    // 2. Tavily 搜索 fallback
    const tavilyKey = env?.TAVILY_API_KEY;
    if (!liveData && tavilyKey) {
        const cache = new ToolCache(env);
        const cached = await cache.get('visa', `subclass:${subclass}`);
        if (cached) return cached;

        try {
            const q = `subclass ${subclass} visa processing time Australia ${new Date().getFullYear()}`;
            const data = await tavilySearch(q, tavilyKey, {
                maxResults: 5,
                depth: 'basic',
                rawContent: false,
                answer: 'basic',
                includeDomains: ['homeaffairs.gov.au', 'immi.homeaffairs.gov.au'],
            });

            liveData = {
                ai_summary: data.ai_answer || null,
                sources: (data.results || []).slice(0, 3).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet?.substring(0, 300),
                })),
            };
        } catch (err) {
            console.error('Visa Tavily search failed:', err.message);
        }
    }

    const result = {
        subclass: subclass,
        built_in_info: info || { message: `No built-in data for subclass ${subclass}` },
        live_processing_times: liveData,
        official_link: `https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times`,
        immi_account: 'https://online.immi.gov.au (Submit/track application)',
        disclaimer: '⚠️ Processing times change frequently. Always verify on homeaffairs.gov.au for the latest.',
        source: liveData ? 'Home Affairs via Tavily + built-in data' : 'built-in reference data',
    };

    // Forum enrichment: race with 1.5s timeout to avoid blocking
    try {
        const { forumEnrich } = await import('./cn-forums.js');
        const timeout = new Promise(r => setTimeout(() => r([]), 1500));
        const forumData = await Promise.race([forumEnrich(`${subclass} 签证 审理 等了多久`, 'visa', env), timeout]);
        if (forumData.length > 0) {
            result.community_experiences = forumData;
            result.community_note = '💬 以上华人论坛经验仅供参考，签证审理因个案而异。';
        }
    } catch {}

    if (tavilyKey) {
        const cache = new ToolCache(env);
        await cache.set('visa', `subclass:${subclass}`, [], result, CACHE_TTL.WEB_SEARCH);
    }

    return result;
}

async function searchVisaInfo(query, env) {
    const tavilyKey = env?.TAVILY_API_KEY;

    // Try to match a known subclass from the query
    const matchedSubclass = Object.keys(VISA_INFO).find(k => query.includes(k));
    if (matchedSubclass) {
        return await getVisaInfo(matchedSubclass, env);
    }

    // General search
    if (!tavilyKey) {
        return {
            query,
            message: 'Tavily API key required for general visa search. Try specifying a subclass number.',
            known_visas: Object.keys(VISA_INFO),
        };
    }

    const cache = new ToolCache(env);
    const cached = await cache.get('visa', `query:${query}`);
    if (cached) return cached;

    try {
        const data = await tavilySearch(`${query} Australia visa`, tavilyKey, {
            maxResults: 6,
            depth: 'basic',
            rawContent: false,
            answer: 'basic',
            includeDomains: ['homeaffairs.gov.au', 'immi.homeaffairs.gov.au'],
        });

        const result = {
            query,
            ai_summary: data.ai_answer || null,
            results: (data.results || []).slice(0, 5).map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet?.substring(0, 400),
            })),
            official_link: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing',
            source: 'Home Affairs via Tavily',
        };

        await cache.set('visa', `query:${query}`, [], result, CACHE_TTL.WEB_SEARCH);
        return result;
    } catch (err) {
        return { query, error: err.message };
    }
}
