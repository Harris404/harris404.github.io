/**
 * Intent Agent - LLM 意图分析器 (Cloudflare Worker 版)
 * 支持位置感知、多轮上下文
 */

import { TOOL_REGISTRY } from './tools/index.js';

const SYSTEM_PROMPT = `You are an intent analysis agent. Analyze user messages, determine data sources to query.

TOOLS (use ONLY these):
1. weather → get_weather | {location:"Sydney"} | Australian weather/forecast
2. tax_calculator → calculate_tax | {gross_income:100000} | income tax calculation
3. exchange_rate → convert_currency | {amount:100,from_currency:"AUD",to_currency:"CNY"} | currency convert
4. medicine → search_medicine | {query:"paracetamol"} | drug info. Translate Chinese→English
5. postcodes → search_postcode | {query:"2000"} | Australian postcode lookup
6. education → search_courses | {query:"University of Sydney"} | courses/university
7. healthcare → search_facilities | {facility_type:"pharmacy",location:"Sydney"} | medical facilities (gp/hospital/pharmacy/dentist/physiotherapist)
8. maps_assistant → search_maps | {mode:"nearby",query:"coffee shop",latitude:-33.87,longitude:151.21} OR {mode:"directions",origin:"Central Station",destination:"UNSW",travel_mode:"transit"} | Unified maps tool. mode "nearby" finds places nearby (GPS or city). mode "directions" gives route planning (transit/driving/walking/cycling).
9. public_transport → search_public_transport | {state:"NSW"|"QLD"|"VIC"|"SA"|"WA"|"TAS"|"NT"|"ACT",type:"departures",stop_name:"Central Station",mode:"train"} | ALL Australian public transport. Real-time API: NSW (Opal), QLD (Go card), VIC (myki — train/tram/bus), SA (metroCARD). Web search: WA (SmartRider), TAS (Greencard), NT, ACT (MyWay). type: "departures" or "alerts". VIC supports mode: train|tram|bus|regional.
10. web_search → search | {query:"australia news"} | Web search for: news, latest info, price comparisons, product info, current events, guides, "how to", or anything requiring web lookup — NOT for supermarket specials
11. supermarket_assistant → search_supermarket | {mode:"specials",store:"woolworths"} OR {mode:"product_search",query:"milk",store:"all"} | Supermarkets, pharmacies & retail. mode "specials" gets weekly deals (特价/打折/半价). mode "product_search" gets specific product prices (多少钱/怎么买). store: woolworths|coles|aldi|iga|chemistwarehouse|priceline|bigw|kmart|all|pharmacy|retail|everything.
12. fuel_prices → get_fuel_prices | {state:"NSW",fuel_type:"U91"} | petrol prices
13. public_holidays → get_holidays | {state:"NSW",year:2026} | public holidays
14. property → search_property | {location:"Sydney",type:"rent"} | rental/property prices (type: "rent" or "buy")
15. jobs → search_jobs | {query:"software engineer",location:"Sydney"} | job search & salary guide
16. centrelink → calculate_centrelink | {query:"jobseeker",situation:"single",income:0} | welfare/Centrelink payments
17. energy_compare → compare_energy | {location:"Sydney",type:"electricity"} | electricity/gas price comparison
18. bank_rates → get_bank_rates | {query:"mortgage",amount:500000} | bank rates (mortgage/savings/term deposit)
19. oshc → calculate_oshc | {cover_type:"single",duration_months:12} | OSHC health insurance premium calculator for international students.
20. aqf → get_aqf_info | {level:7} | Australian Qualifications Framework reference.
21. hotdoc → search_hotdoc | {specialty:"gp",location:"Zetland NSW",bulk_billing:true} | Find GP/dentist/physio appointments via HotDoc. For 看医生/预约/挂号/book GP/dentist.
22. domain_search → search_domain | {location:"Zetland NSW",type:"rent",bedrooms:2,max_price:600} | Search live rental & property listings from Domain.com.au. Use for specific rental/property listings, open inspection times. Different from property tool which gives market-level prices.
23. emergency_info → get_emergency_info | {category:"all"} OR {category:"consulate",state:"NSW"} | Australian emergency contacts (000, Lifeline, Beyond Blue, Chinese consulates, translation services TIS 131450). Use for 紧急/emergency/求助/报警/领事馆/consulate/心理危机/crisis.
24. vehicle → search_vehicle | {mode:"rego",plate:"ABC123",state:"NSW"} OR {mode:"valuation",make:"Toyota",model:"Corolla",year:2018} | Vehicle rego check and used car valuation. For 买车/卖车/二手车/rego/估价/registration/car price.
25. visa_info → search_visa | {subclass:"500"} OR {query:"student visa processing time"} | Australian visa processing times and info. For 签证/visa/审理/processing time/移民/immigration/485/189/190.
26. events → search_events | {city:"Sydney",category:"free",when:"this weekend"} | Local events, markets, festivals, concerts. For 活动/市集/周末/what's on/things to do/演唱会/festival.
27. scam_detector → analyze_scam | {text:"suspicious message content"} OR {url:"suspicious URL"} | Anti-scam identifier. Analyzes suspicious messages/URLs/calls against known patterns (ATO, toll, delivery, immigration, fake embassy, banking, rental, job, crypto scams). For 诈骗/骗子/scam/可疑/suspicious/fake/ATO来电/toll短信.
28. school_search → search_school | {suburb:"Chatswood",state:"NSW"} OR {query:"selective schools Sydney"} OR {postcode:"2067",min_icsea:1100} | Australian K-12 school search with 9,755 schools from ACARA. ICSEA ratings, NAPLAN info, selective schools, catchment zones. For 学校/小学/中学/学区/ICSEA/NAPLAN/选校/精英学校/selective school.
29. rental_assistant → rental_assist | {mode:"rights",state:"NSW"} OR {mode:"cost",weekly_rent:500} OR {mode:"check",text:"clause"} OR {mode:"median",postcode:"2067",bedrooms:2} | Tenant rights by state, rental cost calculator, lease red-flag checker, AND real government median rent data (NSW 533 postcodes + QLD 216 postcodes). For 租客权利/租金查询/中位租金/合同检查/bond/涨租/median rent/rental cost.
30. medicare → lookup_medicare | {item:"23"} OR {query:"GP consultation fee"} OR {mode:"bulk_bill"} | Medicare/MBS fee lookup. 15 common item numbers built-in. Returns rebate amount, gap payment, bulk billing info. For Medicare/看病费用/报销/MBS/gap payment/bulk billing/自费.
31. telco_compare → compare_telco | {type:"mobile",budget:30} OR {type:"nbn"} OR {type:"tourist"} OR {needs:"international calls to China"} | Mobile/NBN plan comparison. Prepaid, postpaid, tourist SIM, student plans, Lebara/international calls. For 手机卡/SIM卡/电话套餐/NBN/宽带/流量/话费/tourist SIM/打电话回中国.
32. trs_refund → trs_assist | {mode:"guide"} OR {mode:"calculate",amount:1500} | Tourist Refund Scheme. GST refund for departing travellers. For 退税/TRS/GST refund/离境退税/机场退税/tourist refund.
33. trip_planner → plan_trip | {city:"sydney",days:3} OR {city:"melbourne",interests:"food, nature"} | Multi-day itineraries for Australian cities with Chinese food area recommendations. For 旅游攻略/几日游/行程/itinerary/travel plan/去哪玩.
34. abn_lookup → lookup_abn | {abn:"51824753556"} OR {name:"Woolworths"} | ABN/ACN lookup & business name search via Australian Business Register (ABR). Validates ABN checksums, shows GST status. For ABN查询/公司查询/注册公司/ABN验证/company search/ACN/生意.
35. abs_stats → get_abs_stats | {topic:"cpi"} OR {topic:"unemployment"} OR {topic:"wages"} | ABS economic statistics — real-time CPI (通胀率), unemployment rate (失业率), wage growth (工资增长), population (人口). For 通胀/CPI/失业率/unemployment/经济数据/工资增长/人口统计.
36. air_quality → get_air_quality | {city:"sydney"} | Real-time Air Quality Index (AQI). PM2.5/PM10/O3 levels with health advice. Key during bushfire season. For 空气质量/AQI/PM2.5/雾霾/空气污染/bushfire smoke/air quality/能不能户外运动.
37. bom_warnings → get_bom_warnings | {state:"NSW"} | BOM severe weather warnings: bushfire/flood/cyclone/storm/heatwave. Safety tips & emergency contacts. For 天气预警/山火/洪水/台风/禁火/极端天气/severe weather/bushfire warning/flood warning/热浪.
38. data_gov → search_data_gov | {query:"rental prices"} | Search data.gov.au 30,000+ open datasets. Government housing, health, education, transport, economy data. For 政府数据/开放数据/statistics/data download/dataset/统计数据.
39. fair_work_pay → get_pay_rates | {query:"retail"} OR {mode:"minimum"} OR {age:17} | Fair Work minimum wage & award pay rates for 9 industries (retail/hospitality/fast food/cleaning/construction/nursing/IT). Casual loading, penalty rates, junior rates. For 最低工资/时薪/pay rate/minimum wage/加班费/penalty rate/工资多少/欠薪/给多少钱/award rate/casual 加载.
40. energy_plans → get_energy_plans | {state:"NSW",fuel:"ELECTRICITY"} OR {retailer:"agl"} | REAL electricity & gas plans from 10 major retailers via AER CDR API. AGL/Origin/EnergyAustralia/Alinta/Red Energy/Simply/Lumo. For 电费计划/electricity plan/换电力公司/energy plan/gas plan/AGL/Origin/电费对比/power bill.
41. crawl_page → crawl_url | {url:"https://example.gov.au/info"} OR {urls:["url1","url2"]} | Crawl any web page and extract content as Markdown. Use when user provides a specific URL or when you need fresh data from a government/official website. Returns page title + markdown content. For 读取网页/打开链接/查看网站内容.
42. translator → translate | {text:"要翻译的文字"} OR {mode:"scenario",scenario:"gp"} | Chinese↔English translator with 8 scenario phrasebooks. Scenarios: gp, pharmacy, bank, rental, police, government, emergency, shopping. For 翻译/translate/怎么说/how to say/看医生英文/看病翻译/去银行怎么说.
43. insurance_compare → compare_insurance | {type:"car",state:"NSW"} OR {type:"travel"} OR {type:"overview"} | Insurance comparison: car (CTP/comprehensive/third-party), home & contents, renters, travel, pet insurance. For 保险/车险/CTP/Green Slip/租客保险/旅行保险/contents insurance/宠物保险.
45. youtube_search → search_youtube | {query:"澳洲租房攻略"} OR {query:"Melbourne food",category:"food"} | Search YouTube for Australian life videos, vlogs, travel guides, tutorials. Returns video links + thumbnails. For 视频/YouTube/攻略视频/vlog/教程/有没有相关视频.
46. gp_finder → find_gp | {action:"find_gp",location:"Chatswood",bulk_billing:true} OR {action:"chinese_gp",location:"Sydney"} OR {action:"drug_interaction",drug_a:"paracetamol",drug_b:"ibuprofen"} OR {action:"mental_health"} OR {action:"dentist",location:"Melbourne"} OR {action:"eye"} OR {action:"guide",topic:"gp"} | Enhanced healthcare finder. Chinese-speaking GP search, bulk billing filter, drug interaction checker, mental health crisis resources + Medicare plan guide, dental/eye care guide. For 中文GP/说中文的医生/bulk billing/看牙/牙医/配眼镜/验光/吃药冲突/药物交互/Panadol能和Nurofen一起吃吗/心理健康/抑郁/焦虑/看GP怎么看/怎么看医生.
47. finance_tools → finance | {action:"mortgage",price:800000,deposit:160000,state:"NSW"} OR {action:"first_home"} OR {action:"super",balance:50000} OR {action:"tax_guide"} OR {action:"accountant",city:"sydney"} | Enhanced finance: mortgage calculator (LMI/stamp duty/upfront costs), first home buyer grants (FHOG/FHSS/Home Guarantee per state), Super fund comparison (8 funds), tax filing step-by-step, Chinese tax agent recommendations. For 房贷计算/mortgage calculator/首套房/首次购房/home loan/每月还多少/Super基金/养老金比较/报税/怎么报税/退税/会计/税务师/accountant.

RAG categories: government/ato, government/visa, government/centrelink, government/housing, government/education, government/fair-work, government/healthcare, government/medicare, government/banking, government/super, government/transport, government/living, government/consumer, government/scams, government/licensing, living/telco, living/driving, living/citizenship, living/pets, living/insurance
Use RAG for: visa details (government/visa), tax/ATO queries (government/ato), Centrelink/welfare (government/centrelink), rental/housing (government/housing), courses/study (government/education), work rights/Fair Work (government/fair-work), health system/Medicare (government/healthcare, government/medicare), banking/superannuation (government/banking, government/super), transport (government/transport), daily life (government/living), consumer rights (government/consumer), telco/mobile/NBN plans (living/telco), driving/licence/road rules (living/driving, government/licensing), citizenship test/入籍 (living/citizenship), pets import/养宠物 (living/pets), insurance/car insurance/home insurance (living/insurance), scam prevention (government/scams), White Card/RSA/WWCC/工作许可 (government/licensing).

OUTPUT: JSON only, no markdown, no code fences.
{"intents":["intent"],"language":"zh|en","tool_calls":[{"tool":"name","args":{}}],"rag_categories":[],"resolved_query":"clear question","reasoning":"brief"}

RULES:
1. **ALL args MUST be in English.** You are the translator. Convert ALL Chinese/non-English values to English:
   - City names: 墨尔本→Melbourne, 悉尼→Sydney, 布里斯班→Brisbane, 珀斯→Perth, etc.
   - Place queries: 咖啡厅→coffee shop, 超市→supermarket, 药房→pharmacy, etc.
   - Job titles: 程序员→software engineer, 会计→accountant, 护士→nurse, etc.
   - Medicine: 扑热息痛→paracetamol, 布洛芬→ibuprofen, 感冒药→cold and flu, etc.
   - States: 新南威尔士→NSW, 维多利亚→VIC, 昆士兰→QLD, etc.
   - ANY non-English text in args → translate to English.
2. "万"=×10000 (10万=100000)
3. No tool matches → tool_calls=[], use rag_categories
4. Default location: Sydney
5. "language" = user's input language (zh or en, based on what the user wrote)
6. Use conversation history for context (e.g. "那墨尔本呢" after weather → Melbourne weather)
7. For general search/news/latest info queries → use web_search
8. For supermarket/pharmacy/retail queries (both "特价/半价/specials" OR specific product price lookup "how much is X" / "X多少钱") → use supermarket_assistant
9. For property/rent/buy house → use property
10. For job/salary/career → use jobs
11. For welfare/centrelink/benefit → use centrelink
12. For "附近/nearby/周围/推荐/找/find" + place type OR "怎么去/directions/route" → use maps_assistant (mode="nearby" or mode="directions")
13. If user_location is provided in context, use coords for maps_assistant AND as origin for directions
14. For "看医生/预约/挂号/book GP/dentist/physio" → use hotdoc
15. For specific rental listings / "找房子/租房子/open inspection/房源" + suburb name → use domain_search
16. For "紧急/emergency/报警/000/领事馆/consulate/心理危机/crisis/求助/Lifeline/翻译/interpreter" → use emergency_info
17. For "买车/卖车/二手车/rego/车辆注册/car registration/used car/估价/valuation/redbook" → use vehicle
18. For "签证/visa/审理时间/processing time/移民/immigration/485/189/190/500/工签" → use visa_info
19. For "活动/市集/周末玩/what's on/things to do/演唱会/concert/festival/展览/event" → use events
20. For "诈骗/骗子/scam/可疑链接/suspicious/fake/ATO电话/toll短信/假冒/phishing" → use scam_detector. If user pastes a message or URL asking if it's legit → scam_detector
21. For "学校/小学/中学/幼儿园/学区/school/ICSEA/NAPLAN/selective/精英学校/catchment/选校" → use school_search. If asking about K-12 schools (not university) → school_search
22. For "租客权利/租金多少/中位租金/median rent/合同检查/lease check/bond退还/涨租" → use rental_assistant. For government median rent data by postcode → {mode:"median",postcode:"XXXX"}. For cost calculation → {mode:"cost",weekly_rent:500}. For lease clause checking → {mode:"check",text:"..."}.
23. For "Medicare/看病多少钱/GP费用/specialist费用/MBS/rebate/报销/gap payment/bulk billing/自费" → use medicare
24. For "手机卡/SIM卡/电话套餐/NBN/宽带/流量/话费/打电话回中国/tourist SIM/学生套餐/Lebara" → use telco_compare
25. For "退税/TRS/GST refund/离境退税/机场退税/tourist refund/免税" → use trs_refund
26. For "旅游攻略/几日游/行程规划/itinerary/去哪玩/travel plan/自驾游/road trip" → use trip_planner. Different from events (single events) — trip_planner is for multi-day itineraries.
27. For "ABN/ACN/公司查询/注册公司/company search/business name/查公司/验证ABN/GST注册/ABN lookup" → use abn_lookup. If user gives 11-digit number → {abn:"..."}. If user gives company name → {name:"..."}.
28. For "CPI/通胀率/inflation/失业率/unemployment/经济数据/工资增长/wage growth/人口/population/Australian economy" → use abs_stats. Topic: cpi|unemployment|wages|population.
29. For "空气质量/AQI/PM2.5/雾霾/空气污染/bushfire smoke/air quality/能不能去户外/outdoor exercise/山火烟雾" → use air_quality. Especially important during bushfire season (Nov-Mar).
30. For "天气预警/山火预警/洪水预警/台风/热浪/禁火/bushfire warning/flood warning/cyclone/severe weather/storm warning/heatwave/极端天气" → use bom_warnings. Different from weather (forecast) — bom_warnings is for active emergency warnings.
31. For "政府数据/开放数据/统计数据/data download/government data/data.gov.au/search dataset" → use data_gov. For specific economic stats (CPI/unemployment) use abs_stats instead.
32. For "最低工资/时薪多少/pay rate/minimum wage/加班费/penalty rate/工资标准/award rate/casual loading/欠薪/被削/underpaid/工作时薪" → use fair_work_pay.
33. For "电费计划/electricity plan/电费对比/energy plan/换电力公司/power bill/gas plan/AGL/Origin/EnergyAustralia/电费多少/electricity cost" → use energy_plans. For actual plan data. Different from energy_compare (built-in rate comparison).`;

