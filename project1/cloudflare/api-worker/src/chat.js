/**
 * Chat Handler — 核心对话引擎
 * Intent → Tool calls + RAG → LLM response
 * 支持: GPS位置感知、用户偏好记忆、多轮上下文
 */

import { LLMService } from './llm.js';
import { IntentAgent } from './intent.js';
import { executeTool } from './tools/index.js';
import { searchRAG } from './rag.js';
import { json } from './worker.js';
import { loadPreferences, savePreferences, learnFromConversation, buildPreferenceContext } from './preferences.js';

/**
 * Extract readable content from tool results
 */
function extractContent(result) {
  if (!result) return '';

  // Handle MCP-style result with content array
  if (result.content && Array.isArray(result.content)) {
    return result.content.map(c => c.text || JSON.stringify(c)).join('\n');
  }

  if (typeof result === 'string') return result;
  if (result.error) {
    // Include fallback_url and message if available (e.g., directions API error)
    let msg = `Error: ${result.error}`;
    if (result.message) msg += `\n${result.message}`;
    if (result.fallback_url) msg += `\nGoogle Maps 直达链接: ${result.fallback_url}`;
    if (result.api_key_hint) msg += `\n提示: ${result.api_key_hint}`;
    return msg;
  }
  return JSON.stringify(result);
}

/**
 * Build fallback answer when LLM is unavailable
 */
function buildFallbackAnswer(query, toolData, ragKnowledge) {
  const parts = [];

  for (const [tool, data] of Object.entries(toolData)) {
    const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    parts.push(`[${tool}] ${content.substring(0, 300)}`);
  }

  for (const doc of ragKnowledge.slice(0, 3)) {
    parts.push(`${doc.title}: ${doc.content?.substring(0, 300) || ''}`);
  }

  if (parts.length === 0) {
    return `抱歉，我暂时没有找到关于"${query}"的相关信息。建议换个方式提问或访问相关澳洲政府网站。`;
  }

  return parts.join('\n\n');
}

/**
 * Check data freshness of RAG results
 * Returns a warning string if any data is older than 180 days
 */
function checkDataFreshness(knowledge) {
  const now = Date.now();
  const STALE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
  const staleItems = [];

  for (const doc of knowledge) {
    if (!doc.last_updated) continue;
    const parsed = Date.parse(doc.last_updated);
    if (isNaN(parsed)) continue;
    const age = now - parsed;
    if (age > STALE_THRESHOLD_MS) {
      staleItems.push(doc.title);
    }
  }

  if (staleItems.length === 0) return '';
  return `注意：部分参考数据可能不是最新的（${[...new Set(staleItems)].slice(0, 3).join('、')}），建议用户核实官方网站获取最新信息。`;
}

/**
 * Determine if query is simple enough to skip LLM generation
 * Simple queries with direct tool results can use template responses
 */
function isSimpleQuery(analysis, toolResults) {
  // No tools called = complex reasoning needed
  if (analysis.tool_calls.length === 0) return false;
  
  // Multiple tools = complex
  if (analysis.tool_calls.length > 1) return false;
  
  // Check if we have successful tool results
  const hasValidResults = Object.values(toolResults).some(
    t => t.content && !String(t.content).startsWith('Error')
  );
  if (!hasValidResults) return false;
  
  // Simple tool types that can be templated (must match TOOL_REGISTRY names)
  const simpleTool = analysis.tool_calls[0].tool;
  const simpleTools = [
    'weather',              // Direct weather data
    'exchange_rate',        // Direct conversion result
    'tax_calculator',       // Direct tax calculation
    'postcodes',            // Direct postcode lookup
    'fuel_prices',          // Direct price listing
    'public_holidays',      // Direct date listing
    'public_transport'      // Direct departure times
  ];
  
  return simpleTools.includes(simpleTool);
}

/**
 * Generate template response for simple queries
 * Saves LLM API call for straightforward data display
 */
