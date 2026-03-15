#!/usr/bin/env node
/**
 * RAG Data Scraper — Using Cloudflare Browser Rendering /markdown API
 * 
 * Uses the /markdown endpoint to render pages with JS and extract clean markdown.
 * Falls back to simple HTML fetch when CF API is not available.
 * 
 * Usage:
 *   node scripts/crawl-rag-data.mjs                        # crawl all topics
 *   node scripts/crawl-rag-data.mjs --topic mental          # filter by topic
 *   node scripts/crawl-rag-data.mjs --topic education       # crawl education
 *   node scripts/crawl-rag-data.mjs --force                 # re-crawl existing
 *   node scripts/crawl-rag-data.mjs --dry-run               # preview only
 * 
 * Requires env vars:
 *   CF_ACCOUNT_ID   — Cloudflare Account ID
 *   CF_API_TOKEN    — API Token with Browser Rendering permissions
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname, '..');
const RAG_DIR = join(BASE_DIR, 'data', 'rag-sources');

// ── Config ─────────────────────────────────────────────────────
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_BR_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const REQUEST_DELAY = 1000;
const MIN_CONTENT_LENGTH = 300;

// ── URL Registry ───────────────────────────────────────────────

const TOPICS = [
  // ═══════════════════════════════════════════════════════════════
  //  MENTAL HEALTH — government/mental-health (Healthcare Agent)
  // ═══════════════════════════════════════════════════════════════
  ['mental-health', 'government/mental-health', 'Mental Health & Crisis Support', [
    // Beyond Blue
    'https://www.beyondblue.org.au/mental-health/anxiety',
    'https://www.beyondblue.org.au/mental-health/depression',
    'https://www.beyondblue.org.au/get-support',
    'https://www.beyondblue.org.au/mental-health/stress',
    'https://www.beyondblue.org.au/mental-health/suicide-prevention',
    // Headspace (youth mental health)
    'https://headspace.org.au/explore-topics/for-young-people/depression/',
    'https://headspace.org.au/explore-topics/for-young-people/anxiety/',
    'https://headspace.org.au/explore-topics/for-young-people/stress/',
    'https://headspace.org.au/explore-topics/for-young-people/understanding-and-dealing-with-bullying/',
    'https://headspace.org.au/services/headspace-centres/',
    // Lifeline
    'https://www.lifeline.org.au/get-help/',
    'https://www.lifeline.org.au/crisis-text/',
    // HealthDirect
    'https://www.healthdirect.gov.au/mental-health',
    'https://www.healthdirect.gov.au/mental-health-helplines',
    'https://www.healthdirect.gov.au/depression',
    'https://www.healthdirect.gov.au/anxiety',
    'https://www.healthdirect.gov.au/stress',
    'https://www.healthdirect.gov.au/mental-health-treatment-plan',
    'https://www.healthdirect.gov.au/grief',
    'https://www.healthdirect.gov.au/loneliness',
    // Medicare mental health plan
    'https://www.servicesaustralia.gov.au/mental-health-care-and-medicare',
    // International student wellbeing
    'https://www.studyaustralia.gov.au/en/life-in-australia/health-and-wellbeing',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  EDUCATION — living/student (Education Agent)
  //  All 43 Australian universities + TAFE + admissions
  // ═══════════════════════════════════════════════════════════════
  ['education', 'living/student', 'Australian Universities & Education', [
    // ── Study in Australia (official) ──
    'https://www.studyaustralia.gov.au/en/plan-your-studies/how-to-apply',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships-and-funding',
    'https://www.studyaustralia.gov.au/en/study-options/universities-and-higher-education',
    'https://www.studyaustralia.gov.au/en/study-options/vocational-education-and-training',
    'https://www.studyaustralia.gov.au/en/life-in-australia',
    'https://www.studyaustralia.gov.au/en/life-in-australia/accommodation',
    'https://www.studyaustralia.gov.au/en/life-in-australia/cost-of-living',
    'https://www.studyaustralia.gov.au/en/life-in-australia/work',
    'https://www.studyaustralia.gov.au/en/life-in-australia/safety',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/english-language-requirements',
    // ── HECS / HELP loans ──
    'https://www.studyassist.gov.au/help-loans',
    'https://www.studyassist.gov.au/help-loans/hecs-help',
    'https://www.studyassist.gov.au/help-loans/fee-help',
    // ── Group of Eight (Go8) ──
    'https://www.unsw.edu.au/study',
    'https://www.unsw.edu.au/study/international-students',
    'https://www.unsw.edu.au/study/international-students/fees',
    'https://www.unsw.edu.au/study/how-to-apply',
    'https://www.unsw.edu.au/student-life',
    'https://www.sydney.edu.au/study.html',
    'https://www.sydney.edu.au/study/how-to-apply.html',
    'https://www.sydney.edu.au/study/admissions/fees-and-costs.html',
    'https://www.sydney.edu.au/study/international-students.html',
    'https://www.sydney.edu.au/students/student-support-services.html',
    'https://study.unimelb.edu.au',
    'https://study.unimelb.edu.au/how-to-apply',
    'https://study.unimelb.edu.au/how-to-apply/international-applications',
    'https://study.unimelb.edu.au/find/fees',
    'https://www.anu.edu.au/study',
    'https://www.anu.edu.au/study/apply',
    'https://www.uq.edu.au/study',
    'https://study.uq.edu.au/study-options/find-a-program',
    'https://study.uq.edu.au/admissions/undergraduate/fees-and-costs',
    'https://www.monash.edu/study',
    'https://www.monash.edu/study/courses/find-a-course',
    'https://www.monash.edu/study/fees-scholarships',
    'https://www.monash.edu/study/how-to-apply',
    'https://www.adelaide.edu.au/study',
    'https://www.adelaide.edu.au/study/international',
    'https://www.uwa.edu.au/study',
    'https://www.uwa.edu.au/study/how-to-apply',
    'https://www.uwa.edu.au/study/international-students',
    // ── ATN (Australian Technology Network) ──
    'https://www.uts.edu.au/study',
    'https://www.uts.edu.au/study/international',
    'https://www.uts.edu.au/study/international/fees-and-scholarships',
    'https://www.rmit.edu.au/study-with-us',
    'https://www.rmit.edu.au/study-with-us/international-students',
    'https://www.rmit.edu.au/study-with-us/international-students/fees-and-scholarships',
    'https://www.curtin.edu.au/study/',
    'https://www.curtin.edu.au/study/international-students/',
    'https://www.unisa.edu.au/study/',
    'https://www.unisa.edu.au/study/international-students/',
    // ── IRU (Innovative Research Universities) ──
    'https://www.flinders.edu.au/study',
    'https://www.flinders.edu.au/international-students',
    'https://www.griffith.edu.au/study',
    'https://www.griffith.edu.au/international',
    'https://www.jcu.edu.au/study',
    'https://www.jcu.edu.au/international-students',
    'https://www.latrobe.edu.au/study',
    'https://www.latrobe.edu.au/international',
    'https://www.murdoch.edu.au/study',
    'https://www.murdoch.edu.au/study/international-students',
    'https://www.cdu.edu.au/study',
    'https://www.cdu.edu.au/international',
    // ── RUN (Regional Universities Network) ──
    'https://www.cqu.edu.au/study',
    'https://www.cqu.edu.au/international',
    'https://www.federation.edu.au/study',
    'https://www.federation.edu.au/international',
    'https://www.scu.edu.au/study-at-scu/',
    'https://www.scu.edu.au/international/',
    'https://www.une.edu.au/study',
    'https://www.une.edu.au/study/international-students',
    'https://www.usq.edu.au/study',
    'https://www.usq.edu.au/international',
    'https://www.usc.edu.au/study',
    'https://www.usc.edu.au/international',
    // ── Other universities ──
    'https://www.mq.edu.au/study',
    'https://www.mq.edu.au/study/international-students',
    'https://www.deakin.edu.au/study',
    'https://www.deakin.edu.au/courses/find-a-course',
    'https://www.deakin.edu.au/study/fees-and-scholarships',
    'https://www.westernsydney.edu.au/study',
    'https://www.westernsydney.edu.au/international',
    'https://www.swinburne.edu.au/study/',
    'https://www.swinburne.edu.au/study/international/',
    'https://www.newcastle.edu.au/study',
    'https://www.newcastle.edu.au/study/international-students',
    'https://www.uow.edu.au/study',
    'https://www.uow.edu.au/study/international',
    'https://www.acu.edu.au/study-at-acu',
    'https://www.acu.edu.au/study-at-acu/international-students',
    'https://www.canberra.edu.au/study',
    'https://www.canberra.edu.au/international-students',
    'https://www.ecu.edu.au/study',
    'https://www.ecu.edu.au/international-students',
    'https://www.vu.edu.au/study-at-vu',
    'https://www.vu.edu.au/study-at-vu/international-students',
    'https://www.utas.edu.au/study',
    'https://www.utas.edu.au/international',
    'https://www.usc.edu.au/study',
    'https://www.torrens.edu.au/studying-with-us',
    'https://www.torrens.edu.au/studying-with-us/international-students',
    'https://www.bond.edu.au/study',
    'https://www.bond.edu.au/study/international-students',
    // ── TAFE ──
    'https://www.tafensw.edu.au/courses',
    'https://www.tafensw.edu.au/international',
    'https://www.gotafe.vic.edu.au/courses',
    'https://tafeqld.edu.au/courses',
    'https://www.southmetrotafe.wa.edu.au/courses',
    // ── Admissions ──
    'https://www.uac.edu.au/future-applicants/how-to-apply',
    'https://www.vtac.edu.au/applying',
    // ── Student housing ──
    'https://flatmates.com.au/info/moving-to-australia',
    'https://www.studyaustralia.gov.au/en/life-in-australia/accommodation',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  TRAVEL — living/travel (Wellness Agent)
  //  All states, major destinations, national parks, seasonal events
  // ═══════════════════════════════════════════════════════════════
  ['travel', 'living/travel', 'Travel & Exploration Australia', [
    // ── Tourism Australia official ──
    'https://www.australia.com/en/places/sydney-and-surrounds.html',
    'https://www.australia.com/en/places/melbourne-and-surrounds.html',
    'https://www.australia.com/en/places/brisbane-and-surrounds.html',
    'https://www.australia.com/en/places/gold-coast.html',
    'https://www.australia.com/en/places/cairns-and-surrounds.html',
    'https://www.australia.com/en/places/adelaide-and-surrounds.html',
    'https://www.australia.com/en/places/perth-and-surrounds.html',
    'https://www.australia.com/en/places/hobart-and-surrounds.html',
    'https://www.australia.com/en/places/darwin-and-surrounds.html',
    'https://www.australia.com/en/places/canberra.html',
    'https://www.australia.com/en/places/great-barrier-reef.html',
    'https://www.australia.com/en/places/red-centre.html',
    'https://www.australia.com/en/things-to-do/nature-and-wildlife.html',
    'https://www.australia.com/en/things-to-do/food-and-wine.html',
    'https://www.australia.com/en/things-to-do/aquatic-and-coastal.html',
    'https://www.australia.com/en/things-to-do/adventure-and-sport.html',
    'https://www.australia.com/en/things-to-do/arts-culture-and-music.html',
    'https://www.australia.com/en/facts-and-planning/weather-in-australia.html',
    'https://www.australia.com/en/facts-and-planning/getting-around.html',
    // ── NSW Destinations ──
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/blue-mountains-national-park',
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/royal-national-park',
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/ku-ring-gai-chase-national-park',
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/sydney-harbour-national-park',
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/jervis-bay-national-park',
    'https://www.visitnsw.com/destinations/south-coast',
    'https://www.visitnsw.com/destinations/hunter',
    'https://www.visitnsw.com/destinations/blue-mountains',
    'https://www.visitnsw.com/destinations/north-coast',
    // ── VIC Destinations ──
    'https://www.visitmelbourne.com/regions/great-ocean-road',
    'https://www.visitmelbourne.com/regions/yarra-valley-and-dandenong-ranges',
    'https://www.visitmelbourne.com/regions/phillip-island',
    'https://www.visitmelbourne.com/regions/mornington-peninsula',
    'https://www.parks.vic.gov.au/places-to-see/parks/grampians-national-park',
    'https://www.parks.vic.gov.au/places-to-see/parks/great-otway-national-park',
    'https://www.parks.vic.gov.au/places-to-see/parks/wilsons-promontory-national-park',
    'https://www.visitgreatoceanroad.org.au/the-drive/',
    // ── QLD Destinations ──
    'https://www.queensland.com/au/en/places-to-see/destinations/gold-coast',
    'https://www.queensland.com/au/en/places-to-see/destinations/sunshine-coast',
    'https://www.queensland.com/au/en/places-to-see/destinations/cairns-and-great-barrier-reef',
    'https://www.queensland.com/au/en/places-to-see/destinations/whitsundays',
    'https://www.queensland.com/au/en/places-to-see/destinations/fraser-coast',
    // ── SA Destinations ──
    'https://southaustralia.com/places-to-go/barossa',
    'https://southaustralia.com/places-to-go/kangaroo-island',
    'https://southaustralia.com/places-to-go/adelaide-hills',
    'https://southaustralia.com/places-to-go/flinders-ranges',
    // ── WA Destinations ──
    'https://www.westernaustralia.com/au/attraction/rottnest-island',
    'https://www.westernaustralia.com/au/attraction/ningaloo-reef',
    'https://www.westernaustralia.com/au/attraction/margaret-river',
    'https://www.westernaustralia.com/au/destination/broome-and-the-kimberley',
    // ── TAS Destinations ──
    'https://www.discovertasmania.com.au/places-to-go/hobart-and-surrounds',
    'https://www.discovertasmania.com.au/places-to-go/cradle-mountain',
    'https://www.discovertasmania.com.au/things-to-do/nature-and-wildlife',
    // ── NT Destinations ──
    'https://northernterritory.com/uluru-and-surrounds',
    'https://northernterritory.com/kakadu-and-surrounds',
    'https://northernterritory.com/darwin-and-surrounds',
    // ── ACT ──
    'https://visitcanberra.com.au/things-to-do',
    // ── Free / budget activities ──
    'https://www.timeout.com/sydney/things-to-do/free-things-to-do-in-sydney',
    'https://www.timeout.com/melbourne/things-to-do/free-things-to-do-in-melbourne',
    'https://www.timeout.com/brisbane/things-to-do/free-things-to-do-in-brisbane',
    // ── Road trips ──
    'https://www.australia.com/en/itineraries/sydney-to-brisbane-coastal-drive.html',
    'https://www.australia.com/en/itineraries/great-ocean-road.html',
    'https://www.australia.com/en/itineraries/outback-way.html',
  ]],
];

// ── CF Browser Rendering — /crawl (primary) + /markdown (fallback) ──

const CRAWL_POLL_INTERVAL = 3000;
const CRAWL_TIMEOUT = 30000;  // 30s max — fail fast, fallback to /markdown

/**
 * Strategy: /crawl → /markdown → simple fetch
 * /crawl gives highest quality (full JS render, rich metadata)
 * /markdown is faster but slightly less capable
 */
