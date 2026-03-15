import { API_BASE } from '../config';

/**
 * Send message via SSE streaming with rich event parsing.
 * @param {object} opts
 * @param {string} opts.message
 * @param {string} opts.sessionId
 * @param {Array} opts.history
 * @param {string|null} opts.imageBase64
 * @param {function} opts.onChunk - called with accumulated text
 * @param {function} opts.onStatus - called with status message (e.g. "正在分析问题...")
 * @param {function} opts.onToolStart - called with tool name
 * @param {function} opts.onToolDone - called with tool name
 * @param {function} opts.onMeta - called with { agent, tools, elapsedMs }
 * @param {function} opts.onError - called with error message
 * @param {AbortSignal} opts.signal - for aborting the request
 * @returns {Promise<string>} full response text
 */
export async function streamChat({
  message, sessionId, history, imageBase64, location,
  onChunk, onStatus, onToolStart, onToolDone, onMeta, onError,
  signal,
}) {
  const reqBody = { message, history, stream: true };
  if (imageBase64) reqBody.image_base64 = imageBase64;
  if (location) {
    reqBody.latitude = location.latitude;
    reqBody.longitude = location.longitude;
  }

  try {
    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify(reqBody),
      signal,
    });

    if (!res.ok) {
      // Fallback to non-stream
      const fallbackBody = { message, history };
      if (location) { fallbackBody.latitude = location.latitude; fallbackBody.longitude = location.longitude; }
      const fallbackRes = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify(fallbackBody),
        signal,
      });
      const data = await fallbackRes.json();
      const reply = data.reply || data.response || data.error || '暂时无法回复';
      onChunk?.(reply);
      return reply;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const type = parsed.type;

          // Rich SSE event types from our Worker
          if (type === 'status') {
            onStatus?.(parsed.message || '');
            continue;
          }
          if (type === 'tool_start') {
            onToolStart?.(parsed.tool || '');
            continue;
          }
          if (type === 'tool_done') {
            onToolDone?.(parsed.tool || '');
            continue;
          }
          if (type === 'meta') {
            onMeta?.({
              agent: parsed.agent || '',
              tools: parsed.tools_used || [],
              elapsedMs: parsed.elapsed_ms || 0,
            });
            continue;
          }
          if (type === 'error') {
            onError?.(parsed.message || '未知错误');
            continue;
          }

          // Content chunks (type === 'content' or OpenAI-compatible format)
          const chunk = (type === 'content' ? parsed.content : null)
            || parsed.choices?.[0]?.delta?.content
            || parsed.content || parsed.text || parsed.chunk || '';
          if (chunk) {
            fullText += chunk;
            onChunk?.(fullText);
          }
        } catch {
          if (data && data !== '[DONE]') {
            fullText += data;
            onChunk?.(fullText);
          }
        }
      }
    }

    return fullText || '抱歉，暂时无法回复。';
  } catch (err) {
    if (err.name === 'AbortError') return '';
    const errMsg = `⚠️ 连接错误：${err.message}\n\n请检查网络连接后重试。`;
    onError?.(errMsg);
    return errMsg;
  }
}