function generateTemplateResponse(analysis, toolResults) {
  const tool = analysis.tool_calls[0].tool;
  const result = Object.values(toolResults)[0];
  const language = analysis.language === 'zh' ? 'zh' : 'en';
  
  // Extract clean content
  let content = result.content;
  if (typeof content === 'object') {
    content = JSON.stringify(content, null, 2);
  }
  
  // Generate simple prefix based on tool type (must match TOOL_REGISTRY names)
  const prefixes = {
    zh: {
      weather: '🌤️ 天气信息：',
      exchange_rate: '💱 汇率换算：',
      tax_calculator: '🧾 税务计算：',
      postcodes: '📮 邮编信息：',
      fuel_prices: '⛽ 油价信息：',
      public_holidays: '📅 公共假期：',
      public_transport: '🚌 实时到站信息：'
    },
    en: {
      weather: '🌤️ Weather:',
      exchange_rate: '💱 Currency conversion:',
      tax_calculator: '🧾 Tax calculation:',
      postcodes: '📮 Postcode info:',
      fuel_prices: '⛽ Fuel prices:',
      public_holidays: '📅 Public holidays:',
      public_transport: '🚌 Live departures:'
    }
  };
  
  const prefix = prefixes[language][tool] || (language === 'zh' ? '查询结果：' : 'Result:');
  return `${prefix}\n\n${content}`;
}
/**
 * Generate answer using LLM
 */