async function fetchPageMarkdown(url) {
  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    // Try /crawl first (best quality)
    const crawlResult = await tryCrawl(url);
    if (crawlResult) return crawlResult;

    // Fallback to /markdown (faster, less robust)
    const mdResult = await tryMarkdown(url);
    if (mdResult) return mdResult;
  }

  // Final fallback: simple HTML fetch
  return await simpleFetch(url);
}

/**
 * CF /crawl API — async crawl with polling
 * Returns: { markdown, title, url } or null
 */
async function tryCrawl(url) {
  try {
    const endpoint = `${CF_BR_BASE}/${CF_ACCOUNT_ID}/browser-rendering/crawl`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, limit: 1, formats: ['markdown'] }),
    });

    if (!res.ok) {
      console.log(`  ⚠ /crawl POST returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.success || !data.result) return null;

    const jobId = data.result;
    if (typeof jobId !== 'string') return null;

    // Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < CRAWL_TIMEOUT) {
      await delay(CRAWL_POLL_INTERVAL);

      const pollRes = await fetch(
        `${CF_BR_BASE}/${CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}`,
        { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` } }
      );
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const result = pollData.result;

      if (result?.status === 'completed' && result.records?.length > 0) {
        const record = result.records[0];
        return {
          markdown: record.markdown || '',
          title: record.metadata?.title || '',
          url: record.url || url,
        };
      }
      if (result?.status === 'failed') {
        console.log(`  ⚠ /crawl job failed`);
        return null;
      }
      process.stdout.write('.');
    }
    console.log(`  ⚠ /crawl timed out`);
    return null;
  } catch (err) {
    console.log(`  ⚠ /crawl error: ${err.message}`);
    return null;
  }
}

