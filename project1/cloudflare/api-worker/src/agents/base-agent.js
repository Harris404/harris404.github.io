/**
 * BaseAgent - Abstract base class for all specialized domain agents
 * 
 * Provides common functionality:
 * - Tool execution with access control
 * - RAG retrieval with category filtering
 * - LLM interaction
 * - Response generation
 * 
 * Subclasses MUST implement:
 * - _getSystemPrompt(): Returns agent-specific XML prompt
 * 
 * Pattern:
 * 1. Subclass extends BaseAgent
 * 2. Pass allowed tools + RAG categories to super()
 * 3. Implement _getSystemPrompt() to load XML prompt
 * 4. Agent automatically enforces tool/RAG access control
 */

import { executeTool, TOOL_REGISTRY } from '../tools/index.js';
import { searchRAG } from '../rag.js';
import { IntentAgent } from '../intent.js';

export class BaseAgent {
  /**
   * Initialize agent with domain-specific configuration
   * 
   * @param {LLMService} llm - LLM service instance
   * @param {Object} env - Cloudflare Workers environment bindings
   * @param {Array<string>} tools - Whitelist of tool names this agent can use
   * @param {Array<string>} ragCategories - RAG categories this agent can query
   */
  constructor(llm, env, tools, ragCategories) {
    this.llm = llm;
    this.env = env;
    this.tools = tools || [];
    this.ragCategories = ragCategories || [];
    this.intentAgent = new IntentAgent(llm);
  }

  /**
   * Main processing method - orchestrates tool calls, RAG, and response generation
   * 
   * @param {string} message - User query
   * @param {Array} history - Conversation history
   * @param {Object} context - User context (location, preferences)
   * @returns {Object} Agent response with tools_used, rag_used, response text
   */
  async process(message, history, context) {
    // Get agent-specific system prompt
    const systemPrompt = this._getSystemPrompt();

    // Analyze message and decide which tools/RAG to use
    const analysis = await this._analyzeMessage(message, history, context, systemPrompt);

    // Execute tools AND RAG in PARALLEL (previously sequential)
    const [toolResults, ragKnowledge] = await Promise.all([
      this._callTools(analysis.tool_calls || [], context),
      this._loadRAG(analysis.rag_categories || [], message),
    ]);

    // Generate final response
    const response = await this._generateResponse(
      message,
      history,
      toolResults,
      ragKnowledge,
      systemPrompt,
      context
    );

    const result = {
      response: response,
      agent: this.constructor.name.toLowerCase().replace('agent', ''),
      tools_used: Object.keys(toolResults),
      rag_used: analysis.rag_categories || [],
      timestamp: new Date().toISOString()
    };

    // Allow subclass-specific post-processing (e.g., disclaimer injection)
    return this._postProcess(result, message);
  }

  // ─── Shared Utility Methods ───────────────────────────────────────

  /**
   * Detect whether the user's message is Chinese or English.
   * Shared across all agents for bilingual response handling.
   *
   * @param {string} text - Text to check
   * @returns {'zh'|'en'} Detected language
   */
  _detectLanguage(text) {
    return /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en';
  }

  /**
   * Format tool results into a consistent string block for the LLM system prompt.
   * Centralizes the duplicated for-loop formatting previously scattered across agents.
   *
   * @param {Object} toolResults - Results keyed by tool name
   * @returns {string} Formatted text block
   */
  _formatToolResults(toolResults) {
    if (!toolResults || Object.keys(toolResults).length === 0) return '';
    let text = '## Tool Results:\n';
    for (const [tool, result] of Object.entries(toolResults)) {
      text += `### ${tool}:\n${JSON.stringify(result, null, 2)}\n\n`;
    }
    return text;
  }

  /**
   * Format RAG knowledge chunks into a consistent string block.
   *
   * @param {Array} ragKnowledge - RAG search result chunks
   * @returns {string} Formatted text block
   */
  _formatRAGKnowledge(ragKnowledge) {
    if (!ragKnowledge || ragKnowledge.length === 0) return '';
    let text = '## Knowledge Base:\n';
    for (const chunk of ragKnowledge) {
      text += `- ${chunk.content}\n`;
    }
    return text + '\n';
  }