async function generateAnswer(llm, query, toolData, ragKnowledge, analysis, history, prefs = {}, staleWarning = '', errors = [], locationInfo = null) {
  const language = analysis.language === 'zh' ? '中文' : '英文';
  const prefContext = buildPreferenceContext(prefs);

  const systemPrompt = `你是"澳知AI"，一个专业的澳洲生活AI助手。

# 核心铁律（违反等于回答错误）
1. **严禁编造**：只能使用【实时数据】【知识库】【网络搜索】中的信息回答。如果数据中没有某个信息，你必须说"我没有查到这个信息"或"建议您直接查看[官方网站]"，绝不能猜测、推断或用"常识"补充。
2. **严禁杜撰地址/路线/时间**：不得编造任何地址、步行时间、公交线路、营业时间、班次或路线描述。这些信息只有在工具返回中明确出现时才能使用。如果工具返回了error或无数据，直接告知用户"无法获取实时信息"。
3. **严禁虚构店铺/场所**：不得编造不存在的超市、餐厅、车站、学校。只能列出工具返回的真实结果。
4. **数据来源标注**：每段关键信息后标注来源，格式：[📍Google Maps] [🚌交通API] [🌤️天气API] [📚知识库] [🔍网搜] [💱汇率API]
5. **工具失败 = 坦诚说明**：如果数据显示"Error"或工具调用失败，必须告诉用户"该服务暂时无法访问"，并提供替代方案（如官方网站链接）。绝不能假装成功然后编造结果。

# 回答格式
- 用${language}回答
- 简洁自然，像朋友对话
- 对话上下文：理解指代关系（如"那里"、"这个"、"墨尔本呢"等）
- 如有用户偏好信息，适当个性化回答${prefContext}
- 涉及药品/法律/医疗/金额 → 加"建议到官方网站确认"
- 网络搜索结果要注明"根据网上查到的信息"并附来源链接
${staleWarning ? `- 注意：${staleWarning}` : ''}`;

  let dataPrompt = `【问题】${query}\n\n`;

  // Location info
  if (locationInfo) {
    dataPrompt += `【用户位置】纬度 ${locationInfo.latitude}, 经度 ${locationInfo.longitude}（来源: ${locationInfo.source || 'GPS'}）\n\n`;
  }

  // Separate web search and supermarket from other tool results
  const webSearchData = toolData['web_search'];
  const supermarketData = toolData['supermarket_specials'];
  const otherTools = Object.entries(toolData).filter(
    ([k]) => k !== 'web_search' && k !== 'supermarket_specials'
  );

  if (otherTools.length > 0) {
    dataPrompt += '【实时数据】\n';
    for (const [source, data] of otherTools) {
      let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      if (content.length > 1500) content = content.substring(0, 1500) + '\n...(数据已截断)';
      dataPrompt += `[${source}] ${content}\n\n`;
    }
  }

  if (ragKnowledge.length > 0) {
    dataPrompt += '【知识库（仅供参考，可能不完全准确）】\n';
    const relevantDocs = ragKnowledge
      .filter(doc => !doc.relevance || doc.relevance >= 0.35)
      .slice(0, 5);
    for (const doc of relevantDocs) {
      const sourceInfo = doc.source_url ? ` (来源: ${doc.source_url})` : '';
      dataPrompt += `[${doc.title}]${sourceInfo} ${(doc.content || '').substring(0, 800)}\n\n`;
    }
  }

  if (webSearchData) {
    dataPrompt += '【网络搜索结果（实时搜索获取）】\n';
    // Parse structured web search result to extract deep_content
    let parsed = null;
    try {
      parsed = typeof webSearchData.content === 'string'
        ? JSON.parse(webSearchData.content)
        : webSearchData.content;
    } catch { /* not JSON, use as string */ }

    if (parsed?.deep_content?.length > 0) {
      // Use full page content from Tavily raw_content or Jina deep read
      for (const page of parsed.deep_content) {
        dataPrompt += `\n### ${page.title}\n来源: ${page.url}\n${page.content.substring(0, 2500)}\n`;
      }
      // Also include snippet results for reference links
      if (parsed.results?.length > 0) {
        dataPrompt += '\n参考链接:\n';
        for (const r of parsed.results.slice(0, 5)) {
          dataPrompt += `- [${r.title}](${r.url})\n`;
        }
      }
      dataPrompt += '\n';
    } else {
      let content = typeof webSearchData.content === 'string' ? webSearchData.content : JSON.stringify(webSearchData.content);
      if (content.length > 1500) content = content.substring(0, 1500) + '\n...(截断)';
      dataPrompt += `${content}\n\n`;
    }
  }

  // Supermarket specials — dedicated rendering
  if (supermarketData) {
    dataPrompt += '【超市特价数据（实时获取）】\n';
    let parsed = null;
    try {
      parsed = typeof supermarketData.content === 'string'
        ? JSON.parse(supermarketData.content)
        : supermarketData.content;
    } catch { /* not JSON */ }

    if (parsed?.stores) {
      for (const [storeName, storeData] of Object.entries(parsed.stores)) {
        dataPrompt += `\n### ${storeData.store || storeName} 特价\n`;
        dataPrompt += `数据来源: ${storeData.fetched_via || 'direct'}\n`;

        if (storeData.items?.length > 0) {
          // Structured JSON from Woolworths API
          for (const item of storeData.items.slice(0, 20)) {
            const price = item.price !== null ? `$${item.price}` : '';
            const was = item.was_price ? `(原价$${item.was_price})` : '';
            const save = item.save ? ` ${item.save}` : '';
            dataPrompt += `- ${item.brand ? item.brand + ' ' : ''}${item.name} ${item.size} ${price}${was}${save}\n`;
          }
        } else if (storeData.specials_pages?.length > 0) {
          // Pages from Tavily search — pass all pages, more content for product extraction
          for (const page of storeData.specials_pages.slice(0, 3)) {
            dataPrompt += `来源: [${page.title}](${page.url})\n${page.content.substring(0, 4000)}\n\n`;
          }
        } else if (storeData.specials_text) {
          // Jina Reader markdown fallback
          dataPrompt += storeData.specials_text.substring(0, 2000) + '\n';
        }
      }
    }

    if (parsed?.errors?.length > 0) {
      dataPrompt += `\n数据获取注意: ${parsed.errors.join('; ')}\n`;
    }
    dataPrompt += '\n';
  }

  if (otherTools.length === 0 && ragKnowledge.length === 0 && !webSearchData) {
    dataPrompt += '【注意】没有查到相关数据。你必须告诉用户"我没有查到相关信息"，然后提供可能的官方网站链接。严禁编造任何信息。\n';
  }

  // Inject tool errors so AI must acknowledge them
  if (errors.length > 0) {
    dataPrompt += '\n【⚠️ 工具调用失败】\n';
    for (const err of errors) {
      dataPrompt += `${err.source}: ${err.error}\n`;
    }
    dataPrompt += '你必须告诉用户上述工具暂时无法使用，并提供替代方案（如官方网站链接）。严禁假装这些工具成功然后编造数据。\n\n';
  }

  // Use more history for better multi-turn context
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8),
    { role: 'user', content: dataPrompt }
  ];

  return await llm.chat(messages, { temperature: 0.15, maxTokens: 800 });
}