export class IntentAgent {
  constructor(llm) {
    this.llm = llm;
  }

  async analyze(message, history = [], context = {}) {
    // Build context-aware user message
    let userContent = message;

    // Inject location context if available
    if (context.latitude && context.longitude) {
      userContent += `\n[USER_LOCATION: lat=${context.latitude}, lng=${context.longitude}]`;
    }
    // Inject preference context
    if (context.preferenceHint) {
      userContent += `\n[USER_CONTEXT: ${context.preferenceHint}]`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10),
      { role: 'user', content: userContent }
    ];

    const start = Date.now();

    try {
      const result = await this.llm.chatJSON(messages, {
        temperature: 0.1,
        maxTokens: 300,
        timeout: 15000
      });

      const validated = this._validate(result, message, context);
      return { ...validated, agent_time_ms: Date.now() - start };
    } catch (err) {
      console.error('Intent analysis failed:', err.message);
      return { ...this._fallback(message, context), agent_time_ms: Date.now() - start };
    }
  }

  // ─── Shared helpers ──────────────────────────────────────────────

  /** Australian city name regex (shared across validate + fallback) */
  static CITY_RE = /\b(Melbourne|Sydney|Brisbane|Perth|Adelaide|Canberra|Hobart|Darwin|Gold Coast|Cairns|Newcastle|Townsville|Geelong|Wollongong)\b/i;

  /** Auto-inject GPS coordinates into tool args when applicable */
  _injectGPS(call, context) {
    if (!context.latitude || !context.longitude) return;
    call.args = call.args || {};
    if (call.tool === 'maps_assistant') {
      if (!call.args.latitude) call.args.latitude = context.latitude;
      if (!call.args.longitude) call.args.longitude = context.longitude;
      // For directions mode, set origin from GPS if not present
      if (call.args.mode === 'directions' && !call.args.origin && !call.args.from) {
        call.args.origin = `${context.latitude},${context.longitude}`;
      }
    }
  }

  /** Extract income amount from message (handles 万 notation) */
  _extractIncome(message) {
    const wanMatch = message.match(/(\d+)\s*万/);
    if (wanMatch) return parseInt(wanMatch[1]) * 10000;
    const numMatch = message.match(/(\d{4,})/);
    return numMatch ? parseInt(numMatch[1]) : 0;
  }

  // ─── Validation ─────────────────────────────────────────────────

  _validate(result, message, context = {}) {
    const validated = {
      intents: Array.isArray(result.intents) ? result.intents : ['general'],
      language: result.language === 'en' ? 'en' : 'zh',
      tool_calls: [],
      rag_categories: Array.isArray(result.rag_categories) ? result.rag_categories : [],
      resolved_query: result.resolved_query || message,
      reasoning: result.reasoning || ''
    };

    const validTools = new Set(Object.keys(TOOL_REGISTRY));

    if (Array.isArray(result.tool_calls)) {
      for (const call of result.tool_calls) {
        if (call?.tool && validTools.has(call.tool)) {
          this._injectGPS(call, context);
          validated.tool_calls.push({ tool: call.tool, args: call.args || {} });
        }
      }
    }

    // Rescue: if LLM returned 0 tool calls but message/intents clearly match a pattern, inject
    if (validated.tool_calls.length === 0) {
      this._rescueToolCalls(validated, message, context);
    }

    return validated;
  }

  /**
   * Rescue missing tool calls by matching keyword patterns.
   * Separated from _validate for readability. Mutates `validated` in-place.
   */
  _rescueToolCalls(validated, message, context) {
    const lower = message.toLowerCase();
    const intentSet = new Set(validated.intents.map(i => i.toLowerCase()));
    const hasGPS = !!(context.latitude && context.longitude);
    const defaultCity = context.home_city || 'Sydney';

    // Ordered rescue rules (first match wins)
    const rescueRules = [
      // GPS nearby → maps_assistant mode=nearby
      {
        test: () => (/附近|nearby|周围|旁边|推荐餐厅|好吃的|哪里吃|close by/.test(lower) || intentSet.has('nearby') || intentSet.has('maps_assistant')) && hasGPS,
        apply: () => ({ tool: 'maps_assistant', args: { mode: 'nearby', latitude: context.latitude, longitude: context.longitude, query: message, radius: 1500 }, tag: 'nearby-gps' })
      },
      // City-mode nearby → maps_assistant mode=nearby (no GPS)
      {
        test: () => /附近|nearby|周围|推荐|coffee|restaurant|咖啡|餐厅|吃饭|购物|shopping|药房|pharmacy|超市|supermarket/.test(lower) || intentSet.has('nearby') || intentSet.has('places') || intentSet.has('maps_assistant'),
        apply: () => {
          const locMatch = message.match(/([A-Za-z\u4e00-\u9fff]+(?:\s+CBD)?)(?:\s*附近|\s*周围)/i);
          return { tool: 'maps_assistant', args: { mode: 'nearby', query: message, location: locMatch?.[1]?.trim() || defaultCity }, tag: 'nearby-city' };
        }
      },
      // Weather
      {
        test: () => /天气|weather|气温|forecast/.test(lower) || intentSet.has('weather'),
        apply: () => ({ tool: 'weather', args: { location: (message.match(IntentAgent.CITY_RE) || [])[1] || defaultCity }, tag: 'weather' })
      },
      // Exchange rate
      {
        test: () => /汇率|exchange|澳元|AUD|CNY|人民币/.test(lower) || intentSet.has('exchange_rate') || intentSet.has('exchange'),
        apply: () => {
          const numMatch = message.match(/(\d+)/);
          return { tool: 'exchange_rate', args: { amount: numMatch ? parseInt(numMatch[1]) : 100, from_currency: 'AUD', to_currency: 'CNY' }, tag: 'exchange' };
        }
      },
      // Tax
      {
        test: () => /税|tax|income/.test(lower) || intentSet.has('tax') || intentSet.has('tax_calculator'),
        apply: () => {
          const income = this._extractIncome(message);
          return income > 0 ? { tool: 'tax_calculator', args: { gross_income: income }, tag: 'tax' } : { tag: 'tax' };
        }
      },
      // Domain Search (specific rental/property LISTINGS — must be BEFORE property)
      // Catches queries about finding actual listings, apartments for rent, open inspections
      {
        test: () => /房源|找房子|租房子|找房|open inspection|出租房|listing|找租|找公寓|apartment|rent.*near|找.*rent/.test(lower) || intentSet.has('domain_search'),
        apply: () => {
          const city = (message.match(IntentAgent.CITY_RE) || [])[1] || defaultCity;
          return { tool: 'domain_search', args: { location: city, type: /买房|buy|for sale/.test(lower) ? 'buy' : 'rent' }, tag: 'domain_search' };
        }
      },
      // Property (general market prices and trends — NOT specific listings)
      {
        test: () => /房价|买房|property|house price|市场|均价|中位价|median.*price/.test(lower) || intentSet.has('property'),
        apply: () => ({ tool: 'property', args: { location: defaultCity, type: /买房|房价|buy/.test(lower) ? 'buy' : 'rent' }, tag: 'property' })
      },
      // HotDoc appointment
      {
        test: () => /预约|挂号|看医生|看牙|看GP|book.*(?:gp|doctor|dentist|physio)|appointment/.test(lower) || intentSet.has('hotdoc'),
        apply: () => {
          const specialty = /牙|dentist|dental/.test(lower) ? 'dentist' : /physio|理疗/.test(lower) ? 'physio' : /心理|psycho/.test(lower) ? 'psychologist' : 'gp';
          const city = (message.match(IntentAgent.CITY_RE) || [])[1] || defaultCity;
          const bulkBilling = /bulk.?bill|免费|报销|medicare/.test(lower);
          return { tool: 'hotdoc', args: { specialty, location: city, bulk_billing: bulkBilling }, tag: 'hotdoc' };
        }
      },
      // Jobs
      {
        test: () => /工作|job|career|薪资|找工/.test(lower) || intentSet.has('jobs'),
        apply: () => ({ tool: 'jobs', args: { query: message, location: defaultCity }, tag: 'jobs' })
      },
      // Directions → maps_assistant mode=directions (MUST be before public_transport!)
      {
        test: () => /怎么去|如何前往|路线|怎么走|怎进|从.*到|how to get|how do i get|directions to|route to|navigate to|way to get/.test(lower) || intentSet.has('directions'),
        apply: () => {
          const destMatch = message.match(/(?:去|前往|到|get to|to|navigate to)\s*([^，,。\n?!]{2,40})/i);
          const dest = destMatch?.[1]?.trim() || message;
          const origin = hasGPS ? `${context.latitude},${context.longitude}` : (defaultCity || 'current location');
          return { tool: 'maps_assistant', args: { mode: 'directions', origin, destination: dest, travel_mode: 'transit' }, tag: 'directions' };
        }
      },
      // Public Transport rescue — departures/alerts (NOT directions)
      {
        test: () => !/怎么去|如何前往|路线|怎么走|从.*到|how to get|directions/.test(lower) && (/translink|qld|nsw|bus|train|tram|ferry|transport|delay|公交|地铁|火车|发车|晚点|公交卡|opal|go card/.test(lower) || intentSet.has('public_transport')),
        apply: () => {
          const type = /中断|停运|disruption|alert|delay|延误|delays|service|故障|问题/.test(lower) ? 'alerts' : 'departures';
          const state = /布里斯班|黄金海岸|昆士兰|brisbane|gold coast|qld|seq|cns/.test(lower) ? 'QLD' : 'NSW';

          let args = { state, type };
          if (state === 'NSW') {
            args.stop_name = (message.match(/(?:到|在|去|从|from|to)\s*([A-Za-z\u4e00-\u9fff]+\s*(?:station|火车站|站))/i) || [])[1] || 'Central Station';
          } else {
            const mode = /bus|巴士|公交/.test(lower) ? 'bus' : /train|rail|火车/.test(lower) ? 'rail' : /tram|glink|轻轨/.test(lower) ? 'tram' : /ferry|渡轮/.test(lower) ? 'ferry' : null;
            args.region = 'seq';
            if (mode && type === 'departures') args.transport_mode = mode;
          }
          return { tool: 'public_transport', args, tag: `transport-${state}-${type}` };
        }
      },
      // Emergency info
      {
        test: () => /紧急|emergency|报警|000|领事馆|consulate|大使馆|embassy|心理危机|crisis|Lifeline|求助|翻译热线|interpreter|131\s*450/.test(lower) || intentSet.has('emergency_info'),
        apply: () => {
          let category = 'all';
          if (/领事馆|consulate|大使馆|embassy/.test(lower)) category = 'consulate';
          else if (/心理|mental|crisis|lifeline|beyondblue|自杀|depression|焦虑/.test(lower)) category = 'mental_health';
          else if (/翻译|interpreter|131\s*450|TIS/.test(lower)) category = 'translation';
          else if (/000|报警|fire|ambulance|急救/.test(lower)) category = 'emergency';
          return { tool: 'emergency_info', args: { category }, tag: 'emergency' };
        }
      },
      // Vehicle — rego check + car valuation
      {
        test: () => /买车|卖车|二手车|rego|注册查|registration check|used car|估价|valuation|redbook|carsales|carsguide|车辆/.test(lower) || intentSet.has('vehicle'),
        apply: () => {
          const isRego = /rego|注册|registration/.test(lower);
          if (isRego) {
            const plateMatch = message.match(/([A-Z]{2,3}\s?\d{2,3}\s?[A-Z]{2,3})/i);
            return { tool: 'vehicle', args: { mode: 'rego', plate: plateMatch?.[1] || '', state: defaultCity?.includes('Melbourne') ? 'VIC' : 'NSW' }, tag: 'vehicle' };
          }
          const carMatch = message.match(/(?:toyota|mazda|honda|hyundai|kia|subaru|volkswagen|bmw|audi|nissan|ford|holden|mitsubishi)\s+(\w+)/i);
          return { tool: 'vehicle', args: { mode: 'valuation', make: carMatch?.[0]?.split(/\s/)[0] || '', model: carMatch?.[1] || '' }, tag: 'vehicle' };
        }
      },
      // Visa processing times
      {
        test: () => /签证|visa|审理|processing time|移民|immigration|485|189|190|491|500签|工签|配偶签|父母签|subclass/.test(lower) || intentSet.has('visa_info'),
        apply: () => {
          const subMatch = message.match(/(?:subclass\s*)?(\d{3})/);
          const subclass = subMatch?.[1] || '';
          return { tool: 'visa_info', args: subclass ? { subclass } : { query: message }, tag: 'visa' };
        }
      },
      // Events — local events, markets, festivals
      {
        test: () => /活动|市集|what.?s on|things to do|周末.*玩|演唱会|concert|festival|展览|exhibition|夜市|night market|event/.test(lower) || intentSet.has('events'),
        apply: () => {
          let city = defaultCity || 'Sydney';
          let category = '';
          if (/市集|market|夜市/.test(lower)) category = 'markets';
          else if (/演唱会|concert|音乐/.test(lower)) category = 'music';
          else if (/展览|exhibition|art|gallery/.test(lower)) category = 'art';
          else if (/免费|free/.test(lower)) category = 'free';
          else if (/美食|food/.test(lower)) category = 'food';
          return { tool: 'events', args: { city, category: category || 'free', when: 'this weekend' }, tag: 'events' };
        }
      },
    ];

    for (const rule of rescueRules) {
      if (rule.test()) {
        const result = rule.apply();
        if (result.tool) {
          validated.tool_calls.push({ tool: result.tool, args: result.args });
        }
        validated.reasoning += ` [rescued: ${result.tag}]`;
        break; // First match wins
      }
    }
  }

  _fallback(message, context = {}) {
    const lower = message.toLowerCase();
    const intents = [];
    const toolCalls = [];
    const ragCategories = [];

    // --- Multi-turn context resolution ---
    // For short follow-up messages like "那墨尔本呢", resolve from recent history
    let resolvedMessage = message;
    if (message.length < 15 && /呢|怎么样|那|也|about|how about|what about/.test(lower)) {
      // Check if we can infer topic from context
      const prevTopics = context._recentIntents || [];
      if (prevTopics.length > 0) {
        const prevTopic = prevTopics[0];
        // Map previous intents to query augmentation
        const topicAugment = {
          weather: '天气', maps_assistant: '附近', property: '房价', jobs: '工作',
          tax: '税', exchange_rate: '汇率', energy: '电费', bank_rates: '利率'
        };
        if (topicAugment[prevTopic]) {
          resolvedMessage = message + ' ' + topicAugment[prevTopic];
        }
      }
    }
    const resolvedLower = resolvedMessage.toLowerCase();

    // --- Nearby / Location-based (check first, highest priority with GPS) ---
    if (/附近|nearby|周围|旁边|推荐餐厅|推荐咖啡|好吃的|哪里吃|去哪|around here|close by|what's near/.test(resolvedLower)) {
      if (context.latitude && context.longitude) {
        intents.push('maps_assistant');
        toolCalls.push({
          tool: 'maps_assistant', args: {
            mode: 'nearby',
            latitude: context.latitude,
            longitude: context.longitude,
            query: message,
            radius: 1500
          }
        });
      } else {
        // No GPS: pass raw text as location
        const locMatch = message.match(/([A-Za-z\u4e00-\u9fff]+(?:\s+CBD)?)(?:\s*附近|\s*周围)/i);
        const loc = locMatch?.[1]?.trim() || context.home_city || 'Sydney';
        intents.push('maps_assistant');
        toolCalls.push({ tool: 'maps_assistant', args: { mode: 'nearby', query: message, location: loc } });
      }
    }
    // --- Directions / Navigation ---
    if (/\u600e\u4e48\u53bb|\u5982\u4f55\u524d\u5f80|\u8def\u7ebf|\u600e\u4e48\u8d70|\u600e\u8fdb|how to get|how do i get|directions to|route to|navigate to|way to get/.test(resolvedLower)) {
      intents.push('maps_assistant');
      const destMatch = resolvedMessage.match(/(?:\u53bb|\u524d\u5f80|\u5230|get to|to|navigate to)\s*([^\uff0c\uff0c\u3002\n?!]{2,40})/i);
      const destination = destMatch?.[1]?.trim() || resolvedMessage;
      let origin = context.home_city || 'Sydney';
      const originMatch = resolvedMessage.match(/(?:\u5728|from|\u73b0\u5728\u5728|I am at|I'm at|\u6211\u5728)\s*([^\uff0c\u3002\n]+?)(?:\s*[\uff0c\u3002,]|\s*\u6211|\s*\u600e|$)/i);
      if (originMatch?.[1]) origin = originMatch[1].trim();
      if (context.latitude && context.longitude) {
        origin = `${context.latitude},${context.longitude}`;
      }
      toolCalls.push({ tool: 'maps_assistant', args: { mode: 'directions', origin, destination, travel_mode: 'transit' } });
    }
    if (/天气|weather|temperature|forecast|气温/.test(resolvedLower)) {
      intents.push('weather');
      const city = (resolvedMessage.match(IntentAgent.CITY_RE) || [])[1] || context.home_city || 'Sydney';
      toolCalls.push({ tool: 'weather', args: { location: city } });
    }
    if (/税|tax|salary|income|工资/.test(resolvedLower)) {
      intents.push('tax');
      const income = this._extractIncome(message);
      if (income > 0) toolCalls.push({ tool: 'tax_calculator', args: { gross_income: income } });
      ragCategories.push('government/ato');
    }
    if (/汇率|exchange|澳元|AUD|CNY|人民币/.test(resolvedLower)) {
      intents.push('exchange_rate');
      let amount = 100;
      const numMatch = message.match(/(\d+)/);
      if (numMatch) amount = parseInt(numMatch[1]);
      toolCalls.push({ tool: 'exchange_rate', args: { amount, from_currency: 'AUD', to_currency: 'CNY' } });
    }
    if (/药|medicine|drug|panadol|ibuprofen/.test(resolvedLower)) {
      intents.push('medicine');
      toolCalls.push({ tool: 'medicine', args: { query: message } });
    }
    if (/签证|visa/.test(resolvedLower)) { intents.push('visa'); ragCategories.push('government/visa'); }
    if (/租房|rent|押金|bond|房租/.test(resolvedLower) && !/补贴/.test(resolvedLower)) {
      intents.push('property');
      toolCalls.push({ tool: 'property', args: { location: context.home_city || 'Sydney', type: 'rent' } });
    }
    if (/房价|买房|property|house price|购房|房产/.test(resolvedLower)) {
      intents.push('property');
      toolCalls.push({ tool: 'property', args: { location: context.home_city || 'Sydney', type: 'buy' } });
    }
    if (/medicare|医保/.test(resolvedLower)) { intents.push('medicare'); ragCategories.push('government/medicare'); }
    if (/油价|petrol|fuel|汽油/.test(resolvedLower)) {
      intents.push('fuel');
      toolCalls.push({ tool: 'fuel_prices', args: { state: 'NSW', fuel_type: 'U91' } });
    }
    if (/假期|holiday|public holiday|放假/.test(resolvedLower)) {
      intents.push('holidays');
      toolCalls.push({ tool: 'public_holidays', args: { state: 'NSW', year: new Date().getFullYear() } });
    }
    if (/工作|招聘|求职|job|career|salary|薪资|薪水|找工|seek|最低工资|minimum wage/.test(resolvedLower)) {
      intents.push('jobs');
      const queryMatch = message.match(/(?:找|search|look for|招聘|求职)?\s*(.{2,20}?)(?:工作|job|career|的|吗|呢|？|\?|$)/);
      toolCalls.push({ tool: 'jobs', args: { query: queryMatch?.[1]?.trim() || message, location: context.home_city || 'Sydney' } });
    }
    if (/centrelink|福利|补贴|津贴|jobseeker|养老金|pension|育儿|失业金|youth allowance/.test(resolvedLower)) {
      intents.push('centrelink');
      toolCalls.push({ tool: 'centrelink', args: { query: message } });
    }
    if (/电费|电价|electricity|energy|能源|电力|gas|煤气|天然气|电表/.test(resolvedLower)) {
      intents.push('energy');
      toolCalls.push({ tool: 'energy_compare', args: { location: context.home_city || 'Sydney', type: 'electricity' } });
    }
    if (/利率|贷款|mortgage|房贷|存款|savings|存钱|定期|term deposit|银行|bank rate|rba|央行/.test(resolvedLower)) {
      intents.push('bank_rates');
      toolCalls.push({ tool: 'bank_rates', args: { query: message } });
    }
    if (!/怎么去|如何前往|路线|怎么走|从.*到|how to get|directions/.test(resolvedLower) && /布里斯班|黄金海岸|translink|brisbane.*(bus|train|tram|ferry|transport|delay)|gold coast.*(tram|glink|bus)|阳光海岸|昆士兰.*交通/.test(resolvedLower)) {
      const isAlerts = /中断|停运|disruption|alert|delay|delays|service|故障/.test(resolvedLower);
      intents.push(isAlerts ? 'transport_qld_alerts' : 'transport_qld');
      const mode = /bus|巴士|公交/.test(resolvedLower) ? 'bus' : /train|rail|火车/.test(resolvedLower) ? 'rail' : /tram|glink|轻轨/.test(resolvedLower) ? 'tram' : /ferry|渡轮/.test(resolvedLower) ? 'ferry' : null;
      const rargs = { region: 'seq' };
      if (mode && !isAlerts) rargs.transport_mode = mode;
      toolCalls.push({ tool: isAlerts ? 'transport_qld_alerts' : 'transport_qld', args: rargs });
    }
    // Web search fallback for news, search, specials, promotions, general queries
    if (/搜索|search|查一下|google|最新|新闻|news|latest|immigration|移民政策|特价|优惠|促销|打折|折扣|specials?|deals?|sales?|discounts?|coles|woolworths|超市.*价|价格.*对比/.test(resolvedLower) && toolCalls.length === 0) {
      intents.push('web_search');
      toolCalls.push({ tool: 'web_search', args: { query: message } });
    }

    if (intents.length === 0) { intents.push('general'); ragCategories.push('living'); }

    return { intents, language: /[\u4e00-\u9fff]/.test(message) ? 'zh' : 'en', tool_calls: toolCalls, rag_categories: ragCategories, resolved_query: resolvedMessage !== message ? resolvedMessage : message, reasoning: 'keyword fallback' };
  }
}
