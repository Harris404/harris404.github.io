#!/usr/bin/env node
/**
 * Playwright Stealth Crawler — for URLs that CF Browser Rendering can't handle
 * 
 * Uses real Chromium with stealth techniques to bypass anti-bot detection:
 * - Real browser fingerprint (no "headless" signals)
 * - Random User-Agent rotation
 * - Human-like delays and viewport randomization
 * - Cookie acceptance + scroll simulation
 * 
 * Usage:
 *   node scripts/crawl-failed-urls.mjs                # crawl all failed URLs
 *   node scripts/crawl-failed-urls.mjs --topic edu    # filter by topic
 *   node scripts/crawl-failed-urls.mjs --dry-run      # preview only
 *   node scripts/crawl-failed-urls.mjs --headful      # show browser window
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname, '..');
const RAG_DIR = join(BASE_DIR, 'data', 'rag-sources');

const MIN_CONTENT_LENGTH = 300;

// ── User-Agent rotation ────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Failed URLs registry ───────────────────────────────────────
const FAILED_URLS = [
  // ── Education: Universities that block CF rendering ──
  ['education', 'living/student', 'Australian Universities (Failed)', [
    // Monash University
    'https://www.monash.edu/study',
    'https://www.monash.edu/study/courses/find-a-course',
    'https://www.monash.edu/study/fees-scholarships',
    'https://www.monash.edu/study/how-to-apply',
    // University of Adelaide
    'https://www.adelaide.edu.au/study',
    'https://www.adelaide.edu.au/study/international',
    // Griffith University
    'https://www.griffith.edu.au/study',
    'https://www.griffith.edu.au/international',
    // Deakin University
    'https://www.deakin.edu.au/study',
    'https://www.deakin.edu.au/courses/find-a-course',
    'https://www.deakin.edu.au/study/fees-and-scholarships',
    // Macquarie University
    'https://www.mq.edu.au/study',
    'https://www.mq.edu.au/study/international-students',
    // University of Newcastle
    'https://www.newcastle.edu.au/study',
    'https://www.newcastle.edu.au/study/international-students',
    // University of Wollongong
    'https://www.wollongong.edu.au/study',
    'https://www.wollongong.edu.au/study/international',
    // University of New England
    'https://www.une.edu.au/study',
    'https://www.une.edu.au/study/international-students',
    // University of Tasmania
    'https://www.utas.edu.au/study',
    'https://www.utas.edu.au/international',
    // Sunshine Coast University
    'https://www.sunshinecoast.edu.au/study/',
    'https://www.sunshinecoast.edu.au/international/',
    // Flinders International
    'https://www.flinders.edu.au/international-students',
    // UniSA International
    'https://www.unisa.edu.au/study/international-students/',
  ]],

  // ── Travel: Tourism sites with heavy anti-bot ──
  ['travel', 'living/travel', 'Travel Destinations (Failed)', [
    // Visit Melbourne
    'https://www.visitmelbourne.com/regions/great-ocean-road',
    'https://www.visitmelbourne.com/regions/yarra-valley-and-dandenong-ranges',
    'https://www.visitmelbourne.com/regions/phillip-island',
    'https://www.visitmelbourne.com/regions/mornington-peninsula',
    // Queensland Tourism
    'https://www.queensland.com/au/en/places-to-see/destinations/gold-coast',
    'https://www.queensland.com/au/en/places-to-see/destinations/sunshine-coast',
    'https://www.queensland.com/au/en/places-to-see/destinations/cairns-and-great-barrier-reef',
    'https://www.queensland.com/au/en/places-to-see/destinations/whitsundays',
    // Western Australia Tourism
    'https://www.westernaustralia.com/au/attraction/rottnest-island',
    'https://www.westernaustralia.com/au/attraction/ningaloo-reef',
    'https://www.westernaustralia.com/au/attraction/margaret-river',
    'https://www.westernaustralia.com/au/destination/broome-and-the-kimberley',
  ]],
];

// ── Stealth browser setup ──────────────────────────────────────

async function launchStealthBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
  });

  return browser;
}

async function createStealthPage(browser) {
  const context = await browser.newContext({
    userAgent: randomUA(),
    viewport: {
      width: 1280 + Math.floor(Math.random() * 200),
      height: 800 + Math.floor(Math.random() * 100),
    },
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    geolocation: { latitude: -33.8688, longitude: 151.2093 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();

  // Remove webdriver flag
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Override plugins to look real
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-AU', 'en-US', 'en'],
    });
    // Chrome runtime
    window.chrome = { runtime: {} };
  });

  return { context, page };
}

// ── Human-like behavior simulation ─────────────────────────────

async function humanDelay(min = 1000, max = 3000) {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
}

async function simulateHumanBehavior(page) {
  // Scroll down slowly like a human reading
  try {
    await page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      const scrollStep = 300 + Math.random() * 200;
      const maxScroll = Math.min(document.body.scrollHeight, 3000);
      for (let pos = 0; pos < maxScroll; pos += scrollStep) {
        window.scrollTo(0, pos);
        await delay(200 + Math.random() * 300);
      }
      window.scrollTo(0, 0); // scroll back to top
    });
  } catch { /* ignore scroll errors */ }

  // Try to accept cookie banners
  try {
    const cookieSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("Accept Cookies")',
      'button:has-text("I agree")',
      'button:has-text("Got it")',
      '[id*="cookie"] button',
      '[class*="cookie"] button',
      '[id*="consent"] button',
    ];
    for (const sel of cookieSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }
  } catch { /* ignore cookie banner errors */ }
}

// ── Content extraction ─────────────────────────────────────────