/**
 * CF /markdown API — synchronous single-page render
 */
async function tryMarkdown(url) {
  try {
    const endpoint = `${CF_BR_BASE}/${CF_ACCOUNT_ID}/browser-rendering/markdown`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) {
        const md = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        return { markdown: md, title: '', url };
      }
    } else {
      console.log(`  ⚠ /markdown returned ${res.status}`);
    }
  } catch (err) {
    console.log(`  ⚠ /markdown error: ${err.message}`);
  }
  return null;
}

/**
 * Simple HTML fetch — last resort
 */
async function simpleFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,text/plain',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const md = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { markdown: md, title: '', url };
  } catch {
    return null;
  }
}

// ── Content Cleaning ───────────────────────────────────────────

function cleanMarkdown(content) {
  return content
    .replace(/!\[Image \d+[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[.*?\]\([^)]*\)/g, '')
    .replace(/\[Skip to (?:content|main|navigation)\]\([^)]*\)/gi, '')
    .replace(/^MENU\s*[-=]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:Home|Back|Previous|Next)\s*[>|›»]\s*.*/gm, '')
    .trim();
}

function generateFilename(url, title) {
  if (title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80)
      + '.md';
  }
  const parsed = new URL(url);
  const host = parsed.hostname.replace('www.', '').replace(/\./g, '-');
  const path = parsed.pathname.replace(/\/$/, '').replace(/^\//, '').replace(/\//g, '_');
  return `${host}_${path || 'index'}`.substring(0, 100) + '.md';
}

