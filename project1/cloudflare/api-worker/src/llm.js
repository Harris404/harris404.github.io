/**
 * LLM Service — Dual-Provider Architecture
 * 
 * Provider A (Intent/JSON):  DeepSeek  — cheap, fast, great at structured output
 * Provider B (Answers/Stream): Qwen-Plus — high quality, best Chinese capabilities
 * 
 * Fallback: Cloudflare Workers AI if no API keys configured
 */

export class LLMService {
  constructor(env) {
    this.env = env;

    // ─── Provider A: DeepSeek (Intent analysis / JSON routing) ───
    this.intentApiKey = env.DEEPSEEK_API_KEY || '';
    this.intentBaseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    this.intentModel = env.DEEPSEEK_MODEL || 'deepseek-chat';

    // ─── Provider B: Qwen/DashScope (Answer generation / Streaming) ───
    this.answerApiKey = env.DASHSCOPE_API_KEY || '';
    this.answerBaseUrl = env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.answerModel = env.LLM_MODEL || 'qwen-plus';

    // Fallback to Cloudflare AI if neither key is set
    this.useCloudflareAI = !this.intentApiKey && !this.answerApiKey;

    // If only one key exists, use it for both
    if (!this.intentApiKey && this.answerApiKey) {
      this.intentApiKey = this.answerApiKey;
      this.intentBaseUrl = this.answerBaseUrl;
      this.intentModel = env.LLM_MODEL_FAST || 'qwen-turbo';
    }
    if (!this.answerApiKey && this.intentApiKey) {
      this.answerApiKey = this.intentApiKey;
      this.answerBaseUrl = this.intentBaseUrl;
      this.answerModel = this.intentModel;
    }
  }

  async chat(messages, options = {}) {
    if (this.useCloudflareAI) {
      return await this._callCloudflareAI(messages, options);
    }
    // Route to Qwen-Plus for answer generation
    return await this._callExternalAPI(messages, {
      ...options,
      _apiKey: this.answerApiKey,
      _baseUrl: this.answerBaseUrl,
      model: options.model || this.answerModel
    });
  }

  async chatJSON(messages, options = {}) {
    // Route to DeepSeek for intent analysis (cheap + fast JSON)
    let raw;
    if (this.useCloudflareAI) {
      raw = await this._callCloudflareAI(messages, { ...options, jsonMode: true });
    } else {
      raw = await this._callExternalAPI(messages, {
        ...options,
        jsonMode: true,
        _apiKey: this.intentApiKey,
        _baseUrl: this.intentBaseUrl,
        model: options.model || this.intentModel
      });
    }

    let clean = raw.trim();
    // Remove thinking tags if present (Qwen3/DeepSeek-R1 style)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // Remove unclosed thinking tags
    clean = clean.replace(/<think>[\s\S]*/g, '').trim();

    // Remove markdown code fences
    if (clean.startsWith('```')) {
      clean = clean.split('\n').slice(1).join('\n');
      const endIdx = clean.lastIndexOf('```');
      if (endIdx > 0) clean = clean.substring(0, endIdx);
      clean = clean.trim();
    }

    // Attempt 1: Direct parse
    try {
      return JSON.parse(clean);
    } catch { }

    // Attempt 2: Extract JSON object with regex
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch { }

      // Attempt 3: Fix common LLM JSON errors
      let fixed = jsonMatch[0];
      // Fix trailing commas before } or ]
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');
      // Fix single quotes → double quotes (only around keys/values, not inside strings)
      fixed = fixed.replace(/'/g, '"');
      // Fix unquoted keys — safer approach: only match keys at JSON-valid positions
      // Process outside of quoted strings to avoid corrupting URLs/values
      fixed = fixed.replace(/(^|[{,])\s*([a-zA-Z_]\w*)\s*(?=\s*:)/gm, '$1"$2"');
      try {
        return JSON.parse(fixed);
      } catch { }
    }

    // Attempt 4: Extract JSON array
    const arrMatch = clean.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch { }
    }

    throw new Error(`LLM returned invalid JSON. Raw output: ${clean.substring(0, 200)}`);
  }

  async _callCloudflareAI(messages, options = {}) {
    if (!this.env.AI) throw new Error('Cloudflare AI binding not configured');

    // Use Llama 3.1 for reliable responses
    const model = '@cf/meta/llama-3.1-8b-instruct';

    // If jsonMode requested, reinforce JSON-only instruction in final user message
    let finalMessages = messages;
    if (options.jsonMode) {
      finalMessages = messages.map((m, i) => {
        if (i === messages.length - 1 && m.role === 'user') {
          return { ...m, content: m.content + '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no text, no code fences.' };
        }
        return m;
      });
    }

    const result = await this.env.AI.run(model, {
      messages: finalMessages,
      max_tokens: options.maxTokens || 1500,
      temperature: options.temperature ?? 0.15
    });

    let response = result?.response || '';
    // Strip thinking tags (in case model includes them)
    response = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    response = response.replace(/<think>[\s\S]*/g, '').trim();
    return response;
  }

  async _callExternalAPI(messages, options = {}) {
    const apiKey = options._apiKey || this.answerApiKey;
    const baseUrl = options._baseUrl || this.answerBaseUrl;
    if (!apiKey) throw new Error('No LLM API key configured');

    const body = {
      model: options.model || this.answerModel,
      messages,
      temperature: options.temperature ?? 0.15,
      max_tokens: options.maxTokens || 1500,
      stream: false
    };

    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`LLM API error ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Streaming chat — returns a ReadableStream of SSE-formatted chunks
   * @param {Array} messages
   * @param {Object} options
   * @returns {ReadableStream} SSE stream
   */
  chatStream(messages, options = {}) {
    if (this.useCloudflareAI) {
      return this._streamCloudflareAI(messages, options);
    }
    // Streaming always uses answer provider (Qwen-Plus)
    return this._streamExternalAPI(messages, {
      ...options,
      _apiKey: this.answerApiKey,
      _baseUrl: this.answerBaseUrl,
      model: options.model || this.answerModel
    });
  }

  _streamExternalAPI(messages, options = {}) {
    const apiKey = options._apiKey || this.answerApiKey;
    const baseUrl = options._baseUrl || this.answerBaseUrl;
    const model = options.model || this.answerModel;

    const body = {
      model,
      messages,
      temperature: options.temperature ?? 0.15,
      max_tokens: options.maxTokens || 1500,
      stream: true
    };

    const self = this;
    return new ReadableStream({
      async start(controller) {
        try {
          const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
          });

          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: `LLM API ${resp.status}` })}\n\n`));
            controller.close();
            return;
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                continue;
              }
              try {
                const chunk = JSON.parse(payload);
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
                }
              } catch { /* skip malformed chunks */ }
            }
          }
        } catch (err) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        }
        controller.close();
      }
    });
  }

  _streamCloudflareAI(messages, options = {}) {
    const env = this.env;
    return new ReadableStream({
      async start(controller) {
        try {
          const model = '@cf/meta/llama-3.1-8b-instruct';
          const stream = await env.AI.run(model, {
            messages,
            max_tokens: options.maxTokens || 1500,
            temperature: options.temperature ?? 0.15,
            stream: true
          });

          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                continue;
              }
              try {
                const chunk = JSON.parse(payload);
                const text = chunk.response || '';
                if (text) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: text })}\n\n`));
                }
              } catch { }
            }
          }
        } catch (err) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        }
        controller.close();
      }
    });
  }
}