  /**
   * Post-processing hook. Subclasses can override to add domain-specific
   * transformations (e.g., appending disclaimers, sanitizing outputs).
   * Default implementation is a no-op passthrough.
   *
   * @param {Object} result - The agent result object
   * @param {string} message - Original user message
   * @returns {Object} Potentially modified result
   */
  _postProcess(result, _message) {
    return result;
  }

  /**
   * Analyze user message using IntentAgent (battle-tested routing with comprehensive prompt)
   * 
   * @param {string} message - User query
   * @param {Array} history - Conversation history
   * @param {Object} context - User context
   * @param {string} systemPrompt - Agent-specific system prompt
   * @returns {Object} Analysis result with tool_calls and rag_categories
   */
  async _analyzeMessage(message, history, context, _systemPrompt) {
    // Reuse pre-analyzed intent from orchestrator to avoid duplicate LLM calls
    const result = context?._preAnalyzedIntent
      || await this.intentAgent.analyze(message, history, context);

    if (context?._preAnalyzedIntent) {
      console.log('[BaseAgent] Reusing pre-analyzed intent (saved 1 LLM call)');
    }

    // Filter tool_calls to only what this agent is authorized to use
    const allowedToolCalls = (result.tool_calls || []).filter(call =>
      this.tools.includes(call.tool)
    );

    // Filter rag_categories to only what this agent has access to
    // Use prefix matching: agent allows 'government/education' → matches 'government/education'
    // Also handle broad prefix: agent allows 'government' → matches 'government/ato', etc.
    const allowedRagCategories = (result.rag_categories || []).filter(cat =>
      this.ragCategories.some(allowed => cat.startsWith(allowed) || allowed.startsWith(cat))
    );
    // Fallback strategy when all tools are filtered out:
    //
    // This happens in cross-domain queries where IntentAgent identified tools
    // for ANOTHER agent's domain. Example: user asks about "weather + tax",
    // FinanceAgent filters out 'weather' (belongs to Life), keeping only 'tax_calculator'.
    // If FinanceAgent has NO tools left, it means the query's finance aspect
    // was purely informational → use the agent's own RAG categories for context.
    //
    // Why NOT web_search: most agents don't have it, and even if they did,
    // a random web search produces noise. The agent's curated RAG knowledge
    // is far more relevant than generic search results.
    let finalToolCalls = allowedToolCalls;
    let finalRagCategories = allowedRagCategories;

    if (finalToolCalls.length === 0 && finalRagCategories.length === 0
      && (result.tool_calls || []).length > 0) {
      // All tools were filtered → use agent's own top RAG categories as fallback context
      finalRagCategories = this.ragCategories.slice(0, 3);
      console.log(`[BaseAgent] All ${result.tool_calls.length} tool(s) filtered out → falling back to RAG: ${finalRagCategories.join(', ')}`);
    }

    return {
      tool_calls: finalToolCalls,
      rag_categories: finalRagCategories,
      resolved_query: result.resolved_query || message
    };
  }

  /**
   * Execute tool calls with access control enforcement and cross-domain deduplication.
   * 
   * When multiple agents run in parallel (cross-domain), they share a tool cache
   * via context._toolCache. Same tool+args = cache hit, avoiding redundant API calls.
   * Example: 4 agents all have emergency_info → only 1 actual execution.
   * 
   * @param {Array} toolCalls - Array of {tool: string, args: object}
   * @param {Object} [context] - Context with optional _toolCache Map
   * @returns {Object} Tool results keyed by tool name
   */
  async _callTools(toolCalls, context) {
    if (!toolCalls || toolCalls.length === 0) {
      return {};
    }

    // Shared cache for cross-domain deduplication
    // Key: "toolName|{sorted_args_json}", Value: Promise<result>
    const cache = context?._toolCache;

    // Parallelize tool execution for better performance
    const toolPromises = toolCalls.map(async (call) => {
      // Enforce access control
      if (!this.tools.includes(call.tool)) {
        throw new Error(
          `Agent ${this.constructor.name} not authorized to use tool: ${call.tool}`
        );
      }

      // Build stable cache key (sorted args for consistent hashing)
      const cacheKey = cache
        ? `${call.tool}|${JSON.stringify(call.args || {}, Object.keys(call.args || {}).sort())}`
        : null;

      // Check cache — reuse result if another agent already called this tool with same args
      if (cache && cache.has(cacheKey)) {
        console.log(`[BaseAgent] Tool cache HIT: ${call.tool} (saved 1 API call)`);
        return [call.tool, await cache.get(cacheKey)];
      }

      try {
        // Wrap execution in a promise and store in cache BEFORE awaiting
        // This way parallel agents waiting for the same tool share the same promise
        const execPromise = executeTool(call.tool, call.args, this.env);
        if (cache) cache.set(cacheKey, execPromise);

        const result = await execPromise;
        return [call.tool, result];
      } catch (error) {
        console.error(`Tool ${call.tool} failed:`, error);
        // Remove failed results from cache so other agents can retry
        if (cache) cache.delete(cacheKey);
        return [call.tool, { error: error.message }];
      }
    });

    const toolResults = await Promise.all(toolPromises);

    // Convert array of [tool, result] back to object
    return Object.fromEntries(toolResults);
  }

