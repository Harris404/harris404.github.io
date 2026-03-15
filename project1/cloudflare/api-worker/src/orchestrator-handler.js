/**
 * Orchestrator Chat Handler — Multi-Agent Architecture Entry Point
 * 
 * Replaces old chat.js monolithic handler with AgentOrchestrator routing.
 * Maintains backward compatibility with existing API contract.
 * 
 * Optimization (v2.4): IntentAgent runs ONCE here, domain is derived from
 * tool_calls via TOOL_TO_DOMAIN map, eliminating 1-3 redundant LLM calls.
 */

import { AgentOrchestrator } from './orchestrator.js';
import { LLMService } from './llm.js';
import { IntentAgent } from './intent.js';
import { LifeAgent } from './agents/life.js';
import { FinanceAgent } from './agents/finance.js';
import { EducationAgent } from './agents/education.js';
import { HealthcareAgent } from './agents/healthcare.js';
import { WellnessAgent } from './agents/wellness.js';
import { json } from './worker.js';
import { loadPreferences, savePreferences, learnFromConversation, buildPreferenceContext } from './preferences.js';
import { processMultimodalInput } from './multimodal.js';

// ── Tool-to-Domain Map ────────────────────────────────────────────────
// Derived from each agent's constructor tool list. Used to skip the
// orchestrator's LLM classification call entirely.
const TOOL_TO_DOMAIN = {
  // Life Agent tools — daily essentials
  weather: 'life', supermarket_assistant: 'life', fuel_prices: 'life',
  postcodes: 'life', energy_compare: 'life', scam_detector: 'life',
  telco_compare: 'life', translator: 'life', crawl_page: 'life',
  data_gov: 'life', bom_warnings: 'life', air_quality: 'life',
  public_transport: 'life', public_holidays: 'life', vehicle: 'life',
  // Finance Agent tools
  tax_calculator: 'finance', exchange_rate: 'finance', centrelink: 'finance',
  bank_rates: 'finance', visa_info: 'finance', trs_refund: 'finance',
  abn_lookup: 'finance', abs_stats: 'finance', fair_work_pay: 'finance',
  insurance_compare: 'finance', finance_tools: 'finance',
  property: 'finance', domain_search: 'finance',
  rental_assistant: 'finance', jobs: 'finance',
  // Education Agent tools
  education: 'education', oshc: 'education', aqf: 'education',
  school_search: 'education',
  // Healthcare Agent tools
  medicine: 'healthcare', healthcare: 'healthcare', hotdoc: 'healthcare',
  medicare: 'healthcare', gp_finder: 'healthcare',
  // Wellness (Exploration) Agent tools
  trip_planner: 'wellness', youtube_search: 'wellness', events: 'wellness',
  // Multi-agent tools (mapped to primary domain for single-domain routing;
  // dedup cache handles cross-domain overlap)
  maps_assistant: 'life',     // Life=nearby shops, HC=pharmacies, Wellness=attractions
  emergency_info: 'life',     // Life + HC share; routed to life by default
  web_search: 'life',         // All agents have it; routed to life by default
};

/**
 * Derive domain(s) from IntentAgent tool_calls, eliminating the
 * orchestrator's _classifyIntent LLM call entirely.
 */
function deriveDomainFromTools(intentResult) {
  const domainCounts = {};
  for (const call of intentResult.tool_calls || []) {
    const domain = TOOL_TO_DOMAIN[call.tool];
    if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }
  // Also consider RAG categories → domain
  for (const cat of intentResult.rag_categories || []) {
    if (cat.startsWith('government/ato') || cat.startsWith('government/banking') ||
        cat.startsWith('government/centrelink') || cat.startsWith('government/housing') ||
        cat.startsWith('government/super') || cat.startsWith('government/fair-work') ||
        cat.startsWith('living/insurance')) {
      domainCounts['finance'] = (domainCounts['finance'] || 0) + 1;
    } else if (cat.startsWith('government/education')) {
      domainCounts['education'] = (domainCounts['education'] || 0) + 1;
    } else if (cat.startsWith('government/healthcare') || cat.startsWith('government/medicare')) {
      domainCounts['healthcare'] = (domainCounts['healthcare'] || 0) + 1;
    } else if (cat.startsWith('government/visa')) {
      domainCounts['finance'] = (domainCounts['finance'] || 0) + 1;
    } else {
      domainCounts['life'] = (domainCounts['life'] || 0) + 1;
    }
  }
  const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { is_single_domain: true, domain: 'life', confidence: 0.5, reasoning: 'no tools matched → default life' };
  if (sorted.length === 1) return { is_single_domain: true, domain: sorted[0][0], confidence: 0.9, reasoning: `all tools in ${sorted[0][0]}` };
  // Cross-domain if 2+ domains have tools
  return {
    is_single_domain: false,
    domains: sorted.map(([d]) => d),
    confidence: 0.8,
    reasoning: `tools span ${sorted.map(([d, c]) => `${d}(${c})`).join('+')}`
  };
}

