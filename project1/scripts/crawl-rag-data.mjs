#!/usr/bin/env node
/**
 * RAG Data Scraper — Unified Cloudflare Browser Rendering Crawler
 * 
 * Single script that replaces all previous scrapers:
 *   - scrape-with-jina.py (deprecated)
 *   - scrape-gov-docs.py (deprecated)
 *   - scrape-rental-laws.py (deprecated)
 *   - scrape-telco-plans.py (deprecated)
 * 
 * Uses CF Browser Rendering /crawl API (primary) with /markdown and fetch fallbacks.
 * No external dependencies (Jina API key no longer needed).
 * 
 * Usage:
 *   node scripts/crawl-rag-data.mjs                        # crawl all topics
 *   node scripts/crawl-rag-data.mjs --topic tax             # filter by topic
 *   node scripts/crawl-rag-data.mjs --topic "mental"        # partial match
 *   node scripts/crawl-rag-data.mjs --force                 # re-crawl existing
 *   node scripts/crawl-rag-data.mjs --dry-run               # preview only
 *   node scripts/crawl-rag-data.mjs --list                  # list all topics
 * 
 * Requires env vars:
 *   CF_ACCOUNT_ID   — Cloudflare Account ID
 *   CF_API_TOKEN    — API Token with Browser Rendering permissions
 * 
 * After crawling, run the pipeline:
 *   python3 scripts/prepare_rag_data.py
 *   python3 scripts/generate_embeddings.py
 *   python3 scripts/upload_to_cloudflare.py
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
const MIN_CONTENT_LENGTH = 300;
const CRAWL_TIMEOUT = 30000;  // 30s for /crawl polling
const CRAWL_POLL_INTERVAL = 3000;
const MAX_RETRIES = 3;        // retry with backoff

// ── Anti-Crawl: Random Delays ──────────────────────────────────
const DELAY_MIN = 1500;   // minimum ms between requests
const DELAY_MAX = 4000;   // maximum ms between requests
function randomDelay() {
  const ms = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
  return new Promise(r => setTimeout(r, ms));
}

// ── Anti-Crawl: User-Agent Rotation ────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];
function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

// ── Anti-Crawl: Domains that need Playwright (heavy anti-bot) ──
const PLAYWRIGHT_DOMAINS = [
  'homeaffairs.gov.au',
  'immi.homeaffairs.gov.au',
  'agriculture.gov.au',
  'business.gov.au',
  'abr.gov.au',
  'queensland.com',
  'timeout.com',
  'westernaustralia.com',
];
function needsPlaywright(url) {
  const host = new URL(url).hostname.replace('www.', '');
  return PLAYWRIGHT_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

// ── Playwright state (shared browser for reuse) ──
let playwrightAvailable = null; // null = not checked, true/false
let playwrightModule = null;
let sharedBrowser = null;       // reused across URLs in same topic
let USE_PLAYWRIGHT = true;      // can be disabled via --no-playwright

// ── 404 / Error Page Detection ──
const ERROR_PAGE_PATTERNS = [
  /404/i, /page.?not.?found/i, /error/i, /sorry.*cannot/i,
  /doesn.*exist/i, /no longer available/i, /moved permanently/i,
];
function isErrorPage(title, content) {
  if (ERROR_PAGE_PATTERNS.some(p => p.test(title))) return true;
  // Check first 200 chars of content for error patterns
  const head = (content || '').substring(0, 200);
  if (/^(404|page not found|error)/i.test(head.trim())) return true;
  return false;
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── URL Registry — 16 topics, 399 deduplicated URLs ──

const TOPICS = [
  ['centrelink', 'government/centrelink', 'Centrelink Payments', [
    'https://www.servicesaustralia.gov.au/age-pension',
    'https://www.servicesaustralia.gov.au/austudy',
    'https://www.servicesaustralia.gov.au/carer-payment',
    'https://www.servicesaustralia.gov.au/centrelink-online-account',
    'https://www.servicesaustralia.gov.au/child-care-subsidy',
    'https://www.servicesaustralia.gov.au/crisis-payment',
    'https://www.servicesaustralia.gov.au/disability-support-pension',
    'https://www.servicesaustralia.gov.au/family-tax-benefit',
    'https://www.servicesaustralia.gov.au/jobseeker-payment',
    'https://www.servicesaustralia.gov.au/mygov',
    'https://www.servicesaustralia.gov.au/newstart-allowance',
    'https://www.servicesaustralia.gov.au/parental-leave-pay',
    'https://www.servicesaustralia.gov.au/parenting-payment',
    'https://www.servicesaustralia.gov.au/rent-assistance',
    'https://www.servicesaustralia.gov.au/youth-allowance',
  ]],

  ['consumer', 'government/consumer', 'Consumer Rights (ACCC)', [
    'https://www.accc.gov.au/consumers/buying-products-and-services/buying-online',
    'https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees',
    'https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought',
    'https://www.accc.gov.au/consumers/specific-products-and-activities/electricity-prices-and-plans',
    'https://www.accc.gov.au/consumers/specific-products-and-activities/new-and-second-hand-cars',
    'https://www.accc.gov.au/consumers/specific-products-and-activities/private-health-insurance',
    'https://www.accc.gov.au/consumers/specific-products-and-activities/real-estate',
  ]],

  ['education', 'government/education', 'Education & Universities', [
    'https://programsandcourses.anu.edu.au/program/BCOMM',
    'https://programsandcourses.anu.edu.au/program/BIT',
    'https://programsandcourses.anu.edu.au/program/BSCI',
    'https://programsandcourses.anu.edu.au/program/MCOMP',
    'https://study.unimelb.edu.au',
    'https://study.unimelb.edu.au/find/courses/graduate/master-of-engineering/',
    'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/',
    'https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-commerce/',
    'https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-design/',
    'https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-science/',
    'https://study.unimelb.edu.au/find/fees',
    'https://study.unimelb.edu.au/how-to-apply',
    'https://study.unimelb.edu.au/how-to-apply/international-applications',
    'https://study.uq.edu.au/admissions/undergraduate/fees-and-costs',
    'https://study.uq.edu.au/study-options/find-a-program',
    'https://study.uq.edu.au/study-options/programs/bachelor-of-commerce-2040',
    'https://study.uq.edu.au/study-options/programs/bachelor-of-computer-science-2451',
    'https://study.uq.edu.au/study-options/programs/bachelor-of-engineering-honours-2455',
    'https://www.adelaide.edu.au/study',
    'https://www.adelaide.edu.au/study/international',
    'https://www.adelaide.edu.au/study/postgraduate',
    'https://www.adelaide.edu.au/study/undergraduate',
    'https://www.anu.edu.au/study',
    'https://www.anu.edu.au/study/apply',
    'https://www.deakin.edu.au/courses/find-a-course',
    'https://www.deakin.edu.au/study',
    'https://www.deakin.edu.au/study/fees-and-scholarships',
    'https://www.mq.edu.au/study',
    'https://www.mq.edu.au/study/find-a-course',
    'https://www.mq.edu.au/study/international-students',
    'https://www.rmit.edu.au/study-with-us',
    'https://www.rmit.edu.au/study-with-us/international-students',
    'https://www.rmit.edu.au/study-with-us/international-students/fees-and-scholarships',
    'https://www.rmit.edu.au/study-with-us/levels-of-study/postgraduate-study',
    'https://www.rmit.edu.au/study-with-us/levels-of-study/undergraduate-study',
    'https://www.studyassist.gov.au/help-loans',
    'https://www.studyassist.gov.au/help-loans/fee-help',
    'https://www.studyassist.gov.au/help-loans/hecs-help',
    'https://www.studyassist.gov.au/help-loans/sa-help',
    'https://www.studyaustralia.gov.au/en/life-in-australia/accommodation',
    'https://www.studyaustralia.gov.au/en/life-in-australia/cost-of-living',
    'https://www.studyaustralia.gov.au/en/life-in-australia/work',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/english-language-requirements',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/how-to-apply',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/overseas-student-health-cover',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships-and-funding',
    'https://www.studyaustralia.gov.au/en/study-options/universities-and-higher-education',
    'https://www.studyaustralia.gov.au/en/study-options/vocational-education-and-training',
    'https://www.sydney.edu.au/courses/courses/uc/bachelor-of-commerce.html',
    'https://www.sydney.edu.au/courses/courses/uc/bachelor-of-computer-science.html',
    'https://www.sydney.edu.au/courses/courses/uc/bachelor-of-engineering-honours-and-bachelor-of-science.html',
    'https://www.sydney.edu.au/study.html',
    'https://www.sydney.edu.au/study/admissions/fees-and-costs.html',
    'https://www.sydney.edu.au/study/how-to-apply.html',
    'https://www.sydney.edu.au/study/international-students.html',
    'https://www.tafensw.edu.au/courses',
    'https://www.tafensw.edu.au/international',
    'https://www.teqsa.gov.au/students',
    'https://www.tisc.edu.au/static/guide/applying-tisc.tisc',
    'https://www.uac.edu.au/future-applicants/how-to-apply',
    'https://www.unsw.edu.au/arts-design-architecture',
    'https://www.unsw.edu.au/business',
    'https://www.unsw.edu.au/engineering',
    'https://www.unsw.edu.au/science',
    'https://www.unsw.edu.au/study',
    'https://www.unsw.edu.au/study/how-to-apply',
    'https://www.unsw.edu.au/study/international-students',
    'https://www.unsw.edu.au/study/international-students/fees',
    'https://www.unsw.edu.au/study/postgraduate',
    'https://www.unsw.edu.au/study/undergraduate',
    'https://www.uq.edu.au/study',
    'https://www.uts.edu.au/about/faculty-engineering-and-information-technology',
    'https://www.uts.edu.au/about/uts-business-school',
    'https://www.uts.edu.au/study',
    'https://www.uts.edu.au/study/find-a-course',
    'https://www.uts.edu.au/study/international',
    'https://www.uts.edu.au/study/international/fees-and-scholarships',
    'https://www.vtac.edu.au/applying',
  ]],

  ['fairwork', 'government/fair-work', 'Fair Work & Employment', [
    'https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters/hours-of-work',
    'https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters/right-to-disconnect',
    'https://www.fairwork.gov.au/employment-conditions/national-employment-standards',
    'https://www.fairwork.gov.au/ending-employment/notice-and-final-pay',
    'https://www.fairwork.gov.au/ending-employment/redundancy',
    'https://www.fairwork.gov.au/ending-employment/unfair-dismissal',
    'https://www.fairwork.gov.au/find-help-for/visa-holders-migrants',
    'https://www.fairwork.gov.au/leave/annual-leave',
    'https://www.fairwork.gov.au/leave/long-service-leave',
    'https://www.fairwork.gov.au/leave/parental-leave',
    'https://www.fairwork.gov.au/leave/public-holidays',
    'https://www.fairwork.gov.au/leave/sick-and-carers-leave',
    'https://www.fairwork.gov.au/pay-and-wages',
    'https://www.fairwork.gov.au/pay-and-wages/minimum-wages',
    'https://www.fairwork.gov.au/pay-and-wages/overtime',
    'https://www.fairwork.gov.au/pay-and-wages/penalty-rates-and-allowances',
    'https://www.fairwork.gov.au/pay-and-wages/tax-and-superannuation',
    'https://www.fairwork.gov.au/starting-employment/casual-employees',
    'https://www.fairwork.gov.au/starting-employment/types-of-employees',
    'https://www.fairwork.gov.au/starting-employment/unpaid-work/unpaid-trials',
    'https://www.fairwork.gov.au/tools-and-resources/fact-sheets/rights-and-obligations/international-students',
    'https://www.fairwork.gov.au/workplace-problems/fixing-a-workplace-problem',
  ]],

  ['finance', 'government/banking', 'Banking & Finance', [
    'https://moneysmart.gov.au/banking',
    'https://moneysmart.gov.au/banking/savings-accounts',
    'https://moneysmart.gov.au/banking/sending-money-overseas',
    'https://moneysmart.gov.au/banking/transaction-accounts-and-debit-cards',
    'https://moneysmart.gov.au/budgeting/how-to-do-a-budget',
    'https://moneysmart.gov.au/budgeting/manage-the-cost-of-living',
    'https://moneysmart.gov.au/check-and-report-scams',
    'https://moneysmart.gov.au/check-and-report-scams/identify-and-avoid-scams',
    'https://moneysmart.gov.au/credit-cards',
    'https://moneysmart.gov.au/insurance/car-insurance',
    'https://moneysmart.gov.au/insurance/health-insurance',
    'https://moneysmart.gov.au/loans/home-loans',
    'https://moneysmart.gov.au/managing-debt',
    'https://moneysmart.gov.au/scams',
  ]],

  ['healthcare', 'government/healthcare', 'Healthcare Services', [
    'https://www.healthdirect.gov.au/after-hours-healthcare',
    'https://www.healthdirect.gov.au/ambulance',
    'https://www.healthdirect.gov.au/bulk-billing',
    'https://www.healthdirect.gov.au/covid-19',
    'https://www.healthdirect.gov.au/dental-care',
    'https://www.healthdirect.gov.au/emergency-departments',
    'https://www.healthdirect.gov.au/gp-or-emergency-department',
    'https://www.healthdirect.gov.au/health-insurance',
    'https://www.healthdirect.gov.au/hospital-care',
    'https://www.healthdirect.gov.au/medicare',
    'https://www.healthdirect.gov.au/mental-health',
    'https://www.healthdirect.gov.au/mental-health-helplines',
    'https://www.healthdirect.gov.au/ndis',
    'https://www.healthdirect.gov.au/pharmacist',
    'https://www.healthdirect.gov.au/pregnancy',
    'https://www.healthdirect.gov.au/pregnancy-care-in-australia',
    'https://www.healthdirect.gov.au/prescriptions-and-medication',
    'https://www.healthdirect.gov.au/seeing-a-doctor',
    'https://www.healthdirect.gov.au/telehealth',
    'https://www.healthdirect.gov.au/vaccinations',
    'https://www.ombudsman.gov.au/about-us/phio/health-insurance-faq',
    'https://www.privatehealth.gov.au/health_insurance/what_is_covered/index.htm',
    'https://www.privatehealth.gov.au/health_insurance/what_is_covered/medicare.htm',
    'https://www.privatehealth.gov.au/health_insurance/what_is_covered/privatehealth.htm',
  ]],

  ['living', 'government/living', 'Living in Australia', [
    'https://www.australia.gov.au/information-and-services',
    'https://www.australia.gov.au/phone-and-internet',
    'https://www.monash.edu/business',
    'https://www.monash.edu/engineering',
    'https://www.monash.edu/it',
    'https://www.monash.edu/study',
    'https://www.monash.edu/study/courses/find-a-course',
    'https://www.monash.edu/study/fees-scholarships',
    'https://www.monash.edu/study/how-to-apply',
    'https://www.smartraveller.gov.au/before-you-go/safety',
    'https://www.studyinaustralia.gov.au/english/live-in-australia/accommodation',
    'https://www.studyinaustralia.gov.au/english/live-in-australia/work',
    'https://www.studyinaustralia.gov.au/english/plan-your-studies/how-to-apply',
    'https://www.studyinaustralia.gov.au/english/plan-your-studies/scholarships-and-funding',
    'https://www.studyinaustralia.gov.au/english/study/choosing-a-course',
    'https://www.studyinaustralia.gov.au/english/study/universities-and-higher-education',
    'https://www.studyinaustralia.gov.au/english/study/vocational-education-and-training',
    'https://www.triplezero.gov.au',
  ]],

  ['medicare', 'government/medicare', 'Medicare & PBS', [
    'https://www.servicesaustralia.gov.au/about-medicare',
    'https://www.servicesaustralia.gov.au/bulk-billing',
    'https://www.servicesaustralia.gov.au/enrolling-medicare',
    'https://www.servicesaustralia.gov.au/enrolling-your-baby-medicare',
    'https://www.servicesaustralia.gov.au/getting-medicare-benefits',
    'https://www.servicesaustralia.gov.au/health-care-and-medicare',
    'https://www.servicesaustralia.gov.au/how-your-medicare-card-and-account-work',
    'https://www.servicesaustralia.gov.au/low-income-health-care-card',
    'https://www.servicesaustralia.gov.au/medical-costs',
    'https://www.servicesaustralia.gov.au/medicare-and-tax',
    'https://www.servicesaustralia.gov.au/medicare-claims',
    'https://www.servicesaustralia.gov.au/medicare-for-refugees-and-humanitarian-entrants',
    'https://www.servicesaustralia.gov.au/medicare-levy-surcharge',
    'https://www.servicesaustralia.gov.au/medicare-safety-net',
    'https://www.servicesaustralia.gov.au/medicine-and-medicare',
    'https://www.servicesaustralia.gov.au/mental-health-care-and-medicare',
    'https://www.servicesaustralia.gov.au/other-medicare-support',
    'https://www.servicesaustralia.gov.au/private-health-insurance-and-medicare',
    'https://www.servicesaustralia.gov.au/reciprocal-health-care-agreements',
    'https://www.servicesaustralia.gov.au/screening-tests-and-scans-covered-medicare',
    'https://www.servicesaustralia.gov.au/whos-covered-medicare',
  ]],

  ['rental-laws', 'rental-laws', 'Rental Laws by State', [
    'https://nt.gov.au/property/renters/ending-a-tenancy',
    'https://nt.gov.au/property/renters/rent-a-home-or-unit',
    'https://nt.gov.au/property/renters/rent-increases',
    'https://nt.gov.au/property/renters/rental-bonds',
    'https://nt.gov.au/property/renters/repairs-and-maintenance',
    'https://nt.gov.au/property/renters/tenancy-disputes',
    'https://nt.gov.au/property/renters/your-rights-as-a-renter',
    'https://www.acat.act.gov.au/case-types/residential-tenancies',
    'https://www.accesscanberra.act.gov.au/s/article/renting-a-property',
    'https://www.cbos.tas.gov.au/topics/housing/renting',
    'https://www.cbos.tas.gov.au/topics/housing/renting/bonds',
    'https://www.cbos.tas.gov.au/topics/housing/renting/during-a-tenancy',
    'https://www.cbos.tas.gov.au/topics/housing/renting/ending-a-tenancy',
    'https://www.cbos.tas.gov.au/topics/housing/renting/rent-increases',
    'https://www.cbos.tas.gov.au/topics/housing/renting/repairs-and-maintenance',
    'https://www.cbos.tas.gov.au/topics/housing/renting/starting-a-tenancy',
    'https://www.cbos.tas.gov.au/topics/housing/renting/tenant-rights',
    'https://www.cbs.sa.gov.au/residential-tenancies',
    'https://www.commerce.wa.gov.au/consumer-protection/bond',
    'https://www.commerce.wa.gov.au/consumer-protection/ending-tenancy',
    'https://www.commerce.wa.gov.au/consumer-protection/landlord-rights-and-responsibilities',
    'https://www.commerce.wa.gov.au/consumer-protection/property-condition-reports',
    'https://www.commerce.wa.gov.au/consumer-protection/rent',
    'https://www.commerce.wa.gov.au/consumer-protection/rent-increases',
    'https://www.commerce.wa.gov.au/consumer-protection/renting-home',
    'https://www.commerce.wa.gov.au/consumer-protection/repairs-and-maintenance',
    'https://www.commerce.wa.gov.au/consumer-protection/tenant-rights-and-responsibilities',
    'https://www.consumer.vic.gov.au/housing/renting',
    'https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions',
    'https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/bond-claims',
    'https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/ending-your-tenancy',
    'https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/notice-to-vacate',
    'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports',
    'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond',
    'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent',
    'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent-increases',
    'https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets',
    'https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/pets',
    'https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/repairs',
    'https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/urgent-repairs',
    'https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements',
    'https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements/types-of-rental-agreements',
    'https://www.justice.act.gov.au/rental-bonds',
    'https://www.justice.act.gov.au/rental-bonds/bond-refunds',
    'https://www.justice.act.gov.au/rental-bonds/lodging-bonds',
    'https://www.legislation.act.gov.au/View/a/2023-31/current/html/2023-31.html',
    'https://www.rta.qld.gov.au/during-a-tenancy',
    'https://www.rta.qld.gov.au/during-a-tenancy/access-and-entry',
    'https://www.rta.qld.gov.au/during-a-tenancy/pets',
    'https://www.rta.qld.gov.au/during-a-tenancy/rent-increases',
    'https://www.rta.qld.gov.au/during-a-tenancy/repairs-and-maintenance',
    'https://www.rta.qld.gov.au/ending-a-tenancy',
    'https://www.rta.qld.gov.au/ending-a-tenancy/bond-refunds',
    'https://www.rta.qld.gov.au/ending-a-tenancy/ending-a-tenancy-agreement',
    'https://www.rta.qld.gov.au/ending-a-tenancy/notice-periods',
    'https://www.rta.qld.gov.au/starting-a-tenancy',
    'https://www.rta.qld.gov.au/starting-a-tenancy/before-renting',
    'https://www.rta.qld.gov.au/starting-a-tenancy/condition-reports',
    'https://www.rta.qld.gov.au/starting-a-tenancy/rent-payments',
    'https://www.rta.qld.gov.au/starting-a-tenancy/rental-bond',
    'https://www.rta.qld.gov.au/starting-a-tenancy/signing-a-tenancy-agreement',
    'https://www.sa.gov.au/topics/housing/renting-and-letting',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/bonds-and-deposits',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/ending-a-tenancy',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/landlord-rights-and-responsibilities',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/rent-increases',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/renting-privately',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/repairs-and-maintenance',
    'https://www.sa.gov.au/topics/housing/renting-and-letting/tenants-rights-and-responsibilities',
  ]],

  ['renting', 'government/housing', 'Renting & Tenancy', [
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/pets',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/rent-increases',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/repairs-and-maintenance',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/sub-letting',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/you-and-your-landlord',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/breaking-a-lease',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/getting-your-bond-back',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/before-you-sign',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/bond',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/the-condition-report',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/strata-and-community-living',
  ]],

  ['scams', 'government/scams', 'Scamwatch & Anti-Scam', [
    'https://www.cyber.gov.au/protect-yourself',
    'https://www.cyber.gov.au/report-and-recover/common-scam-types',
    'https://www.idcare.org/learning-centre/identity-security',
    'https://www.scamwatch.gov.au/get-help/if-youve-been-scammed',
    'https://www.scamwatch.gov.au/get-help/where-to-get-help',
    'https://www.scamwatch.gov.au/news-alerts',
    'https://www.scamwatch.gov.au/protect-yourself',
    'https://www.scamwatch.gov.au/protect-yourself/how-to-spot-a-scam',
    'https://www.scamwatch.gov.au/protect-yourself/protect-your-devices',
    'https://www.scamwatch.gov.au/protect-yourself/protect-your-identity',
    'https://www.scamwatch.gov.au/report-a-scam',
    'https://www.scamwatch.gov.au/types-of-scams',
    'https://www.scamwatch.gov.au/types-of-scams/attempts-to-gain-your-personal-information',
    'https://www.scamwatch.gov.au/types-of-scams/buying-or-selling-scams',
    'https://www.scamwatch.gov.au/types-of-scams/identity-theft',
    'https://www.scamwatch.gov.au/types-of-scams/investment-scams',
    'https://www.scamwatch.gov.au/types-of-scams/jobs-and-employment-scams',
    'https://www.scamwatch.gov.au/types-of-scams/phishing-scams',
    'https://www.scamwatch.gov.au/types-of-scams/product-and-service-scams',
    'https://www.scamwatch.gov.au/types-of-scams/relationship-scams',
    'https://www.scamwatch.gov.au/types-of-scams/threats-and-extortion-scams',
    'https://www.scamwatch.gov.au/types-of-scams/unexpected-money-scams',
  ]],

  ['super', 'government/super', 'Superannuation', [
    'https://moneysmart.gov.au/how-super-works',
    'https://moneysmart.gov.au/how-super-works/choosing-a-super-fund',
    'https://moneysmart.gov.au/how-super-works/consolidating-super-funds',
    'https://moneysmart.gov.au/how-super-works/find-lost-super',
    'https://moneysmart.gov.au/how-super-works/getting-your-super',
    'https://moneysmart.gov.au/how-super-works/tax-and-super',
    'https://moneysmart.gov.au/how-super-works/types-of-super-funds',
    'https://moneysmart.gov.au/how-super-works/when-you-can-access-your-super-early',
  ]],

  ['tax', 'government/ato', 'ATO & Tax', [
    'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim',
    'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/income-you-must-declare',
    'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/records-you-need-to-keep',
    'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets',
    'https://www.ato.gov.au/individuals-and-families/lodging-your-tax-return',
    'https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy',
    'https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge',
    'https://www.ato.gov.au/individuals-and-families/paying-your-tax-or-getting-a-refund/help-with-paying',
    'https://www.ato.gov.au/individuals-and-families/paying-your-tax-or-getting-a-refund/tax-file-numbers',
    'https://www.ato.gov.au/individuals-and-families/super/growing-and-keeping-track-of-your-super',
    'https://www.ato.gov.au/individuals-and-families/working/working-as-a-contractor',
    'https://www.ato.gov.au/individuals-and-families/working/working-as-an-employee',
    'https://www.ato.gov.au/individuals-and-families/your-tax-return',
    'https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return',
    'https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return/lodge-your-tax-return-with-mytax',
    'https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return/use-a-registered-tax-agent',
    'https://www.ato.gov.au/individuals/income-deductions-offsets-and-records/deductions-you-can-claim',
    'https://www.ato.gov.au/individuals/income-deductions-offsets-and-records/income-you-must-declare',
    'https://www.ato.gov.au/individuals/income-deductions-offsets-and-records/offsets-and-rebates',
    'https://www.ato.gov.au/individuals/lodging-your-tax-return',
    'https://www.ato.gov.au/individuals/paying-and-receiving-tax/myTax',
    'https://www.ato.gov.au/individuals/paying-and-receiving-tax/tfn-and-abn',
    'https://www.ato.gov.au/individuals/paying-and-receiving-tax/when-you-need-to-pay-tax',
    'https://www.ato.gov.au/individuals/tax-rates',
    'https://www.ato.gov.au/individuals/tax-return/2024',
    'https://www.ato.gov.au/individuals/your-tax-return',
    'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents',
    'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-foreign-residents',
  ]],

  ['telco', 'living/telco', 'Telco Plans', [
    'https://www.finder.com.au/best-long-expiry-prepaid-plans',
    'https://www.finder.com.au/mobile-plans/5g-mobile-plans-australia',
    'https://www.finder.com.au/mobile-plans/amaysim-mobile-plans',
    'https://www.finder.com.au/mobile-plans/best-mobile-plans-for-students',
    'https://www.finder.com.au/mobile-plans/best-mobile-plans-international-calling',
    'https://www.finder.com.au/mobile-plans/best-prepaid-plans',
    'https://www.finder.com.au/mobile-plans/best-sim-only-plans',
    'https://www.finder.com.au/mobile-plans/best-tourist-sim-cards-australia',
    'https://www.finder.com.au/mobile-plans/boost-mobile-plans',
    'https://www.finder.com.au/mobile-plans/cheap-mobile-plans',
    'https://www.finder.com.au/mobile-plans/lebara-mobile-plans',
    'https://www.finder.com.au/mobile-plans/optus-mobile',
    'https://www.finder.com.au/mobile-plans/telstra-mobile-plans',
    'https://www.finder.com.au/mobile-plans/unlimited-mobile-data-plans',
    'https://www.finder.com.au/mobile-plans/vodafone-mobile-plans',
    'https://www.finder.com.au/nbn/best-nbn-plans',
    'https://www.finder.com.au/nbn/cheapest-nbn-plans',
  ]],

  ['transport', 'government/transport', 'Transport & Transit', [
    'https://translink.com.au/tickets-and-fares/go-card',
    'https://transportnsw.info/tickets-opal/opal',
    'https://www.nsw.gov.au/driving-boating-and-transport/driver-and-rider-licences/visiting-or-moving-to-nsw',
    'https://www.nsw.gov.au/driving-boating-and-transport/roads-safety-and-rules/road-rules',
    'https://www.ptv.vic.gov.au/tickets/myki',
    'https://www.qld.gov.au/transport/licensing/driver-licensing/overseas-licence',
    'https://www.transperth.wa.gov.au/smartrider',
    'https://www.transport.wa.gov.au/licensing/overseas-licence-holders.asp',
    'https://www.vicroads.vic.gov.au/licences/renew-replace-or-update/new-to-victoria',
    'https://www.vicroads.vic.gov.au/safety-and-road-rules/road-rules',
  ]],

  ['visa', 'government/visa', 'Visa & Immigration', [
    'https://immi.homeaffairs.gov.au/help-support/applying-online-or-on-paper/online-applications',
    'https://immi.homeaffairs.gov.au/visas/already-have-a-visa/check-visa-details-and-conditions/see-your-visa-conditions',
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen',
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/citizenship-test',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/evisitor-651',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/parent-103',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/partner-offshore-309-100',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/partner-onshore-801-820',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-nominated-190',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-work-regional-provisional-491',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500/how-to-apply',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500/length-of-stay',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500/your-obligations',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485/graduate-work-stream',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485/post-study-work-stream',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-skill-shortage-482',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-and-holiday-462',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/working-holiday-417',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times',
    'https://immi.homeaffairs.gov.au/visas/permanent-resident',
    'https://immi.homeaffairs.gov.au/visas/studying-in-australia',
    'https://immi.homeaffairs.gov.au/visas/working-in-australia',
    'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  MENTAL HEALTH — government/mental-health (Healthcare Agent)
  // ═══════════════════════════════════════════════════════════════
  ['mental-health', 'government/mental-health', 'Mental Health & Crisis Support', [
    // Beyond Blue
    'https://www.beyondblue.org.au/mental-health/anxiety',
    'https://www.beyondblue.org.au/mental-health/depression',
    'https://www.beyondblue.org.au/mental-health/stress',
    'https://www.beyondblue.org.au/mental-health/suicide-prevention',
    'https://www.beyondblue.org.au/get-support',
    // Headspace (youth)
    'https://headspace.org.au/explore-topics/for-young-people/depression/',
    'https://headspace.org.au/explore-topics/for-young-people/anxiety/',
    'https://headspace.org.au/explore-topics/for-young-people/stress/',
    'https://headspace.org.au/services/headspace-centres/',
    // Lifeline
    'https://www.lifeline.org.au/get-help/',
    'https://www.lifeline.org.au/crisis-text/',
    // HealthDirect mental health
    'https://www.healthdirect.gov.au/mental-health',
    'https://www.healthdirect.gov.au/mental-health-helplines',
    'https://www.healthdirect.gov.au/mental-health-treatment-plan',
    'https://www.healthdirect.gov.au/depression',
    'https://www.healthdirect.gov.au/anxiety',
    'https://www.healthdirect.gov.au/stress',
    'https://www.healthdirect.gov.au/grief',
    'https://www.healthdirect.gov.au/loneliness',
    // Medicare mental health plan
    'https://www.servicesaustralia.gov.au/mental-health-care-and-medicare',
    // International student wellbeing
    'https://www.studyaustralia.gov.au/en/life-in-australia/health-and-wellbeing',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  TRAVEL — living/travel (Wellness Agent)
  // ═══════════════════════════════════════════════════════════════
  ['travel', 'living/travel', 'Travel & Exploration Australia', [
    // Tourism Australia
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
    'https://www.australia.com/en/facts-and-planning/weather-in-australia.html',
    'https://www.australia.com/en/facts-and-planning/getting-around.html',
    // NSW
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/blue-mountains-national-park',
    'https://www.nationalparks.nsw.gov.au/visit-a-park/parks/royal-national-park',
    'https://www.visitnsw.com/destinations/south-coast',
    'https://www.visitnsw.com/destinations/blue-mountains',
    // VIC
    'https://www.visitmelbourne.com/regions/great-ocean-road',
    'https://www.visitmelbourne.com/regions/yarra-valley-and-dandenong-ranges',
    'https://www.parks.vic.gov.au/places-to-see/parks/grampians-national-park',
    'https://www.visitgreatoceanroad.org.au/the-drive/',
    // QLD
    'https://www.queensland.com/au/en/places-to-see/destinations/gold-coast',
    'https://www.queensland.com/au/en/places-to-see/destinations/cairns-and-great-barrier-reef',
    'https://www.queensland.com/au/en/places-to-see/destinations/whitsundays',
    // SA / WA / TAS / NT
    'https://southaustralia.com/places-to-go/barossa',
    'https://southaustralia.com/places-to-go/kangaroo-island',
    'https://www.westernaustralia.com/au/attraction/rottnest-island',
    'https://www.westernaustralia.com/au/attraction/ningaloo-reef',
    'https://www.westernaustralia.com/au/attraction/margaret-river',
    'https://www.discovertasmania.com.au/places-to-go/cradle-mountain',
    'https://northernterritory.com/uluru-and-surrounds',
    'https://northernterritory.com/kakadu-and-surrounds',
    'https://visitcanberra.com.au/things-to-do',
    // Free activities
    'https://www.timeout.com/sydney/things-to-do/free-things-to-do-in-sydney',
    'https://www.timeout.com/melbourne/things-to-do/free-things-to-do-in-melbourne',
    'https://www.timeout.com/brisbane/things-to-do/free-things-to-do-in-brisbane',
    // Road trips
    'https://www.australia.com/en/itineraries/sydney-to-brisbane-coastal-drive.html',
    'https://www.australia.com/en/itineraries/great-ocean-road.html',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  STUDENT LIFE — living/student (Education Agent)
  // ═══════════════════════════════════════════════════════════════
  ['student', 'living/student', 'Student Life in Australia', [
    'https://www.studyaustralia.gov.au/en/life-in-australia',
    'https://www.studyaustralia.gov.au/en/life-in-australia/accommodation',
    'https://www.studyaustralia.gov.au/en/life-in-australia/cost-of-living',
    'https://www.studyaustralia.gov.au/en/life-in-australia/work',
    'https://www.studyaustralia.gov.au/en/life-in-australia/safety',
    'https://www.studyaustralia.gov.au/en/plan-your-studies/overseas-student-health-cover',
    'https://flatmates.com.au/info/moving-to-australia',
    // Student housing platforms
    'https://www.studyaustralia.gov.au/en/plan-your-studies/english-language-requirements',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  DRIVING & LICENSING — living/driving (Life Agent)
  // ═══════════════════════════════════════════════════════════════
  ['driving', 'living/driving', 'Driving & Licence Conversion', [
    // Overseas licence conversion by state
    'https://www.nsw.gov.au/driving-boating-and-transport/driver-and-rider-licences/visiting-or-moving-to-nsw/moving-your-overseas-licence',
    'https://www.vicroads.vic.gov.au/licences/renew-replace-or-update/new-to-victoria',
    'https://www.qld.gov.au/transport/licensing/driver-licensing/overseas',
    'https://www.transport.wa.gov.au/licensing/overseas-licence-holders.asp',
    'https://www.sa.gov.au/topics/driving-and-transport/licences/applying-for-a-licence/overseas-licence',
    // Road rules
    'https://www.vicroads.vic.gov.au/safety-and-road-rules/road-rules',
    'https://www.nsw.gov.au/driving-boating-and-transport/roads-safety-and-rules/road-rules',
    // Vehicle registration
    'https://www.nsw.gov.au/driving-boating-and-transport/vehicle-registration/fees-concessions-and-forms/vehicle-registration-fees',
    'https://www.vicroads.vic.gov.au/registration/registration-fees',
    // Fines & demerit points
    'https://www.nsw.gov.au/driving-boating-and-transport/demerits-penalties-and-offences',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  CITIZENSHIP — living/citizenship (Life Agent)
  // ═══════════════════════════════════════════════════════════════
  ['citizenship', 'living/citizenship', 'Australian Citizenship', [
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen',
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/citizenship-test',
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/permanent-resident',
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/citizenship-ceremony',
    'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/citizenship-by-descent',
    // Practice test resources
    'https://www.homeaffairs.gov.au/trav/citi/citz/our-common-bond',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  INSURANCE — living/insurance (Life + Finance Agent)
  // ═══════════════════════════════════════════════════════════════
  ['insurance', 'living/insurance', 'Insurance in Australia', [
    'https://moneysmart.gov.au/insurance/car-insurance',
    'https://moneysmart.gov.au/insurance/health-insurance',
    'https://moneysmart.gov.au/insurance/home-insurance',
    'https://moneysmart.gov.au/insurance/life-insurance',
    'https://moneysmart.gov.au/insurance/travel-insurance',
    // Private health insurance
    'https://www.privatehealth.gov.au/health_insurance/what_is_covered/index.htm',
    'https://www.privatehealth.gov.au/health_insurance/what_is_covered/privatehealth.htm',
    'https://www.privatehealth.gov.au/health_insurance/what_is_covered/medicare.htm',
    // OSHC for international students
    'https://www.studyaustralia.gov.au/en/plan-your-studies/overseas-student-health-cover',
    // Compare health insurance
    'https://www.ombudsman.gov.au/about-us/phio/health-insurance-faq',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  PETS — living/pets (Life Agent)
  // ═══════════════════════════════════════════════════════════════
  ['pets', 'living/pets', 'Pets in Australia', [
    // NSW
    'https://www.olg.nsw.gov.au/public/dogs-cats/registration/',
    'https://www.olg.nsw.gov.au/public/dogs-cats/responsible-pet-ownership/',
    // VIC
    'https://agriculture.vic.gov.au/livestock-and-animals/animal-welfare-victoria/domestic-animals-act/registering-dogs-and-cats',
    'https://agriculture.vic.gov.au/livestock-and-animals/animal-welfare-victoria/pets',
    // QLD
    'https://www.qld.gov.au/families/government/pets',
    'https://www.qld.gov.au/families/government/pets/registration',
    // Renting with pets
    'https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/pets',
    'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/pets',
    // Importing pets to Australia
    'https://www.agriculture.gov.au/biosecurity-trade/import/goods/live-animals/pets',
  ]],

  // ═══════════════════════════════════════════════════════════════
  //  LICENSING — government/licensing (Life Agent)
  // ═══════════════════════════════════════════════════════════════
  ['licensing', 'government/licensing', 'Government Licensing & Permits', [
    // Business licensing
    'https://business.gov.au/planning/new-businesses/register-a-business-name',
    'https://business.gov.au/planning/licences-and-permits',
    // ABN
    'https://www.abr.gov.au/business-super-funds-702/applying-abn',
    // RSA (Responsible Service of Alcohol)
    'https://www.liquorandgaming.nsw.gov.au/working-in-the-industry/rsa-and-rcg-training',
    // Working with children check
    'https://ocg.nsw.gov.au/working-children-check',
    'https://www.workingwithchildren.vic.gov.au/',
    // White card (construction)
    'https://www.safework.nsw.gov.au/safety-starts-here/construction-safety-induction-training',
    // Food handler licence
    'https://www.foodstandards.gov.au/consumer/safety/faqsafety',
  ]],
];

// ═══════════════════════════════════════════════════════════════
//  Rendering Strategies (with anti-crawl + retry)
//  Chain: Playwright (for blocked sites) → CF /markdown → Worker proxy → fetch
// ═══════════════════════════════════════════════════════════════

// Worker proxy URL — uses Worker's [browser] binding (no IP restriction)
const WORKER_PROXY_URL = process.env.WORKER_URL || 'https://australian-assistant-api.wjunhao02.workers.dev';
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || '';

async function fetchPageMarkdown(url, attempt = 1) {
  let result = null;

  // For known anti-crawl domains, go straight to Playwright
  if (USE_PLAYWRIGHT && needsPlaywright(url)) {
    result = await tryPlaywright(url);
    if (result) return result;
  }

  // Strategy 1: CF REST API /markdown (fast, reliable for most gov sites)
  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    result = await tryMarkdown(url);
    if (result) return result;
    // /crawl is slower, try as fallback
    result = await tryCrawl(url);
    if (result) return result;
  }

  // Strategy 2: Worker proxy (CF Browser binding)
  result = await tryWorkerProxy(url);
  if (result) return result;

  // Strategy 3: Playwright (for any remaining failures)
  if (USE_PLAYWRIGHT && !needsPlaywright(url)) {
    result = await tryPlaywright(url);
    if (result) return result;
  }

  // Strategy 4: Simple HTTP fetch
  result = await simpleFetch(url);
  if (result) return result;

  // Retry with exponential backoff
  if (attempt < MAX_RETRIES) {
    const backoff = 2000 * Math.pow(2, attempt - 1) + Math.random() * 1000;
    console.log(`  ↻ Retry ${attempt}/${MAX_RETRIES} in ${(backoff/1000).toFixed(1)}s...`);
    await new Promise(r => setTimeout(r, backoff));
    return fetchPageMarkdown(url, attempt + 1);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Strategy: Playwright (Stealth, for anti-crawl sites)
// ═══════════════════════════════════════════════════════════════

async function initPlaywright() {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    playwrightModule = await import('playwright');
    playwrightAvailable = true;
    console.log('  🎭 Playwright available');
  } catch {
    playwrightAvailable = false;
    console.log('  ⚠ Playwright not installed (npm i playwright)');
  }
  return playwrightAvailable;
}

async function tryPlaywright(url) {
  if (!(await initPlaywright())) return null;
  try {
    // Reuse shared browser instance (much faster than launching per-URL)
    if (!sharedBrowser || !sharedBrowser.isConnected()) {
      const { chromium } = playwrightModule;
      sharedBrowser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
        ],
      });
    }

    const context = await sharedBrowser.newContext({
      userAgent: randomUA(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
      javaScriptEnabled: true,
    });

    // Stealth injection — hide webdriver flag
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
      const origQuery = window.navigator.permissions?.query;
      if (origQuery) {
        window.navigator.permissions.query = (params) =>
          params.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : origQuery(params);
      }
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-AU', 'en-US', 'en'] });
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

    // Simulate human: wait + scroll
    await page.waitForTimeout(2000 + Math.random() * 2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1000);

    const title = await page.title();
    const content = await page.evaluate(() => {
      const removeSelectors = [
        'nav', 'header', 'footer', 'script', 'style', 'noscript',
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
        '.cookie-banner', '#cookie-banner', '.skip-link', '.breadcrumb',
        '.site-header', '.site-footer', '.nav-menu', '#nav', '.sidebar',
      ];
      for (const sel of removeSelectors) {
        for (const el of document.querySelectorAll(sel)) el.remove();
      }
      const main = document.querySelector('main, [role="main"], article, .content, #content, .main-content');
      return (main || document.body)?.innerText || '';
    });

    await context.close(); // close context, keep browser alive

    if (content && content.length >= MIN_CONTENT_LENGTH) {
      console.log(`  🎭 Playwright OK (${content.length} chars)`);
      return { markdown: content, title, url };
    }
    console.log(`  ⚠ Playwright: too short (${content?.length || 0} chars)`);
    return null;
  } catch (err) {
    console.log(`  ⚠ Playwright error: ${err.message}`);
    return null;
  }
}

// Close shared browser (called at end of run)
async function closePlaywright() {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  Strategy: Worker Proxy
// ═══════════════════════════════════════════════════════════════

async function tryWorkerProxy(url) {
  try {
    const endpoint = `${WORKER_PROXY_URL}/api/browser-render`;
    const headers = { 'Content-Type': 'application/json' };
    if (WORKER_AUTH_TOKEN) headers['Authorization'] = `Bearer ${WORKER_AUTH_TOKEN}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    if (!res.ok) { console.log(`  ⚠ Worker proxy ${res.status}`); return null; }
    const data = await res.json();
    if (data.success && data.result?.markdown) {
      return { markdown: data.result.markdown, title: data.result.title || '', url: data.result.url || url };
    }
    return null;
  } catch (err) { console.log(`  ⚠ Worker proxy error: ${err.message}`); return null; }
}

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
    if (!res.ok) { console.log(`  ⚠ /crawl POST ${res.status}`); return null; }
    const data = await res.json();
    if (!data.success || !data.result) return null;
    const jobId = data.result;
    if (typeof jobId !== 'string') return null;

    const startTime = Date.now();
    while (Date.now() - startTime < CRAWL_TIMEOUT) {
      await delay(CRAWL_POLL_INTERVAL); // fixed delay for polling, not anti-crawl
      const pollRes = await fetch(
        `${CF_BR_BASE}/${CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}`,
        { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` } }
      );
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      const result = pollData.result;
      if (result?.status === 'completed' && result.records?.length > 0) {
        const record = result.records[0];
        return { markdown: record.markdown || '', title: record.metadata?.title || '', url: record.url || url };
      }
      if (result?.status === 'failed') { console.log(`  ⚠ /crawl failed`); return null; }
      process.stdout.write('.');
    }
    console.log(`  ⚠ /crawl timeout`);
    return null;
  } catch (err) { console.log(`  ⚠ /crawl error: ${err.message}`); return null; }
}

async function tryMarkdown(url) {
  try {
    const endpoint = `${CF_BR_BASE}/${CF_ACCOUNT_ID}/browser-rendering/markdown`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) {
        const md = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        return { markdown: md, title: '', url };
      }
    } else { console.log(`  ⚠ /markdown ${res.status}`); }
  } catch (err) { console.log(`  ⚠ /markdown error: ${err.message}`); }
  return null;
}

async function simpleFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const md = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim();
    return { markdown: md, title, url };
  } catch { return null; }
}

// ── Content Cleaning ──

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
    return title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').substring(0, 80) + '.md';
  }
  const parsed = new URL(url);
  const host = parsed.hostname.replace('www.', '').replace(/\./g, '-');
  const path = parsed.pathname.replace(/\/$/, '').replace(/^\//, '').replace(/\//g, '_');
  return `${host}_${path || 'index'}`.substring(0, 100) + '.md';
}

// ── Scraper ──

async function scrapeTopic(topicKey, outputSubdir, displayName, urls, options = {}) {
  const outputDir = join(RAG_DIR, outputSubdir);
  mkdirSync(outputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${displayName}  (${urls.length} URLs → ${outputSubdir})`);
  console.log(`${'='.repeat(60)}`);

  let saved = 0, skipped = 0, failed = 0;

  for (const url of urls) {
    const existingFiles = readdirSync(outputDir);
    const host = new URL(url).hostname.replace('www.', '').replace(/\./g, '-');
    const alreadyExists = !options.force && existingFiles.some(f => f.includes(host));

    if (alreadyExists && !options.force) { skipped++; saved++; continue; }
    if (options.dryRun) { console.log(`  [dry-run] ${url}`); continue; }

    console.log(`  ⏳ ${url}`);
    const result = await fetchPageMarkdown(url);
    const content = result?.markdown || '';

    if (!content || content.length < MIN_CONTENT_LENGTH) {
      console.log(`  ✗ Failed or too short (${content?.length || 0} chars)`);
      failed++;
      await randomDelay();
      continue;
    }

    const cleaned = cleanMarkdown(content);
    let title = result?.title || '';
    if (!title) { const m = cleaned.match(/^#\s+(.+)$/m); title = m ? m[1].trim() : ''; }

    // Skip 404 / error pages
    if (isErrorPage(title, cleaned)) {
      console.log(`  ✗ Skipped error/404 page: "${title.substring(0, 60)}"`);
      failed++;
      await randomDelay();
      continue;
    }

    const filename = generateFilename(url, title);
    const md = [
      `# ${title || new URL(url).pathname}`, '',
      `**Source**: ${url}`,
      `**Category**: ${topicKey}`,
      `**Topic**: ${displayName}`,
      `**Last fetched**: ${new Date().toISOString().split('T')[0]}`, '',
      '---', '', cleaned,
    ].join('\n');

    writeFileSync(join(outputDir, filename), md, 'utf-8');
    saved++;
    console.log(`  ✓ ${filename} (${(Buffer.byteLength(md) / 1024).toFixed(1)} KB)`);
    await randomDelay();
  }

  // Close shared Playwright browser after topic
  await closePlaywright();

  console.log(`\n  ✅ ${saved} saved (${skipped} cached), ${failed} failed`);
  return { saved, failed };
}

// ── CLI ──

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const listOnly = args.includes('--list');
  if (args.includes('--no-playwright')) USE_PLAYWRIGHT = false;
  const topicFilter = args.find(a => a.startsWith('--topic='))?.split('=')[1]
    || (args.includes('--topic') ? args[args.indexOf('--topic') + 1] : null);

  const totalUrls = TOPICS.reduce((n, t) => n + t[3].length, 0);

  if (listOnly) {
    console.log(`\n  ${TOPICS.length} topics, ${totalUrls} URLs:\n`);
    for (const [key, subdir, name, urls] of TOPICS) {
      console.log(`  ${key.padEnd(15)} ${String(urls.length).padStart(3)} URLs → ${subdir}`);
    }
    console.log();
    return;
  }

  // Check Playwright availability
  if (USE_PLAYWRIGHT) await initPlaywright();

  console.log('='.repeat(60));
  console.log('  RAG Scraper — Anti-Crawl Enabled (Unified)');
  console.log('='.repeat(60));
  console.log(`  Output: ${RAG_DIR}`);
  console.log(`  CF API: ${CF_ACCOUNT_ID ? '✓' : '✗ not set'}`);
  console.log(`  Playwright: ${playwrightAvailable ? '✓ stealth mode' : '✗ disabled'}`);
  console.log(`  Strategy: ${needsPlaywright('https://homeaffairs.gov.au') ? 'Playwright → ' : ''}CF /markdown → Worker → Playwright → fetch`);
  console.log(`  Anti-Crawl: random delay ${DELAY_MIN}-${DELAY_MAX}ms | UA rotation | retry ${MAX_RETRIES}x`);
  console.log(`  Topics: ${TOPICS.length}  |  URLs: ${totalUrls}`);
  console.log(`  Force: ${force}  |  Dry-run: ${dryRun}`);
  if (topicFilter) console.log(`  Filter: "${topicFilter}"`);
  console.log();

  let totalSaved = 0, totalFailed = 0;
  for (const [topicKey, subdir, name, urls] of TOPICS) {
    if (topicFilter && !topicKey.includes(topicFilter) && !name.toLowerCase().includes(topicFilter.toLowerCase())) continue;
    const { saved, failed } = await scrapeTopic(topicKey, subdir, name, urls, { force, dryRun });
    totalSaved += saved;
    totalFailed += failed;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  DONE — ${totalSaved} saved, ${totalFailed} failed`);
  console.log('='.repeat(60));
  console.log('\n📌 Next steps:');
  console.log('  python3 scripts/prepare_rag_data.py');
  console.log('  python3 scripts/generate_embeddings.py');
  console.log('  python3 scripts/upload_to_cloudflare.py');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