// ── Main Scraper ───────────────────────────────────────────────

async function scrapeTopic(topicKey, outputSubdir, displayName, urls, options = {}) {
  const outputDir = join(RAG_DIR, outputSubdir);
  mkdirSync(outputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${displayName}  (${urls.length} URLs → ${outputSubdir})`);
  console.log(`${'='.repeat(60)}`);

  let saved = 0, skipped = 0, failed = 0;

  for (const url of urls) {
    // Check if already fetched
    const existingFiles = readdirSync(outputDir);
    const host = new URL(url).hostname.replace('www.', '').replace(/\./g, '-');
    const alreadyExists = !options.force && existingFiles.some(f => f.includes(host));

    if (alreadyExists && !options.force) {
      skipped++;
      saved++;
      continue;
    }

    if (options.dryRun) {
      console.log(`  [dry-run] would fetch: ${url}`);
      continue;
    }

    console.log(`  ⏳ ${url}`);

    const result = await fetchPageMarkdown(url);
    const content = result?.markdown || '';

    if (!content || content.length < MIN_CONTENT_LENGTH) {
      console.log(`  ✗ Failed or too short (${content?.length || 0} chars)`);
      failed++;
      await delay(REQUEST_DELAY);
      continue;
    }

    const cleaned = cleanMarkdown(content);

    // Use title from crawl metadata or extract from markdown
    let title = result?.title || '';
    if (!title) {
      const titleMatch = cleaned.match(/^#\s+(.+)$/m);
      title = titleMatch ? titleMatch[1].trim() : '';
    }

    const filename = generateFilename(url, title);
    const filepath = join(outputDir, filename);

    const md = [
      `# ${title || new URL(url).pathname}`,
      '',
      `**Source**: ${url}`,
      `**Category**: ${topicKey}`,
      `**Topic**: ${displayName}`,
      `**Last fetched**: ${new Date().toISOString().split('T')[0]}`,
      '',
      '---',
      '',
      cleaned,
    ].join('\n');

    writeFileSync(filepath, md, 'utf-8');
    const size = Buffer.byteLength(md);
    saved++;
    console.log(`  ✓ ${filename} (${(size / 1024).toFixed(1)} KB)`);

    await delay(REQUEST_DELAY);
  }

  console.log(`\n  ✅ ${saved} saved (${skipped} cached), ${failed} failed`);
  return { saved, failed };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── CLI ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const topicFilter = args.find(a => a.startsWith('--topic='))?.split('=')[1]
    || (args.includes('--topic') ? args[args.indexOf('--topic') + 1] : null);

  console.log('='.repeat(60));
  console.log('  RAG Scraper — CF Browser Rendering /crawl + /markdown');
  console.log('='.repeat(60));
  console.log(`  Output: ${RAG_DIR}`);
  console.log(`  CF API: ${CF_ACCOUNT_ID ? '✓ configured' : '✗ not set (will use simple fetch fallback)'}`);
  console.log(`  Strategy: /crawl (primary) → /markdown (fallback)`);
  console.log(`  Force: ${force}  |  Dry-run: ${dryRun}`);
  if (topicFilter) console.log(`  Filter: "${topicFilter}"`);

  const totalUrls = TOPICS.reduce((n, t) => n + t[3].length, 0);
  console.log(`  Topics: ${TOPICS.length}  |  Total URLs: ${totalUrls}`);
  console.log();

  let totalSaved = 0, totalFailed = 0;

  for (const [topicKey, subdir, name, urls] of TOPICS) {
    if (topicFilter && !topicKey.includes(topicFilter) && !name.toLowerCase().includes(topicFilter.toLowerCase())) {
      continue;
    }
    const { saved, failed } = await scrapeTopic(topicKey, subdir, name, urls, { force, dryRun });
    totalSaved += saved;
    totalFailed += failed;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  DONE — ${totalSaved} saved, ${totalFailed} failed`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