async function extractContent(page) {
  return await page.evaluate(() => {
    // Remove noise elements
    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.cookie-banner', '.cookie-consent', '#cookie-notice',
      '.site-header', '.site-footer', '.site-nav',
      '.breadcrumb', '.breadcrumbs',
      '.social-share', '.share-buttons',
      '.sidebar', 'aside',
      '.ad', '.ads', '.advertisement',
    ];

    for (const sel of removeSelectors) {
      document.querySelectorAll(sel).forEach(el => el.remove());
    }

    // Get the main content area
    const main = document.querySelector('main, [role="main"], #main-content, .main-content, article')
      || document.body;

    // Convert to simplified markdown
    function nodeToMd(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim();
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(c => nodeToMd(c, depth + 1)).filter(Boolean).join(' ');

      if (!children.trim()) return '';

      switch (tag) {
        case 'h1': return '\n\n# ' + children + '\n';
        case 'h2': return '\n\n## ' + children + '\n';
        case 'h3': return '\n\n### ' + children + '\n';
        case 'h4': return '\n\n#### ' + children + '\n';
        case 'p': return '\n\n' + children + '\n';
        case 'li': return '\n- ' + children;
        case 'ul': case 'ol': return '\n' + children + '\n';
        case 'a': {
          const href = node.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            return `[${children}](${href})`;
          }
          return children;
        }
        case 'strong': case 'b': return `**${children}**`;
        case 'em': case 'i': return `*${children}*`;
        case 'br': return '\n';
        case 'div': case 'section': case 'article': return '\n' + children + '\n';
        case 'table': return '\n' + children + '\n';
        case 'tr': return children + '\n';
        case 'td': case 'th': return children + ' | ';
        default: return children;
      }
    }

    const title = document.title || '';
    const markdown = nodeToMd(main);

    return {
      title,
      markdown: markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    };
  });
}

// ── Filename and metadata ──────────────────────────────────────

function generateFilename(url, title) {
  const text = title || new URL(url).pathname;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) + '.md';
}

function buildMarkdownFile(url, title, content, topicKey, displayName) {
  return [
    `# ${title || new URL(url).pathname}`,
    '',
    `**Source**: ${url}`,
    `**Category**: ${topicKey}`,
    `**Topic**: ${displayName}`,
    `**Last fetched**: ${new Date().toISOString().split('T')[0]}`,
    `**Method**: Playwright stealth`,
    '',
    '---',
    '',
    content,
  ].join('\n');
}

// ── Main scraper ───────────────────────────────────────────────

async function scrapeTopic(browser, topicKey, outputSubdir, displayName, urls, options) {
  const outputDir = join(RAG_DIR, outputSubdir);
  mkdirSync(outputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${displayName}  (${urls.length} URLs → ${outputSubdir})`);
  console.log(`${'='.repeat(60)}`);

  let saved = 0, failed = 0;

  for (const url of urls) {
    if (options.dryRun) {
      console.log(`  [dry-run] ${url}`);
      continue;
    }

    console.log(`  ⏳ ${url}`);

    const { context, page } = await createStealthPage(browser);

    try {
      // Navigate with generous timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for content to render
      await humanDelay(2000, 4000);

      // Try waiting for main content indicators
      try {
        await page.waitForSelector('main, article, [role="main"], h1, .content', { timeout: 10000 });
      } catch { /* proceed anyway */ }

      // Simulate human behavior
      await simulateHumanBehavior(page);
      await humanDelay(1000, 2000);

      // Extract content
      const { title, markdown } = await extractContent(page);

      if (!markdown || markdown.length < MIN_CONTENT_LENGTH) {
        console.log(`  ✗ Too short (${markdown?.length || 0} chars)`);
        failed++;
        await context.close();
        continue;
      }

      const filename = generateFilename(url, title);
      const filepath = join(outputDir, filename);
      const md = buildMarkdownFile(url, title, markdown, topicKey, displayName);

      writeFileSync(filepath, md, 'utf-8');
      const size = Buffer.byteLength(md);
      saved++;
      console.log(`  ✓ ${filename} (${(size / 1024).toFixed(1)} KB)`);

    } catch (err) {
      console.log(`  ✗ Error: ${err.message.substring(0, 80)}`);
      failed++;
    } finally {
      await context.close();
    }

    // Random delay between requests (human-like)
    await humanDelay(2000, 5000);
  }

  console.log(`\n  ✅ ${saved} saved, ${failed} failed`);
  return { saved, failed };
}

// ── CLI ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const headful = args.includes('--headful');
  const topicFilter = args.find(a => a.startsWith('--topic='))?.split('=')[1]
    || (args.includes('--topic') ? args[args.indexOf('--topic') + 1] : null);

  const totalUrls = FAILED_URLS.reduce((n, t) => n + t[3].length, 0);

  console.log('='.repeat(60));
  console.log('  Playwright Stealth Crawler — Failed URL Recovery');
  console.log('='.repeat(60));
  console.log(`  Output: ${RAG_DIR}`);
  console.log(`  Mode: ${headful ? '🖥  headful (visible browser)' : '🕶  headless (stealth)'}`);
  console.log(`  Dry-run: ${dryRun}`);
  console.log(`  URLs: ${totalUrls}`);
  if (topicFilter) console.log(`  Filter: "${topicFilter}"`);
  console.log();

  const browser = await launchStealthBrowser(!headful);
  let totalSaved = 0, totalFailed = 0;

  try {
    for (const [topicKey, subdir, name, urls] of FAILED_URLS) {
      if (topicFilter && !topicKey.includes(topicFilter) && !name.toLowerCase().includes(topicFilter.toLowerCase())) {
        continue;
      }
      const { saved, failed } = await scrapeTopic(browser, topicKey, subdir, name, urls, { dryRun });
      totalSaved += saved;
      totalFailed += failed;
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  DONE — ${totalSaved} saved, ${totalFailed} failed`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