/**
 * Get conversation history from KV
 */
async function getHistory(kv, sessionId, maxTurns = 6) {
  if (!kv) return [];
  try {
    const data = await kv.get(`session:${sessionId}`, 'json');
    return (data?.messages || []).slice(-maxTurns * 2);
  } catch { return []; }
}

/**
 * Save conversation to KV
 */
async function saveHistory(kv, sessionId, messages) {
  if (!kv) return;
  try {
    // Keep last 30 messages max for better context
    const trimmed = messages.slice(-30);
    await kv.put(`session:${sessionId}`, JSON.stringify({
      messages: trimmed,
      updated: new Date().toISOString()
    }), { expirationTtl: 86400 * 7 }); // 7 days TTL
  } catch (e) {
    console.error('Failed to save history:', e.message);
  }
}

/**
 * Main chat handler
 */
export async function handleChat(request, env, cors) {
  const startTime = Date.now();

  const body = await request.json();
  const { message, session_id, latitude, longitude, user_id } = body;
  const sessionId = session_id || request.headers.get('x-session-id') || 'default';
  const userId = user_id || sessionId; // Use session as user ID fallback

  if (!message?.trim()) {
    return json({ error: 'Missing required field: message' }, cors, 400);
  }

  const rawMessage = message.trim().substring(0, 2000); // Max 2000 chars

  // Initialize services
  const llm = new LLMService(env);
  const intentAgent = new IntentAgent(llm);

  // Get conversation history and user preferences in parallel
  const [history, prefs] = await Promise.all([
    getHistory(env.KV, sessionId),
    loadPreferences(env.KV, userId)
  ]);

  // Build context for intent analysis
  const intentContext = {
    latitude: latitude || null,
    longitude: longitude || null,
    home_city: prefs.home_city || null,
    preferenceHint: prefs.home_city ? `常住${prefs.home_city}` : null,
    _recentIntents: prefs.last_topics || []
  };

  // ================================================================
  // Agent Pipeline
  // ================================================================

  // Step 1: Intent Analysis (with location + preference context)
  const analysis = await intentAgent.analyze(rawMessage, history, intentContext);

  // Step 2: Parallel execution — tool calls + RAG search
  const toolResults = {};
  const errors = [];
  const tasks = [];

  // Tool calls
  for (const call of analysis.tool_calls) {
    tasks.push(
      executeTool(call.tool, call.args, env)
        .then(result => {
          toolResults[call.tool] = {
            tool: call.tool,
            args: call.args,
            content: extractContent(result) || result
          };
        })
        .catch(err => {
          console.error(`Tool failed [${call.tool}]:`, err.message);
          errors.push({ source: `tool:${call.tool}`, error: err.message });
        })
    );
  }

  // RAG search
  let ragResults = [];
  const shouldSearchRAG = analysis.rag_categories.length > 0 || analysis.tool_calls.length === 0;

  if (shouldSearchRAG) {
    tasks.push(
      searchRAG(analysis.resolved_query || rawMessage, 5, analysis.rag_categories, env)
        .then(results => { ragResults = results; })
        .catch(err => {
          console.error('RAG failed:', err.message);
          errors.push({ source: 'rag', error: err.message });
        })
    );
  }

  await Promise.allSettled(tasks);

  // Step 2.5: Auto web search fallback
  // If RAG results are low quality and no tool provided good data, search the web
  const ragHighQuality = ragResults.filter(r => r.score >= 0.55);
  const hasGoodToolData = Object.values(toolResults).some(
    t => t.content && !String(t.content).startsWith('Error')
  );
  const alreadySearchedWeb = 'web_search' in toolResults;

  if (!alreadySearchedWeb && ragHighQuality.length < 2 && !hasGoodToolData) {
    try {
      const webResult = await executeTool('web_search', {
        query: (analysis.resolved_query || rawMessage) + ' Australia',
        max_results: 5
      }, env);
      const webContent = extractContent(webResult);
      if (webContent && !webContent.startsWith('Error')) {
        toolResults['web_search'] = {
          tool: 'web_search',
          args: { query: analysis.resolved_query || rawMessage },
          content: webContent
        };
      }
    } catch (e) {
      // Web search fallback failed, continue without it
    }
  }

  // Step 3: Prepare data
  const knowledge = ragResults.map(r => ({
    title: r.title, section: r.section, category: r.category,
    content: r.content, source_url: r.source_url, relevance: r.score,
    last_updated: r.last_updated || ''
  }));

  // Check data freshness — warn if any result is older than 6 months
  const staleWarning = checkDataFreshness(knowledge);

  // Step 4: Generate answer (with conditional routing to save API costs)
  let answer;
  try {
    // Check if we can skip LLM generation for simple queries
    if (isSimpleQuery(analysis, toolResults)) {
      answer = generateTemplateResponse(analysis, toolResults);
      console.log('[Chat] Using template response (skipped LLM)');
    } else {
      // Complex query - use LLM for reasoning
      answer = await generateAnswer(llm, rawMessage, toolResults, knowledge, analysis, history, prefs, staleWarning, errors, {
        latitude, longitude,
        source: latitude && longitude ? 'GPS浏览器定位' : '默认位置'
      });
    }
  } catch (err) {
    console.error('[ResponseAgent] Failed:', err.message);
    answer = buildFallbackAnswer(rawMessage, toolResults, knowledge);
  }

  // Step 5: Save conversation history
  const newHistory = [
    ...history,
    { role: 'user', content: rawMessage },
    { role: 'assistant', content: answer }
  ];
  await saveHistory(env.KV, sessionId, newHistory);

  // Step 6: Learn and save user preferences
  const updatedPrefs = learnFromConversation(prefs, rawMessage, analysis, toolResults);
  await savePreferences(env.KV, userId, updatedPrefs);

  // Step 7: Return response
  const totalMs = Date.now() - startTime;

  return json({
    answer,
    query: rawMessage,
    analysis: {
      intents: analysis.intents,
      language: analysis.language,
      tools_used: Object.keys(toolResults),
      rag_categories: analysis.rag_categories,
      reasoning: analysis.reasoning,
      resolved_query: analysis.resolved_query !== rawMessage ? analysis.resolved_query : undefined,
      location_aware: !!(latitude && longitude)
    },
    data: {
      realtime_data: Object.keys(toolResults).length > 0 ? toolResults : undefined,
      knowledge: knowledge.length > 0 ? knowledge : undefined
    },
    data_sources: {
      tool_success: Object.keys(toolResults),
      tool_failed: errors.filter(e => e.source.startsWith('tool:')).map(e => e.source),
      rag_results_count: ragResults.length
    },
    session: { id: sessionId },
    user: {
      preferences_loaded: prefs.interaction_count > 0,
      home_city: updatedPrefs.home_city || undefined
    },
    errors: errors.length > 0 ? errors : undefined,
    data_freshness: staleWarning ? { warning: staleWarning } : undefined,
    timestamp: new Date().toISOString(),
    performance: {
      total_ms: totalMs,
      agent_ms: analysis.agent_time_ms,
      tool_calls: analysis.tool_calls.length,
      rag_search: shouldSearchRAG
    }
  }, cors);
}