  /**
   * Load RAG knowledge with category filtering
   * 
   * @param {Array<string>} categories - RAG categories to query
   * @param {string} query - Search query
   * @returns {Array} RAG search results
   */
  async _loadRAG(categories, query) {
    if (!categories || categories.length === 0) {
      return [];
    }

    // Filter categories to only those this agent can access
    // Use prefix matching to support both 'government' (broad) and 'government/education' (specific)
    const allowedCategories = categories.filter(cat =>
      this.ragCategories.some(allowed => cat.startsWith(allowed) || allowed.startsWith(cat))
    );

    if (allowedCategories.length === 0) {
      return [];
    }

    try {
      // searchRAG signature: (query, topK, categories, env)
      return await searchRAG(query, 5, allowedCategories, this.env);
    } catch (error) {
      console.error('RAG search failed:', error);
      return [];
    }
  }

  /**
   * Generate final response using LLM with tool results and RAG knowledge
   * 
   * @param {string} message - User query
   * @param {Array} history - Conversation history
   * @param {Object} toolResults - Results from tool calls
   * @param {Array} ragKnowledge - RAG search results
   * @param {string} systemPrompt - Agent-specific system prompt
   * @param {Object} context - User context
   * @returns {string} Generated response
   */
  async _generateResponse(message, history, toolResults, ragKnowledge, systemPrompt, context) {
    // Anti-hallucination prefix — applied to ALL agents
    const antiHallucinationPrefix = `[核心规则]
1. 严禁编造：只能使用下方【工具数据】和【知识库】中的信息。没有的信息必须说"我没有查到"。
2. 严禁杜撰地址/路线/时间/价格：这些信息只有在工具返回中明确出现时才能使用。
3. 严禁虚构店铺/场所：只能列出工具返回的真实结果。
4. 工具返回Error = 告知用户"该服务暂时无法访问"，提供官方网站链接。
5. 每段关键信息后标注来源：[📍Google Maps] [API] [📚知识库] [🔍网搜]

`;

    // Build context using shared formatters
    let contextText = antiHallucinationPrefix + systemPrompt + '\n\n';
    contextText += this._formatToolResults(toolResults);
    contextText += this._formatRAGKnowledge(ragKnowledge);
    contextText += `## User Context:\n${JSON.stringify(context, null, 2)}\n\n`;

    // Build messages — truncate history to last 12 messages
    const MAX_HISTORY = 12;
    const truncatedHistory = history.length > MAX_HISTORY
      ? history.slice(-MAX_HISTORY)
      : history;

    const messages = [
      { role: 'system', content: contextText },
      ...truncatedHistory,
      { role: 'user', content: message }
    ];

    return await this.llm.chat(messages, { maxTokens: 1500, temperature: 0.15 });
  }

  /**
   * Get agent-specific system prompt (MUST be implemented by subclass)
   * 
   * @returns {string} XML-formatted system prompt
   * @throws {Error} If not implemented by subclass
   */
  _getSystemPrompt() {
    throw new Error(
      `${this.constructor.name} must implement _getSystemPrompt() method`
    );
  }
}
