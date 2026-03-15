/**
 * Tool Registry — 所有工具的统一注册和调度
 */

import { getWeather } from './weather.js';
import { calculateTax, getTaxBrackets, calculateHelpRepayment } from './tax.js';
import { convertCurrency, getExchangeRates } from './exchange.js';
import { searchMedicine } from './medicine.js';
import { searchFacilities } from './healthcare.js';
import { searchNearby } from './nearby.js';
import { getDirections } from './directions.js';
import { webSearch, tavilySearch } from './web-search.js';
import { searchPostcode } from './postcodes.js';
import { searchCourses } from './education.js';
import { getFuelPrices } from './fuel.js';
import { getHolidays } from './holidays.js';
import { searchProperty } from './property.js';
import { searchJobs } from './jobs.js';
import { calculateCentrelink } from './centrelink.js';
import { compareEnergy } from './energy.js';
import { getBankRates } from './bank-rates.js';
import { calculateOSHC } from './oshc.js';
import { getAQFInfo } from './education.js';
import { getEmergencyInfo } from './emergency.js';
import { searchVehicle } from './vehicle.js';
import { searchVisa } from './visa.js';
import { searchEvents } from './events.js';
import { ToolCache, CACHE_TTL } from '../cache.js';

export const TOOL_REGISTRY = {
  weather: {
    name: 'weather',
    description: 'Australian weather from BOM',
    handler: getWeather
  },
  tax_calculator: {
    name: 'tax_calculator',
    description: 'Australian income tax calculator (FY2024-25)',
    handler: calculateTax
  },
  exchange_rate: {
    name: 'exchange_rate',
    description: 'Currency exchange rates (Frankfurter)',
    handler: convertCurrency
  },
  medicine: {
    name: 'medicine',
    description: 'Medicine/drug information (TGA)',
    handler: searchMedicine
  },
  healthcare: {
    name: 'healthcare',
    description: 'Healthcare facilities (Overpass)',
    handler: searchFacilities
  },
  web_search: {
    name: 'web_search',
    description: 'Web search (Tavily)',
    handler: webSearch
  },
  supermarket_assistant: {
    name: 'supermarket_assistant',
    description: 'Australian supermarkets, pharmacies & retail multi-tool. MODES: 1) "specials" - Get weekly specials, half-price deals for Woolworths, Coles, Aldi, IGA, Chemist Warehouse, Priceline, Big W, Kmart. 2) "product_search" - Search for a SPECIFIC product by name (find current price, availability). arguments: { mode: "specials"|"product_search", store: "woolworths"|"coles"|"all"|etc, query: "milk" }',
    handler: async (args, env) => {
      if (args.mode === 'product_search') {
        const { searchSupermarketProduct } = await import('./supermarket-search.js');
        return await searchSupermarketProduct(args, env);
      } else {
        const { getSupermarketSpecials } = await import('./supermarket.js');
        return await getSupermarketSpecials(args, env);
      }
    }
  },
  public_transport: {
    name: 'public_transport',
    description: 'Australian public transport unified API (ALL states). arguments: { state: "NSW"|"QLD"|"VIC"|"SA"|"WA"|"TAS"|"NT"|"ACT", type: "departures"|"alerts"|"vehicles", stop_name: "Central Station", mode: "train"|"tram"|"bus", route: "G10" (for vehicle tracking)}. Real-time: NSW (Opal), QLD (Go card), VIC (myki — train/tram/bus), SA (metroCARD — bus/train/tram with live GPS). Web search: WA (SmartRider), TAS (Greencard), NT, ACT (MyWay). Use "departures", "alerts", or "vehicles" (SA only: live GPS positions).',
    handler: async (args, env) => {
      const state = (args.state || 'NSW').toUpperCase();
      const type = args.type || 'departures';
      if (state === 'QLD') {
        const { getQldDepartures, getQldAlerts } = await import('./transport-qld.js');
        return type === 'alerts' ? await getQldAlerts(args, env) : await getQldDepartures(args, env);
      } else if (state === 'VIC') {
        const { getVICDepartures, getVICAlerts } = await import('./transport-vic.js');
        return type === 'alerts' ? await getVICAlerts(args, env) : await getVICDepartures(args, env);
      } else if (state === 'SA') {
        const { getSADepartures, getSAAlerts, getSAVehicles } = await import('./transport-sa.js');
        return type === 'vehicles' ? await getSAVehicles(args, env)
          : type === 'alerts' ? await getSAAlerts(args, env)
          : await getSADepartures(args, env);
      } else if (['WA', 'TAS', 'NT', 'ACT'].includes(state)) {
        const { getOtherStateDepartures, getOtherStateAlerts } = await import('./transport-other.js');
        return type === 'alerts' ? await getOtherStateAlerts(args, env) : await getOtherStateDepartures(args, env);
      } else {
        const { getDepartures, getTransportAlerts } = await import('./transport.js');
        return type === 'alerts' ? await getTransportAlerts(args, env) : await getDepartures(args, env);
      }
    }
  },
  maps_assistant: {
    name: 'maps_assistant',
    description: 'Unified Australian location & maps tool. MODES: 1) "nearby" - Find nearby places (restaurants, cafes, pharmacies, gyms, etc.) by GPS coords or city name. 2) "directions" - Route planning from A to B (transit/driving/walking/cycling). arguments: { mode: "nearby"|"directions", query: "coffee shop", latitude: -33.87, longitude: 151.21, location: "Melbourne CBD", origin: "Central Station", destination: "UNSW", travel_mode: "transit" }',
    handler: async (args, env) => {
      if (args.mode === 'directions') {
        // Forward travel_mode as the mode parameter expected by getDirections
        const dirArgs = { ...args, mode: args.travel_mode || 'transit' };
        return await getDirections(dirArgs, env);
      } else {
        // Default: nearby search (covers old places.js + nearby.js)
        return await searchNearby(args, env);
      }
    }
  },
  postcodes: {
    name: 'postcodes',
    description: 'Australian postcode lookup',
    handler: searchPostcode
  },
  education: {
    name: 'education',
    description: 'CRICOS courses & institutions',
    handler: searchCourses
  },
  fuel_prices: {
    name: 'fuel_prices',
    description: 'Australian fuel/petrol prices',
    handler: getFuelPrices
  },
  public_holidays: {
    name: 'public_holidays',
    description: 'Australian public holidays',
    handler: getHolidays
  },
  property: {
    name: 'property',
    description: 'Property/rental search & prices',
    handler: searchProperty
  },
  jobs: {
    name: 'jobs',
    description: 'Job search & salary guide',
    handler: searchJobs
  },
  centrelink: {
    name: 'centrelink',
    description: 'Centrelink welfare payments calculator',
    handler: calculateCentrelink
  },
  energy_compare: {
    name: 'energy_compare',
    description: 'Electricity & gas price comparison. Tries real-time CDR API (Energy Made Easy, 10 retailers) first, falls back to AER 2024-25 reference data. arguments: { location/state, type: "electricity"|"gas", usage: kWh/day, retailer: "agl"|"origin"|"energyaustralia"|"alinta" }',
    handler: async (args, env) => {
      // Try real-time CDR API first
      try {
        const { getEnergyPlans } = await import('./energy-plans.js');
        const state = (args.state || args.location || 'NSW').toUpperCase();
        const plans = await getEnergyPlans({ ...args, state }, env);
        if (plans.plans_found > 0 || (plans.plans && plans.plans.length > 0)) {
          // Also include static comparison data for context
          const staticData = await compareEnergy(args);
          return {
            realtime_plans: plans,
            reference_data: staticData,
            source: 'AER CDR API (实时) + AER Default Market Offer 2024-25 (参考)',
          };
        }
      } catch (e) {
        console.log(`[energy_compare] CDR API failed: ${e.message}, falling back to static data`);
      }
      // Fallback to static AER data
      return await compareEnergy(args);
    }
  },
  bank_rates: {
    name: 'bank_rates',
    description: 'Bank interest rates (mortgage/savings/term deposit)',
    handler: getBankRates
  },
  oshc: {
    name: 'oshc',
    description: 'Overseas Student Health Cover (OSHC) live price comparison — fetches real-time quotes from oshcaustralia.com.au for all 5 approved providers (AHM, nib, Worldcare, Medibank, Bupa). Input: cover_type (single/couple/family/single_parent), duration_months, university (optional). Returns sorted live quotes, coverage details, provider links.',
    handler: calculateOSHC
  },
  aqf: {
    name: 'aqf',
    description: 'Australian Qualifications Framework (AQF) reference — levels 1-10, VET vs Higher Education. Input: level (1-10 optional). Returns qualification names, duration, entry requirements, examples.',
    handler: getAQFInfo
  },
  emergency_info: {
    name: 'emergency_info',
    description: 'Australian emergency contacts, helplines, Chinese consulates, mental health crisis lines, and translation services. Built-in data, no API needed. arguments: { category: "emergency"|"health"|"mental_health"|"consulate"|"translation"|"all", state: "NSW" (optional) }',
    handler: getEmergencyInfo
  },
  vehicle: {
    name: 'vehicle',
    description: 'Vehicle registration check (Rego) and used car valuation. MODES: 1) "rego" — Check vehicle registration status by plate number + state. Returns official check links and PPSR info. 2) "valuation" — Get used car market value by make/model/year via Redbook/CarsGuide. Includes buying tips for immigrants. arguments: { mode: "rego"|"valuation", plate: "ABC123", state: "NSW", make: "Toyota", model: "Corolla", year: 2018 }',
    handler: searchVehicle
  },
  visa_info: {
    name: 'visa_info',
    description: 'Australian visa processing times and info. Search by subclass number (500, 485, 189, 190, 491, 600, 820, 143, 870) or general query. Returns real-time processing times from Home Affairs + built-in visa requirements, costs, and tips. arguments: { subclass: "500", query: "student visa processing time" }',
    handler: searchVisa
  },
  events: {
    name: 'events',
    description: 'Search local events and weekend activities in Australian cities. Covers Eventbrite, TimeOut, What\'s On, and more. arguments: { city: "Sydney"|"Melbourne"|"Brisbane"|etc, category: "free"|"markets"|"food"|"music"|"art"|"chinese"|"festival"|"outdoor"|"family"|"networking", when: "this weekend"|"today"|"this week", query: "night market" }',
    handler: searchEvents
  },
  // ─── NEW Killer Features ───────────────────────────────────────────────────
  hotdoc: {
    name: 'hotdoc',
    description: 'Search for available GP, dentist, physio or specialist appointments near a location via HotDoc. Uses Tavily site-scoped search of hotdoc.com.au to find clinics with online booking. arguments: { specialty: "gp"|"dentist"|"physio"|"psychologist"|"optometrist", location: "Zetland NSW"|"Melbourne CBD", bulk_billing: true }',
    handler: async (args, env) => {
      const tavilyKey = env?.TAVILY_API_KEY;
      if (!tavilyKey) return { error: 'Tavily API key not configured for HotDoc search' };

      const specialty = args.specialty || 'gp';
      const location = args.location || 'Sydney';
      const bulkBilling = args.bulk_billing ? ' bulk billing' : '';
      const query = `${specialty}${bulkBilling} near ${location} book appointment available`;
      const domains = ['hotdoc.com.au'];

      // Check cache
      const cache = new ToolCache(env);
      const cached = await cache.get('hotdoc', query, domains);
      if (cached) return cached;

      try {
        const data = await tavilySearch(query, tavilyKey, {
          maxResults: 8,
          depth: 'basic',        // site-scoped → basic is sufficient (saves 1 credit)
          rawContent: false,     // content snippets are enough for clinic info
          answer: false,         // no AI answer needed
          includeDomains: domains,
        });

        const clinics = (data.results || [])
          .filter(r => r.url?.includes('hotdoc.com.au'))
          .map(r => ({
            name: r.title?.replace(/ - HotDoc$/i, '').replace(/Book.*?at /i, '') || '',
            url: r.url || '',
            snippet: (r.snippet || '').substring(0, 500),
          }))
          .filter(r => r.name)
          .slice(0, 6);

        const result = {
          specialty,
          location,
          bulk_billing: !!args.bulk_billing,
          results_count: clinics.length,
          clinics,
          source: 'HotDoc via Tavily',
          booking_tip: 'Click the URL to book online via HotDoc. Most GPs allow same-day or next-day appointments.',
        };

        await cache.set('hotdoc', query, domains, result, CACHE_TTL.HOTDOC);
        return result;
      } catch (err) {
        return { error: err.message, specialty, location };
      }
    }
  },
  domain_search: {
    name: 'domain_search',
    description: 'Search Australian rental & property listings from Domain.com.au via Tavily. Find available rentals, open inspections, and property details. arguments: { location: "Zetland NSW"|"Melbourne CBD", type: "rent"|"buy", bedrooms: 2, max_price: 600 }',
    handler: async (args, env) => {
      const tavilyKey = env?.TAVILY_API_KEY;
      if (!tavilyKey) return { error: 'Tavily API key not configured for Domain search' };

      const location = args.location || 'Sydney';
      const type = args.type || 'rent';
      const bedrooms = args.bedrooms ? `${args.bedrooms} bedroom` : '';
      const maxPrice = args.max_price ? `under $${args.max_price}` : '';

      const action = type === 'buy' ? 'for sale' : 'for rent';
      const query = `${bedrooms} ${action} ${location} ${maxPrice} property listings`.trim();
      const domains = ['domain.com.au', 'realestate.com.au'];

      const cache = new ToolCache(env);
      const cached = await cache.get('domain', query, domains);
      if (cached) return cached;

      try {
        const data = await tavilySearch(query, tavilyKey, {
          maxResults: 10,
          depth: 'basic',
          rawContent: false,
          answer: false,
          includeDomains: domains,
        });

        const listings = (data.results || [])
          .filter(r => r.url?.includes('domain.com.au') || r.url?.includes('realestate.com.au'))
          .map(r => ({
            title: r.title || '',
            url: r.url || '',
            snippet: (r.snippet || '').substring(0, 600),
            source: r.url?.includes('domain.com.au') ? 'Domain' : 'REA',
          }))
          .slice(0, 8);

        const result = {
          location,
          type,
          bedrooms: args.bedrooms || 'any',
          max_price: args.max_price || 'any',
          results_count: listings.length,
          listings,
          source: 'Domain.com.au & Realestate.com.au via Tavily',
          tip: type === 'rent'
            ? 'Apply early! Rental competition in Australian cities is fierce. Bring ID, proof of income, and references to open inspections.'
            : 'Attend open inspections and check comparable sales in the area before making an offer.',
        };

        await cache.set('domain', query, domains, result, CACHE_TTL.DOMAIN_SEARCH);
        return result;
      } catch (err) {
        return { error: err.message, location, type };
      }
    }
  },

  // ─── Wave 2: 7 New Killer Features ─────────────────────────────────────────

  scam_detector: {
    name: 'scam_detector',
    description: 'Anti-scam identifier for Australia. Analyzes suspicious messages/URLs/calls against known scam patterns (ATO, toll, delivery, immigration, fake embassy, banking, rental, job, crypto scams). Especially tuned for Chinese community scams. arguments: { text: "suspicious message content", url: "suspicious URL" }',
    handler: async (args, env) => {
      const { analyzeScam } = await import('./scam-detector.js');
      return await analyzeScam(args, env);
    }
  },
  school_search: {
    name: 'school_search',
    description: 'Search Australian primary and secondary schools. Find school rankings (ICSEA/NAPLAN), catchment zones, selective school info, and enrollment tips. arguments: { query: "school name", suburb: "Chatswood", state: "NSW", type: "public"|"catholic"|"independent"|"selective", level: "primary"|"secondary" }',
    handler: async (args, env) => {
      const { searchSchool } = await import('./school.js');
      return await searchSchool(args, env);
    }
  },
  rental_assistant: {
    name: 'rental_assistant',
    description: 'Australian rental assistant. MODES: 1) "rights" — Tenant rights by state (NSW/VIC/QLD bond rules, notice periods, rent increase limits). 2) "cost" — Rental cost calculator (rent + utilities + bond breakdown). 3) "check" — Lease contract red-flag detector. 4) "median" — Real government median rent data by postcode (NSW 533 postcodes from Fair Trading, QLD 216 postcodes from RTA). arguments: { mode: "rights"|"cost"|"check"|"median", state: "NSW", weekly_rent: 500, text: "lease clause text", postcode: "2067", bedrooms: 2 }',
    handler: async (args, env) => {
      const { rentalAssistant } = await import('./rental.js');
      return await rentalAssistant(args, env);
    }
  },
  medicare: {
    name: 'medicare',
    description: 'Medicare/MBS fee lookup with rebate calculator. Search by MBS item number or service description. Returns Schedule Fee, Medicare rebate (100% GP / 85% specialist), gap payment, bulk billing rates and Safety Net info. Supports bulk bill guide mode. 15 common MBS items built-in (GP/specialist/psychologist/pathology/imaging/MRI). arguments: { item: "23", query: "GP consultation", service: "psychologist", mode: "bulk_bill", doctor_fee: 150 }',
    handler: async (args, env) => {
      const { lookupMedicare } = await import('./medicare.js');
      return await lookupMedicare(args, env);
    }
  },
  telco_compare: {
    name: 'telco_compare',
    description: 'Australian telco/mobile/NBN plan comparison (2026/03 data). MODES: type="mobile" — prepaid+postpaid SIM plans from Telstra/Optus/Vodafone/Lebara/Boost/amaysim/felix/Dodo etc. type="nbn" — NBN broadband plans (25/50/100/500/750/1000). type="tourist" — tourist SIM cards. type="student" — student plans+discounts (Vodafone Student, Dodo, UNiDAYS). type="lebara" — Lebara plans for free international calls to China/60 countries. type="annual" — 365-day long-expiry plans. Also auto-detects: needs containing "中国/china/lebara" → Lebara guide. arguments: { type: "mobile"|"nbn"|"tourist"|"student"|"lebara"|"annual", budget: 30, needs: "international calls to China", query: "search terms" }',
    handler: async (args, env) => {
      const { compareTelco } = await import('./telco.js');
      return await compareTelco(args, env);
    }
  },
  trs_refund: {
    name: 'trs_refund',
    description: 'Tourist Refund Scheme (TRS) assistant. GST refund guide for travellers leaving Australia. MODES: 1) "guide" — Full TRS rules, airport locations, common mistakes. 2) "calculate" — Calculate GST refund from purchase amount. arguments: { mode: "guide"|"calculate", amount: 1500 }',
    handler: async (args, env) => {
      const { trsAssistant } = await import('./trs.js');
      return await trsAssistant(args, env);
    }
  },
  trip_planner: {
    name: 'trip_planner',
    description: 'Australian trip planner. Generates multi-day itineraries for Sydney, Melbourne, Gold Coast with stops, timing, transport tips, and Chinese food area recommendations. arguments: { city: "sydney"|"melbourne"|"gold_coast", days: 3, interests: "food, nature", query: "family friendly" }',
    handler: async (args, env) => {
      const { planTrip } = await import('./trip-planner.js');
      return await planTrip(args, env);
    }
  },

  // ─── Wave 3: Free API Integrations ─────────────────────────────────────────

  abn_lookup: {
    name: 'abn_lookup',
    description: 'Australian Business Number (ABN) lookup & company search. Validates ABN checksums, retrieves business details from ABR (Australian Business Register). MODES: 1) "abn" — Look up by ABN/ACN number. 2) "name" — Search by business name. 3) "validate" — Validate ABN format. arguments: { abn: "51824753556", name: "Woolworths", mode: "abn"|"name"|"validate" }',
    handler: async (args, env) => {
      const { lookupABN } = await import('./abn-lookup.js');
      return await lookupABN(args, env);
    }
  },
  abs_stats: {
    name: 'abs_stats',
    description: 'Australian Bureau of Statistics (ABS) real-time economic data. Topics: CPI (inflation/通胀率), unemployment (失业率), wages (工资增长), population (人口). Uses official ABS SDMX API. arguments: { topic: "cpi"|"unemployment"|"wages"|"population", mode: "latest" }',
    handler: async (args, env) => {
      const { getABSStats } = await import('./abs-stats.js');
      return await getABSStats(args, env);
    }
  },
  air_quality: {
    name: 'air_quality',
    description: 'Real-time Air Quality Index (AQI) for Australian cities. Shows PM2.5, PM10, O3, NO2 levels with health advice. Covers Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin. Critical during bushfire season (Nov-Mar). arguments: { city: "sydney"|"melbourne"|"brisbane"|"perth"|etc }',
    handler: async (args, env) => {
      const { getAirQuality } = await import('./air-quality.js');
      return await getAirQuality(args, env);
    }
  },
  bom_warnings: {
    name: 'bom_warnings',
    description: 'Australian Bureau of Meteorology severe weather warnings. Covers bushfire 🔥, flood 🌊, cyclone 🌀, severe thunderstorm ⛈️, extreme heat 🌡️. Includes safety tips and emergency contacts. arguments: { state: "NSW"|"VIC"|"QLD"|"SA"|"WA"|"TAS"|"NT"|"ACT" }',
    handler: async (args, env) => {
      const { getBOMWarnings } = await import('./bom-warnings.js');
      return await getBOMWarnings(args, env);
    }
  },
  data_gov: {
    name: 'data_gov',
    description: 'Search 30,000+ Australian government open datasets from data.gov.au. Find any public data: housing, health, education, transport, environment, economy. arguments: { query: "rental prices Sydney", organization: "bureau-of-statistics" }',
    handler: async (args, env) => {
      const { searchDataGov } = await import('./data-gov.js');
      return await searchDataGov(args, env);
    }
  },
  fair_work_pay: {
    name: 'fair_work_pay',
    description: 'Australian minimum wage & industry award pay rates from Fair Work Commission. Covers retail, hospitality, fast food, cleaning, warehouse, childcare, construction, nursing, IT. Includes casual loading, penalty rates, junior rates, and wage theft prevention. arguments: { query: "retail"|"hospitality"|"fast food"|"cleaning"|"construction"|"nursing", mode: "minimum"|"search", age: 17 }',
    handler: async (args, env) => {
      const { getPayRates } = await import('./fair-work.js');
      return await getPayRates(args, env);
    }
  },
  // energy_plans merged into energy_compare — redirect for backward compatibility
  energy_plans: {
    name: 'energy_plans',
    description: '(merged into energy_compare)',
    handler: async (args, env) => {
      // Redirect to energy_compare which now tries CDR API first
      return await TOOL_REGISTRY.energy_compare.handler(args, env);
    }
  },
  crawl_page: {
    name: 'crawl_page',
    description: 'Crawl any web page and extract content as Markdown using Cloudflare Browser Rendering. Use when you need to read a specific URL for fresh data (government sites, transport updates, news). arguments: { url: "https://example.com", urls: ["url1","url2"] }. Returns page title + markdown content. Supports JS-rendered pages.',
    handler: async (args, env) => {
      const { crawlPage, crawlPages } = await import('./cf-crawl.js');
      if (args.urls && Array.isArray(args.urls)) {
        return await crawlPages(args.urls, env, { maxLength: 2000 });
      }
      const url = args.url || args.query;
      if (!url) return { error: 'Please provide a url to crawl' };
      return await crawlPage(url, env, { maxLength: 3000 });
    }
  },
  translator: {
    name: 'translator',
    description: 'Chinese↔English translator with 8 scenario phrasebooks (GP/pharmacy/bank/rental/police/government/emergency/shopping). Modes: translate text, or get pre-built phrases for common Australian scenarios. arguments: { text: "要翻译的文字", mode: "auto"|"zh2en"|"en2zh"|"scenario", scenario: "gp"|"bank"|"rental"|"police"|"government"|"emergency"|"pharmacy"|"shopping" }',
    handler: async (args, env) => {
      const { translate } = await import('./translator.js');
      return await translate(args, env);
    }
  },
  insurance_compare: {
    name: 'insurance_compare',
    description: 'Australian insurance comparison: car (CTP/comprehensive/third-party), home & contents, renters insurance, travel insurance, pet insurance. Built-in provider data + live crawl. arguments: { type: "car"|"home"|"travel"|"pet"|"overview", state: "NSW" }. For 保险/车险/租客保险/旅行保险/CTP/Green Slip/home insurance/宠物保险.',
    handler: async (args, env) => {
      const { compareInsurance } = await import('./insurance.js');
      return await compareInsurance(args, env);
    }
  },
  youtube_search: {
    name: 'youtube_search',
    description: 'Search YouTube for Australian life videos, vlogs, guides. Returns video titles, links, thumbnails. arguments: { query: "澳洲租房攻略", category: "visa"|"rental"|"study"|"food"|"travel"|"driving"|"work"|"finance" }. For 视频/YouTube/攻略视频/vlog/教程.',
    handler: async (args, env) => {
      const { searchYouTubeVideos } = await import('./youtube.js');
      return await searchYouTubeVideos(args, env);
    }
  },
  gp_finder: {
    name: 'gp_finder',
    description: 'Enhanced GP/doctor finder. ACTIONS: 1) "find_gp" — search GP by location via HotDoc. 2) "chinese_gp" — find Chinese-speaking GP. 3) "drug_interaction" — check drug interactions {drug_a, drug_b}. 4) "mental_health" — crisis lines + Medicare treatment plan guide. 5) "dentist" — dental care guide + search. 6) "eye" — eye care guide. 7) "guide" — GP visit/dental/eye step-by-step guide. arguments: { action, location, specialty, bulk_billing, chinese_speaking, drug_a, drug_b, topic }',
    handler: async (args, env) => {
      const { enhancedGPFinder } = await import('./gp-finder.js');
      return await enhancedGPFinder(args, env);
    }
  },
  finance_tools: {
    name: 'finance_tools',
    description: 'Enhanced finance tools. ACTIONS: 1) "mortgage" — mortgage calculator with LMI/stamp duty/upfront costs {price, deposit, rate, years, state, first_home}. 2) "first_home" — First Home Buyer grants (FHOG/FHSS/Home Guarantee) by state. 3) "super" — Super fund comparison (8 funds, fees/returns) {balance}. 4) "tax_guide" — Tax filing step-by-step guide {topic: "rate"|"deduction"}. 5) "accountant" — Chinese tax agent recommendations {city}. For 房贷计算/mortgage/首套房/首次购房/home loan/Super基金/养老金比较/报税/怎么报税/退税/会计/税务师/Tax Agent.',
    handler: async (args, env) => {
      const { financeTools } = await import('./finance-tools.js');
      return await financeTools(args, env);
    }
  },
};

/**
 * Execute a tool call
 */
export async function executeTool(toolName, args, env) {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);

  // Retry once on transient errors (network, timeout, proto parse, 5xx)
  const MAX_RETRIES = 1;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await tool.handler(args, env);

      // Check if the tool itself returned an error object
      if (result?.error && attempt < MAX_RETRIES) {
        const errMsg = String(result.error).toLowerCase();
        const isTransient = /timeout|network|fetch|econnreset|proto|503|502|429|rate.?limit|temporarily/i.test(errMsg);
        if (isTransient) {
          console.log(`[Tool] ${toolName} transient error on attempt ${attempt + 1}, retrying in 500ms: ${result.error}`);
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
      }

      return result;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.log(`[Tool] ${toolName} threw on attempt ${attempt + 1}, retrying in 500ms: ${err.message}`);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
}