/**
 * Get conversation history from KV
 */
async function getHistory(kv, sessionId) {
  if (!kv) return [];
  try {
    const data = await kv.get(`history:${sessionId}`, 'json');
    return data ? data.slice(-20) : []; // Last 20 messages
  } catch {
    return [];
  }
}

/**
 * Save conversation history to KV
 */
async function saveHistory(kv, sessionId, history) {
  if (!kv || !history || history.length === 0) return;
  try {
    await kv.put(`history:${sessionId}`, JSON.stringify(history.slice(-20)), {
      expirationTtl: 2592000 // 30 days
    });
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

/**
 * Main chat handler using AgentOrchestrator
 */
export async function handleChat(request, env, cors, ctx) {
  const startTime = Date.now();

  const body = await request.json();
  const { message, session_id, latitude, longitude, user_id, image_url, image_base64, audio_base64, audio_url } = body;
  const sessionId = session_id || request.headers.get('x-session-id') || 'default';
  const userId = user_id || sessionId;

  // Handle multimodal input (audio/image)
  const isMultimodal = !!(image_url || image_base64 || audio_base64 || audio_url);
  let rawMessage;
  let multimodalMeta = null;

  if (isMultimodal) {
    const mm = await processMultimodalInput(body, env);
    rawMessage = mm.processedMessage.substring(0, 4000);
    multimodalMeta = { type: mm.originalType, hasImage: !!(image_url || image_base64), hasAudio: !!(audio_base64 || audio_url) };
  } else {
    if (!message?.trim()) {
      return json({ error: 'Missing required field: message (or image_url/image_base64/audio_base64)' }, cors, 400);
    }
    rawMessage = message.trim().substring(0, 2000);
  }

  // Initialize orchestrator and agents
  const llm = new LLMService(env);
  const orchestrator = new AgentOrchestrator(env);
  
  // Register all 5 agents (Wave 1 + Wave 2 complete)
  orchestrator.agents['life'] = new LifeAgent(llm, env);
  orchestrator.agents['finance'] = new FinanceAgent(llm, env);
  orchestrator.agents['education'] = new EducationAgent(llm, env);
  orchestrator.agents['healthcare'] = new HealthcareAgent(llm, env);
  orchestrator.agents['wellness'] = new WellnessAgent(llm, env);

  try {
    // Get conversation history and user preferences in parallel
    const [history, prefs] = await Promise.all([
      getHistory(env.KV, sessionId),
      loadPreferences(env.KV, userId)
    ]);

    // Build context for routing
    const context = {
      latitude: latitude || null,
      longitude: longitude || null,
      home_city: prefs.home_city || null,
      preferenceHint: prefs.home_city ? `常住${prefs.home_city}` : null,
      _recentIntents: prefs.last_topics || []
    };

    // ── Optimization: Single IntentAgent call replaces 2-3 LLM calls ──
    // 1. Run IntentAgent ONCE (tool routing) — replaces per-agent analyze
    // 2. Derive domain from tool_calls — replaces orchestrator _classifyIntent
    const intentAgent = new IntentAgent(llm);
    const intentResult = await intentAgent.analyze(rawMessage, history, context);
    const routing = deriveDomainFromTools(intentResult);
    context._preAnalyzedIntent = intentResult; // Agents will reuse this
    context._toolCache = new Map(); // Shared cache: same tool+args across agents = 1 execution

    console.log(`[Handler] Domain derived: ${routing.is_single_domain ? routing.domain : routing.domains?.join('+')} (${routing.reasoning})`);

    // Route using pre-derived domain (skips orchestrator._classifyIntent LLM call)
    let agentResponse;
    if (routing.is_single_domain) {
      const agent = orchestrator.agents[routing.domain];
      if (!agent) throw new Error(`Agent '${routing.domain}' not registered`);
      agentResponse = await agent.process(rawMessage, history, context);
    } else {
      // Cross-domain: use orchestrator's coordination (which handles parallel + merge)
      // Pass pre-derived routing to skip _classifyIntent
      agentResponse = await orchestrator._coordinateMultiDomain(routing, rawMessage, history, context);
    }

    // Update conversation history (tag assistant messages with agent for domain-aware context)
    const agentTag = agentResponse.agent || (agentResponse.agents || ['life']).join('+');
    const updatedHistory = [
      ...history,
      { role: 'user', content: rawMessage },
      { role: 'assistant', content: agentResponse.response, _agent: agentTag }
    ].slice(-20); // Keep last 20 messages

    // Save history and learn from conversation in background
    const updatedPrefs = learnFromConversation(prefs, rawMessage, { intents: [agentResponse.agent || 'life'] }, {});
    const bgTasks = Promise.all([
      saveHistory(env.KV, sessionId, updatedHistory),
      savePreferences(env.KV, userId, updatedPrefs)
    ]).catch(err => console.error('Background task failed:', err));
    if (ctx?.waitUntil) ctx.waitUntil(bgTasks);

    const elapsedMs = Date.now() - startTime;

    // Return response with proper agent attribution
    const responsePayload = {
      response: agentResponse.response,
      tools_used: agentResponse.tools_used || [],
      rag_used: agentResponse.rag_used || [],
      session_id: sessionId,
      elapsed_ms: elapsedMs,
      timestamp: agentResponse.timestamp,
      prompt_version: `v2.4-${new Date().toISOString().slice(0, 10)}`,
      ...(multimodalMeta ? { multimodal: multimodalMeta } : {}),
    };
    
    // Add agent(s) field based on response type
    if (agentResponse.is_cross_domain && agentResponse.agents) {
      // Cross-domain: multiple agents
      responsePayload.agents = agentResponse.agents;
      responsePayload.is_cross_domain = true;
      if (agentResponse.agent_max_elapsed_ms) {
        responsePayload.agent_max_elapsed_ms = agentResponse.agent_max_elapsed_ms;
      }
    } else {
      // Single-domain: single agent
      responsePayload.agent = agentResponse.agent;
    }

    // --- Usage Analytics (fire-and-forget to D1) ---
    if (env.DB) {
      const analyticsAgent = agentResponse.agent || (agentResponse.agents || []).join(',') || 'unknown';
      const analyticsTools = JSON.stringify(agentResponse.tools_used || []);
      const analyticsRag = JSON.stringify(agentResponse.rag_used || []);
      env.DB.prepare(
        `INSERT INTO analytics (session_id, agent, tools_used, rag_categories, elapsed_ms, is_multimodal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        sessionId, analyticsAgent, analyticsTools, analyticsRag,
        elapsedMs, isMultimodal ? 1 : 0, new Date().toISOString()
      ).run().catch(async (err) => {
        // Auto-create table if not exists
        if (err.message && err.message.includes('no such table')) {
          try {
            await env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id TEXT,
              agent TEXT,
              tools_used TEXT,
              rag_categories TEXT,
              elapsed_ms INTEGER,
              is_multimodal INTEGER DEFAULT 0,
              created_at TEXT
            )`).run();
          } catch { /* ignore */ }
        }
      });
    }
    
    return json(responsePayload, cors);

  } catch (error) {
    console.error('Chat handler error:', error);
    
    // Check if error is due to unregistered agent (Wave 2-3 agents)
    if (error.message.includes('not registered yet')) {
      return json({
        error: 'Agent not available',
        message: error.message,
        note: 'Education, Healthcare, and Wellness agents will be available in Wave 2',
        fallback: 'Please ask about daily life (weather, transport, supermarket) or finance (tax, exchange, property) for now'
      }, cors, 503);
    }
    
    return json({
      error: 'Chat processing failed',
      message: error.message,
      elapsed_ms: Date.now() - startTime
    }, cors, 500);
  }
}

