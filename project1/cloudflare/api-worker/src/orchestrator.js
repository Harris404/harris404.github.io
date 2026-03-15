/**
 * AgentOrchestrator - Routes user queries to specialized domain agents
 * Implements Router + Coordinator hybrid pattern for multi-agent system
 * 
 * Architecture:
 * - Single-domain queries (80%) → Direct routing to specialist agent
 * - Cross-domain queries (20%) → Coordinator merges results from multiple agents
 * 
 * Supported Agents:
 * - Life: 衣食住行, weather, supermarket, transport
 * - Finance: tax, rental contracts, exchange, Centrelink
 * - Education: university courses, study resources
 * - Healthcare: GP, medicine, Medicare
 * - Wellness: travel, attractions, leisure
 */

import { LLMService } from './llm.js';

export class AgentOrchestrator {
  /**
   * Initialize orchestrator with environment context
   * @param {Object} env - Cloudflare Workers environment bindings
   */
  constructor(env) {
    this.env = env;
    this.llm = new LLMService(env);

    /**
     * Agent registry - will be populated with agent instances in Task 5-6
     * Format: { 'life': LifeAgent, 'finance': FinanceAgent, ... }
     */
    this.agents = {};
  }

  /**
   * Main routing method - classifies intent and dispatches to appropriate agent(s)
   * 
   * @param {string} message - User query
   * @param {Array} history - Conversation history
   * @param {Object} context - User context (location, preferences)
   * @returns {Object} Response object with agent attribution
   */
  async route(message, history, context) {
    // Classify user intent into domain(s)
    const routing = await this._classifyIntent(message, history, context);

    // Single-domain: route directly to specialist agent
    if (routing.is_single_domain) {
      const agent = this.agents[routing.domain];

      if (!agent) {
        throw new Error(`Agent '${routing.domain}' not registered yet (Task 5-6)`);
      }

      // Apply same timeout protection as multi-domain path
      const AGENT_TIMEOUT = 45000;
      const agentPromise = agent.process(message, history, context);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Agent '${routing.domain}' timeout (>${AGENT_TIMEOUT}ms)`)), AGENT_TIMEOUT)
      );
      return await Promise.race([agentPromise, timeoutPromise]);
    }

    // Cross-domain: coordinate multiple agents (Wave 3)
    return await this._coordinateMultiDomain(routing, message, history, context);
  }

  /**
   * Classify user query into domain(s) using LLM
   * 
   * @param {string} message - User query
   * @param {Array} history - Conversation history for context
   * @param {Object} context - User context (location, preferences)
   * @returns {Object} Routing decision
   *   - is_single_domain: boolean
   *   - domain: string (if single-domain) OR domains: Array (if cross-domain)
   *   - reasoning: string
   *   - confidence: number (0.0-1.0)
   */
  async _classifyIntent(message, history, context) {
    // Build classification prompt with strict tie-breaking rules
    const systemPrompt = `You are a domain classification agent for Australian life assistant.

Classify user query into ONE primary domain OR mark cross-domain.

## DOMAIN DEFINITIONS

1. **life** (生活) — SOLE owner of: weather, air quality (AQI), BOM weather warnings, supermarkets, daily commute transport, nearby places, fuel, postcodes, holidays, energy, scam detection, telco/SIM/NBN plans, vehicle rego/valuation, rental tenant rights & cost calculator, data.gov.au open data search, crawl_page (web page extraction), translator (翻译助手)
   Examples: "悉尼今天天气?", "Woolworths特价?", "翻译一下这个", "这封信说什么?"

2. **finance** (财务) — SOLE owner of: tax, currency exchange, Centrelink, rental/property contracts, bank rates, visa financial needs, superannuation, TRS tourist refund, government median rent data查询, ABN/company lookup, ABS economic statistics, Fair Work minimum wage & pay rates, insurance_compare (保险对比), finance_tools (房贷计算/Super基金比较/报税指南/会计推荐/首套房优惠)
   Examples: "10万澳币要交多少税?", "最低工资多少?", "车险多少钱?", "房贷月供多少?", "Super哪个基金好?", "首套房有什么补贴?", "怎么报税?", "找华人会计"

3. **education** (教育) — SOLE owner of: university courses, CRICOS/TAFE, AQF, OSHC (student insurance), study guides, scholarships, K-12 school search (ICSEA/NAPLAN/selective schools)
   Examples: "悉尼大学计算机课程?", "OSHC保险多少钱?", "Chatswood附近小学排名?", "精英学校怎么考?"

4. **healthcare** (医疗) — SOLE owner of: GP/hospital/medicine info, Medicare/MBS fee lookup, mental health crisis services, booking medical appointments, bulk billing info, Chinese-speaking GP search, drug interaction check, dental/eye care guide, gp_finder (GP增强搜索)
   Examples: "附近有GP吗?", "Panadol是什么药?", "看GP要多少钱?", "Medicare报销多少?", "说中文的GP", "看牙多少钱?", "药物能一起吃吗?"

5. **wellness** (休闲) — SOLE owner of: tourist attractions, multi-day itineraries (trip planner), weekend getaways, fitness/gym, leisure activities, stress-relief activities, youtube_search (YouTube视频搜索)
   Examples: "墨尔本三日游攻略", "Blue Mountains怎么安排?", "有没有相关视频?", "YouTube澳洲vlog"

## PRIORITY TIE-BREAKING PROTOCOL

When a query SEEMS to touch multiple domains, apply these rules IN ORDER:

**Rule A — "Primary Intent" test:**
If the user's CORE question belongs to one domain and another domain is only MENTIONED as context, route SINGLE-DOMAIN to the core domain.
  - "学生签证需要多少存款?" → finance ONLY (visa financial requirement; "student" is context, not an education question)
  - "打工收入要报税吗?" → finance ONLY (tax question; "work" is context)
  - "附近有GP吗?" → healthcare ONLY (finding medical service; "nearby" is the method, not a life-domain question)
  - "大学有心理咨询吗?" → healthcare ONLY (mental health service; "university" is location context)
  - "坐火车去上班" → life ONLY (daily commute; transport is life's job)

**Rule B — "Shared Tool" exception:**
If two agents use the SAME tool (e.g., both Life and Wellness use "nearby" and "directions"), do NOT cross-domain just because a tool is shared. Route to whichever agent's DOMAIN the question belongs to.
  - "附近有健身房吗?" → wellness ONLY (fitness = wellness domain, even though "nearby" tool is shared)
  - "附近有超市吗?" → life ONLY (supermarket = life domain)

**Rule C — TRUE cross-domain (both agents must produce INDEPENDENT data):**
Only mark cross-domain when BOTH agents need to independently query their own tools/RAG to fully answer:
  - "租房附近有超市吗?" → finance (rental area info) + life (supermarket search) ✅
  - "悉尼大学计算机专业毕业后工资多少?" → education (course info) + finance (salary data) ✅
  - "去Blue Mountains怎么坐火车?" → wellness (trip planning) + life (transport schedule) ✅
  - "Medicare报销会影响报税吗?" → healthcare (Medicare rules) + finance (tax implications) ✅

## CROSS-DOMAIN EXAMPLES
- "周末天气适合爬山吗?" → life + wellness (weather data + hiking recommendation)
- "学生签证可以选什么课程?" → finance (visa rules) + education (course search)
- "附近的GP诊所怎么去?" → healthcare (GP search) + life (directions)

## SINGLE-DOMAIN EXAMPLES
- "去公司怎么坐车?" → life (daily commute, no tourist intent)
- "墨尔本有什么好吃的?" → wellness (travel exploration)
- "租房合同条款" → finance (rental law)
- "悉尼大学有哪些课程?" → education (course search)
- "Panadol是什么药?" → healthcare (medicine info)
- "心理咨询怎么预约?" → healthcare (mental health services)
- "周末去哪玩?" → wellness (leisure planning)

## OUTPUT FORMAT (JSON only, no markdown)
{
  "is_single_domain": true,
  "domain": "life",
  "confidence": 0.95,
  "reasoning": "Weather is solely Life domain (Rule A: primary intent)"
}
OR for cross-domain:
{
  "is_single_domain": false,
  "domains": ["finance", "life"],
  "confidence": 0.90,
  "reasoning": "Rental area (finance) + supermarket search (life) — both need independent data (Rule C)"
}

## RULES
1. ALWAYS apply Rule A first. Most queries are single-domain.
2. Use conversation history for multi-turn context.
3. Default confidence >0.85 for clear single-domain.
4. If truly ambiguous and confidence <0.70, prefer single-domain with the most relevant agent.
5. Maximum 3 domains for cross-domain (if >3, pick the top 2-3).`

    // Inject user context
    let userContent = message;
    if (context.latitude && context.longitude) {
      userContent += `\n[USER_LOCATION: lat=${context.latitude}, lng=${context.longitude}]`;
    }
    if (context.preferenceHint) {
      userContent += `\n[USER_CONTEXT: ${context.preferenceHint}]`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Include last 10 messages for context
      { role: 'user', content: userContent }
    ];

    try {
      const resultText = await this.llm.chatJSON(messages, {
        temperature: 0.1, // Low temperature for consistent classification
        maxTokens: 300,
        timeout: 15000
      });

      // chatJSON already returns a parsed object, not a string
      const routing = resultText;
      // Validate routing structure
      if (routing.is_single_domain && !routing.domain) {
        throw new Error('Single-domain classification missing domain field');
      }
      if (!routing.is_single_domain && (!routing.domains || routing.domains.length === 0)) {
        throw new Error('Cross-domain classification missing domains array');
      }

      // Post-LLM validation: check if obvious cross-domain patterns were missed
      const validatedRouting = this._validateCrossDomain(message, routing);

      return validatedRouting;
    } catch (error) {
      console.error('Classification failed:', error);

      // Fallback: simple keyword-based classification
      return this._fallbackClassification(message);
    }
  }

  /**
   * Validate LLM classification for obvious cross-domain patterns
   * Corrects false negatives where LLM classified as single-domain but should be cross-domain
   * 
   * @param {string} message - User query
   * @param {Object} llmRouting - LLM classification result
   * @returns {Object} Validated routing
   */
  _validateCrossDomain(message, llmRouting) {
    // Run fallback keyword detection always
    const fallbackResult = this._fallbackClassification(message);

    if (!llmRouting.is_single_domain) {
      // LLM returned multi-domain — check if fallback found additional domains LLM missed
      if (!fallbackResult.is_single_domain && fallbackResult.domains.length > 0) {
        const llmDomains = new Set(llmRouting.domains);
        const additionalDomains = fallbackResult.domains.filter(d => !llmDomains.has(d));
        if (additionalDomains.length > 0) {
          console.log(`[Orchestrator] Multi-domain augment: LLM had ${llmRouting.domains.join('+')}, adding ${additionalDomains.join('+')} from fallback`);
          return {
            is_single_domain: false,
            domains: [...llmRouting.domains, ...additionalDomains],
            confidence: Math.min(llmRouting.confidence, fallbackResult.confidence),
            reasoning: `${llmRouting.reasoning} + keyword augmented: ${additionalDomains.join('+')}`
          };
        }
      }
      return llmRouting;
    }

    // LLM returned single-domain — only override if fallback detected cross-domain
    // with HIGH confidence (0.70+). Lower confidence fallback is too noisy and
    // overrides correct LLM decisions (e.g. "rent" keyword in a transport query).
    if (!fallbackResult.is_single_domain && fallbackResult.domains.length >= 2
        && fallbackResult.confidence >= 0.70) {
      // Only override if the fallback domains actually differ from LLM's single domain
      const fallbackHasNew = fallbackResult.domains.some(d => d !== llmRouting.domain);
      if (fallbackHasNew) {
        console.log(`[Orchestrator] Cross-domain override: LLM said ${llmRouting.domain}, fallback detected ${fallbackResult.domains.join('+')}`);
        return {
          is_single_domain: false,
          domains: fallbackResult.domains,
          confidence: Math.min(llmRouting.confidence, fallbackResult.confidence),
          reasoning: `Override: ${fallbackResult.reasoning} (LLM missed: ${llmRouting.domain})`
        };
      }
    }

    return llmRouting;
  }

  /**
   * Fallback classification using keyword matching
   * Used when LLM classification fails
   */
  _fallbackClassification(message) {
    const lower = message.toLowerCase();
    const detectedDomains = [];

    // Check all domain keywords — use word boundaries (\b) for short English terms
    // to avoid false substring matches (e.g. 'transport' matching in 'transportation benefits')
    if (/(weather|天气|supermarket|超市|特价|woolworths|coles|\btransport\b|交通|地铁|公交|火车|附近|nearby|\bfuel\b|postcode|holiday|\benergy\b|怎么去|如何去|怎么坐|坐车|坐火车|坐地铁|路怎么走|怎么走|directions|how to get|get to)/i.test(lower)) {
      detectedDomains.push('life');
    }

    // Finance: removed bare 'rent' (too ambiguous), kept specific rental/finance terms
    if (/(\btax\b|税|exchange|汇率|centrelink|租房合同|rent contract|tenant|租约|property|买房|\bbank\b|\bvisa\b|签证|superannuation|报税|退税|税务|bond.*deposit|押金)/i.test(lower)) {
      detectedDomains.push('finance');
    }

    if (/(university|大学|unsw|usyd|uq|monash|course|课程|tafe|study|学习|education|教育|oshc|overseas student health|留学生保险|学生保险|aqf|qualification|资格认证|学历认证|certificate i|certificate ii|certificate iii|certificate iv|diploma|vocational|职业培训|scholarship|奖学金)/i.test(lower)) {
      detectedDomains.push('education');
    }

    // Healthcare: added word boundary for 'gp' to avoid matching in words like 'signup'
    if (/(\bgp\b|hospital|医院|medicine|药|doctor|看病|\bmedicare\b|mental health|看医生|牙医|dentist)/i.test(lower)) {
      detectedDomains.push('healthcare');
    }

    if (/(tourist|景点|旅游|玩|好玩的|travel|attractions|行程|攻略|几日游|一日游|周末游|itinerary|trip|getaway|sightseeing|leisure|vacation|度假|day trip|weekend|blue mountains|爬山|登山|徒步|hiking|户外|outdoor|健身|fitness|gym|健身房|运动|sport|游泳|swimming)/i.test(lower)) {
      detectedDomains.push('wellness');
    }

    // Remove duplicates
    const uniqueDomains = [...new Set(detectedDomains)];

    // Cross-domain if 2+ domains detected
    if (uniqueDomains.length >= 2) {
      return {
        is_single_domain: false,
        domains: uniqueDomains,
        confidence: 0.65,
        reasoning: `Fallback: detected multiple domains - ${uniqueDomains.join(', ')}`
      };
    }

    // Single domain or no match
    if (uniqueDomains.length === 1) {
      return {
        is_single_domain: true,
        domain: uniqueDomains[0],
        confidence: 0.60,
        reasoning: `Fallback: keyword match for ${uniqueDomains[0]} domain`
      };
    }

    // Default to life (most general)
    return {
      is_single_domain: true,
      domain: 'life',
      confidence: 0.50,
      reasoning: 'Fallback: default to Life domain (no clear match)'
    };
  }

  /**
   * Coordinate multiple agents for cross-domain queries
   * 
   * @param {Object} routing - Classification result from _classifyIntent
   * @param {string} message - User query
   * @param {Array} history - Conversation history
   * @param {Object} context - User context
   * @returns {Object} Merged response from multiple agents
   */
  async _coordinateMultiDomain(routing, message, history, context) {
    const domains = routing.domains;
    const AGENT_TIMEOUT = 45000; // 45s timeout per agent

    // Parallel invocation with timeout protection
    const agentPromises = domains.map(domain => {
      const agent = this.agents[domain];

      if (!agent) {
        console.warn(`[Orchestrator] Agent '${domain}' not found, skipping`);
        return Promise.resolve(null);
      }

      // Wrap agent call with timeout
      const agentPromise = agent.process(message, history, context);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Agent '${domain}' timeout (>${AGENT_TIMEOUT}ms)`)), AGENT_TIMEOUT)
      );

      // Race between agent completion and timeout
      return Promise.race([agentPromise, timeoutPromise])
        .catch(err => {
          console.error(`[Orchestrator] Agent '${domain}' failed:`, err.message);
          return null; // Error isolation
        });
    });

    const startTime = Date.now();
    const responses = await Promise.all(agentPromises);
    const elapsed = Date.now() - startTime;

    // Filter out failed agents (null responses), keeping domains in sync
    const validPairs = responses.map((r, i) => [r, domains[i]]).filter(([r]) => r !== null);
    const validResponses = validPairs.map(([r]) => r);
    const validDomains = validPairs.map(([, d]) => d);

    if (validResponses.length === 0) {
      throw new Error('All agents failed to process the query');
    }

    // Merge results from multiple agents
    return await this._mergeResponses(validResponses, validDomains, elapsed);
  }

  /**
   * Merge responses from multiple agents
   * 
   * Strategy:
   * - Deduplicate tool calls (same tool used by multiple agents)
   * - Combine RAG results (union of all sources)
   * - Concatenate response text with agent attribution
   * - Report max elapsed time across all agents
   * 
   * @param {Array} responses - Array of agent responses
   * @param {Array} domains - Array of agent domain names
   * @param {number} elapsed - Total coordination time in ms
   * @returns {Object} Merged response
   */
  async _mergeResponses(responses, domains, elapsed) {
    // Deduplicate tools_used across agents
    const allTools = new Set();
    responses.forEach(r => {
      if (r.tools_used && Array.isArray(r.tools_used)) {
        r.tools_used.forEach(tool => allTools.add(tool));
      }
    });

    // Combine RAG sources
    const allRAG = new Set();
    responses.forEach(r => {
      if (r.rag_used && Array.isArray(r.rag_used)) {
        r.rag_used.forEach(source => allRAG.add(source));
      }
    });

    // Concatenate responses with agent attribution
    // Format: **AGENT**: response text
    const mergedText = responses
      .map((r, i) => {
        const domain = domains[i];
        const domainLabel = domain.toUpperCase();
        return `**${domainLabel}**: ${r.response || r.text || '(No response)'}`;
      })
      .join('\n\n');

    // Calculate max individual agent elapsed time
    const maxAgentTime = Math.max(...responses.map(r => r.elapsed_ms || 0));

    // LLM synthesis pass — make cross-domain responses feel natural
    // Guard: only synthesize if merged text is short enough (avoid context window errors)
    const SYNTHESIS_CHAR_LIMIT = 3000; // ~750 tokens, safe for 7968-token models
    const synthesisInput = mergedText.length > SYNTHESIS_CHAR_LIMIT
      ? mergedText.slice(0, SYNTHESIS_CHAR_LIMIT) + '\n...[truncated for synthesis]'
      : mergedText;
    try {
      const synthesisMessages = [
        {
          role: 'system',
          content: 'You are a helpful assistant. Multiple specialist agents have answered parts of the user\'s question. Synthesize their responses into ONE coherent, natural reply. Do NOT use section headers like **FINANCE** or **LIFE**. Integrate the information smoothly and conversationally. Keep the same language (Chinese or English) as the original responses.'
        },
        {
          role: 'user',
          content: synthesisInput
        }
      ];
      const synthesized = await this.llm.chat(synthesisMessages);
      if (synthesized && synthesized.trim()) {
        return {
          response: synthesized,
          agents: domains,
          tools_used: Array.from(allTools),
          rag_used: Array.from(allRAG),
          elapsed_ms: elapsed,
          agent_max_elapsed_ms: maxAgentTime,
          is_cross_domain: true
        };
      }
    } catch (synthErr) {
      console.warn('[Orchestrator] Synthesis failed, using raw merge:', synthErr.message);
    }

    return {
      response: mergedText,
      agents: domains, // Multi-agent attribution
      tools_used: Array.from(allTools),
      rag_used: Array.from(allRAG),
      elapsed_ms: elapsed,
      agent_max_elapsed_ms: maxAgentTime,
      is_cross_domain: true
    };
  }
}