/**
 * Streaming Chat Handler — SSE endpoint for real-time token delivery
 * 
 * Protocol:
 *   data: {"type":"status","message":"正在分析问题..."}
 *   data: {"type":"tool_start","tool":"weather","args":{}}
 *   data: {"type":"tool_done","tool":"weather"}
 *   data: {"type":"content","content":"今天悉尼"}  // LLM streaming tokens
 *   data: {"type":"meta","agent":"life","tools_used":["weather"],"elapsed_ms":1200}
 *   data: [DONE]
 */
export async function handleChatStream(request, env, cors, ctx) {
  const startTime = Date.now();
  const encoder = new TextEncoder();

  const body = await request.json();
  const { message, session_id, latitude, longitude, user_id, image_url, image_base64, audio_base64, audio_url } = body;
  const sessionId = session_id || request.headers.get('x-session-id') || 'default';
  const userId = user_id || sessionId;

  // Handle multimodal input (audio/image) — same as non-stream handler
  const isMultimodal = !!(image_url || image_base64 || audio_base64 || audio_url);
  let rawMessage;

  if (isMultimodal) {
    const mm = await processMultimodalInput(body, env);
    rawMessage = mm.processedMessage.substring(0, 4000);
  } else {
    if (!message?.trim()) {
      return json({ error: 'Missing required field: message (or image_url/image_base64/audio_base64)' }, cors, 400);
    }
    rawMessage = message.trim().substring(0, 2000);
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      try {
        // Step 0: Immediate acknowledgement
        send({ type: 'status', message: '正在分析问题...' });

        // Initialize services
        const llm = new LLMService(env);
        const orchestrator = new AgentOrchestrator(env);
        orchestrator.agents['life'] = new LifeAgent(llm, env);
        orchestrator.agents['finance'] = new FinanceAgent(llm, env);
        orchestrator.agents['education'] = new EducationAgent(llm, env);
        orchestrator.agents['healthcare'] = new HealthcareAgent(llm, env);
        orchestrator.agents['wellness'] = new WellnessAgent(llm, env);

        // Load history + prefs
        const [history, prefs] = await Promise.all([
          getHistory(env.KV, sessionId),
          loadPreferences(env.KV, userId)
        ]);

        const context = {
          latitude: latitude || null,
          longitude: longitude || null,
          home_city: prefs.home_city || null,
          preferenceHint: prefs.home_city ? `常住${prefs.home_city}` : null,
          _recentIntents: prefs.last_topics || []
        };

        send({ type: 'status', message: '正在路由到专业Agent...' });

        // ── Optimization: Single IntentAgent call for domain + tool routing ──
        const intentAgent = new IntentAgent(llm);
        const intentResult = await intentAgent.analyze(rawMessage, history, context);
        const routing = deriveDomainFromTools(intentResult);
        context._preAnalyzedIntent = intentResult; // Agents will reuse
        context._toolCache = new Map(); // Shared cache for cross-domain dedup

        const isCrossDomain = !routing.is_single_domain && routing.domains?.length >= 2;
        const agentNames = isCrossDomain ? routing.domains : [routing.domain || 'life'];

        send({ type: 'status', message: `已匹配到 ${agentNames.join('+')} Agent，正在调用工具...`, agent: agentNames[0] });

        // Verify all agents exist
        const agents = agentNames.map(name => orchestrator.agents[name]).filter(Boolean);
        if (agents.length === 0) {
          send({ type: 'error', message: `No agents available for: ${agentNames.join(', ')}` });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        // ── Execute tools + RAG for ALL agents in parallel ──
        const allToolResults = {};
        const allRagCategories = [];
        const agentContexts = []; // For cross-domain synthesis

        const agentWorkPromises = agents.map(async (agent) => {
          const systemPrompt = agent._getSystemPrompt();
          const analysis = await agent._analyzeMessage(rawMessage, history, context, systemPrompt);

          // Execute tools with progress events
          const toolPromises = (analysis.tool_calls || []).map(async (call) => {
            send({ type: 'tool_start', tool: call.tool, args: call.args });
            try {
              const result = await agent._callTools([call]);
              send({ type: 'tool_done', tool: call.tool });
              return result;
            } catch (err) {
              send({ type: 'tool_error', tool: call.tool, error: err.message });
              return {};
            }
          });

          const ragPromise = agent._loadRAG(analysis.rag_categories || [], rawMessage);
          const [toolResultsArr, ragKnowledge] = await Promise.all([
            Promise.all(toolPromises),
            ragPromise
          ]);

          const toolResults = Object.assign({}, ...toolResultsArr);
          Object.assign(allToolResults, toolResults);
          allRagCategories.push(...(analysis.rag_categories || []));

          return { agent, systemPrompt, toolResults, ragKnowledge, analysis };
        });

        const agentResults = await Promise.all(agentWorkPromises);

        send({ type: 'status', message: '正在生成回答...' });

        // Anti-hallucination prefix — applied to ALL streaming responses
        const antiHallucinationPrefix = `[核心规则]
1. 严禁编造：只能使用下方【工具数据】和【知识库】中的信息。没有的信息必须说"我没有查到"。
2. 严禁杜撰地址/路线/时间/价格：工具没返回的信息绝不能使用。
3. 严禁虚构店铺/场所：只能列出工具返回的真实结果。
4. 工具返回Error = 告知用户"该服务暂时无法访问"，提供官方网站链接。
5. 每段关键信息后标注来源：[📍Google Maps] [🚌交通API] [🌤️天气API] [📚知识库] [🔍网搜]

`;

        // ── Build LLM context and stream response ──
        let contextText;
        if (!isCrossDomain) {
          // Single-domain: use agent's own prompt
          const { agent, systemPrompt, toolResults, ragKnowledge } = agentResults[0];
          contextText = antiHallucinationPrefix + systemPrompt + '\n\n';
          contextText += agent._formatToolResults(toolResults);
          contextText += agent._formatRAGKnowledge(ragKnowledge);
        } else {
          // Cross-domain: merge all tool results + RAG into a synthesis prompt
          contextText = antiHallucinationPrefix + 'You are a helpful bilingual assistant (Chinese + English). Multiple specialist agents have gathered data. Synthesize into ONE natural, coherent reply. Match user language.\n\n';
          for (const { agent, toolResults, ragKnowledge } of agentResults) {
            const domainName = agent.constructor.name.replace('Agent', '');
            contextText += `## ${domainName} Data:\n`;
            contextText += agent._formatToolResults(toolResults);
            contextText += agent._formatRAGKnowledge(ragKnowledge);
          }
        }
        contextText += `## User Context:\n${JSON.stringify(context, null, 2)}\n\n`;

        const llmMessages = [
          { role: 'system', content: contextText },
          ...history,
          { role: 'user', content: rawMessage }
        ];

        // Stream LLM tokens
        const llmStream = llm.chatStream(llmMessages, { maxTokens: 1500, temperature: 0.15 });
        const reader = llmStream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const chunk = JSON.parse(payload);
              if (chunk.content) {
                fullResponse += chunk.content;
                send({ type: 'content', content: chunk.content });
              }
              if (chunk.error) {
                send({ type: 'error', message: chunk.error });
              }
            } catch { }
          }
        }

        // Step 4: Send metadata and close
        send({
          type: 'meta',
          agent: isCrossDomain ? agentNames.join('+') : agentNames[0],
          agents: isCrossDomain ? agentNames : undefined,
          is_cross_domain: isCrossDomain || undefined,
          tools_used: Object.keys(allToolResults),
          rag_used: [...new Set(allRagCategories)],
          elapsed_ms: Date.now() - startTime,
          prompt_version: `v2.4-${new Date().toISOString().slice(0, 10)}`,
        });

        // Step 5: Save history in background (tag with agent for domain-aware context)
        const historyAgentTag = isCrossDomain ? agentNames.join('+') : agentNames[0];
        const updatedHistory = [
          ...history,
          { role: 'user', content: rawMessage },
          { role: 'assistant', content: fullResponse, _agent: historyAgentTag }
        ].slice(-20);

        const updatedPrefs = learnFromConversation(prefs, rawMessage, { intents: agentNames }, {});
        const bgTasks = Promise.all([
          saveHistory(env.KV, sessionId, updatedHistory),
          savePreferences(env.KV, userId, updatedPrefs)
        ]).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(bgTasks);

      } catch (err) {
        send({ type: 'error', message: err.message });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...cors
    }
  });
}
