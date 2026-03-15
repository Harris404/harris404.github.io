/**
 * Multimodal Handler
 * 
 * 1. Speech-to-Text (ASR) - Cloudflare Whisper / DashScope Paraformer
 * 2. Image Understanding - Cloudflare Vision AI / DashScope Qwen-VL
 * 3. Unified processMultimodalInput for chat pipeline
 */

// ── Speech-to-Text ────────────────────────────────────────────────

export async function speechToText(audioData, env) {
  // 1. Cloudflare Workers AI Whisper (free)
  if (env.AI) {
    try {
      let audioBuffer;
      if (typeof audioData === 'string') {
        const binary = atob(audioData);
        audioBuffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) audioBuffer[i] = binary.charCodeAt(i);
      } else {
        audioBuffer = new Uint8Array(audioData);
      }

      const result = await env.AI.run('@cf/openai/whisper', {
        audio: [...audioBuffer],
      });

      if (result?.text) {
        return {
          text: result.text.trim(),
          language: result.language || 'auto',
          source: 'Cloudflare Whisper',
        };
      }
    } catch (err) {
      console.error('Whisper ASR failed:', err.message);
    }
  }

  // 2. DashScope Paraformer fallback
  const apiKey = env?.DASHSCOPE_API_KEY;
  if (apiKey) {
    try {
      const base64Audio = typeof audioData === 'string'
        ? audioData
        : btoa(String.fromCharCode(...new Uint8Array(audioData)));

      const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'paraformer-v2',
          input: { file_urls: [`data:audio/wav;base64,${base64Audio}`] },
          parameters: { language_hints: ['zh', 'en'] },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.output?.results?.[0]?.text || data?.output?.text || '';
        if (text) return { text: text.trim(), source: 'DashScope Paraformer' };
      }
    } catch (err) {
      console.error('DashScope ASR failed:', err.message);
    }
  }

  return { error: 'ASR not available. Need AI binding or DASHSCOPE_API_KEY.' };
}

// ── Image Understanding ───────────────────────────────────────────

export async function understandImageForChat(imageUrl, imageBase64, question, env) {
  const prompt = question || 'Describe this image in detail in Chinese. If it is a document/letter/bill, translate the key content and explain what action is needed.';

  // 1. Cloudflare Workers AI Vision (free, always available)
  if (env.AI) {
    // Get image bytes if we have a URL
    let imageBytes = null;
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) imageBytes = new Uint8Array(await imgRes.arrayBuffer());
      } catch {}
    } else if (imageBase64) {
      try {
        const binary = atob(imageBase64);
        imageBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) imageBytes[i] = binary.charCodeAt(i);
      } catch {}
    }

    if (imageBytes && imageBytes.length > 0) {
      // Try LLaVA first (uses prompt + image bytes format)
      try {
        const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
          image: [...imageBytes],
          prompt: prompt,
          max_tokens: 1500,
        });
        if (result?.description || result?.response) {
          return { description: result.description || result.response, source: 'Cloudflare Vision AI (LLaVA)' };
        }
      } catch (err) {
        console.error('CF LLaVA failed:', err.message);
      }

      // Try Llama 3.2 Vision (uses messages format)
      try {
        const result = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          messages: [{ role: 'user', content: prompt }],
          image: [...imageBytes],
          max_tokens: 1500,
        });
        if (result?.response) {
          return { description: result.response, source: 'Cloudflare Vision AI (Llama 3.2)' };
        }
      } catch (err) {
        console.error('CF Llama Vision failed:', err.message);
      }
    }
  }

  // 2. DashScope Qwen-VL fallback (try multiple model names)
  const apiKey = env?.DASHSCOPE_API_KEY;
  const baseUrl = env?.DASHSCOPE_BASE_URL || 'https://dashscope-us.aliyuncs.com/compatible-mode/v1';
  if (apiKey) {
    const userContent = [];
    if (imageUrl) userContent.push({ type: 'image_url', image_url: { url: imageUrl } });
    else if (imageBase64) userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
    userContent.push({ type: 'text', text: prompt });

    for (const model of ['qwen-vl-max', 'qwen-vl-plus', 'qwen2.5-vl-72b-instruct']) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: userContent }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const desc = data.choices?.[0]?.message?.content || '';
          if (desc) return { description: desc, source: `Qwen VL (${model})` };
        }
      } catch {}
    }
  }

  return { error: 'Image understanding needs Cloudflare AI or DASHSCOPE_API_KEY' };
}

// ── Unified Multimodal Processor ──────────────────────────────────

export async function processMultimodalInput(body, env) {
  const { message = '', image_url, image_base64, audio_base64, audio_url } = body;

  let processedMessage = message;
  let imageContext = null;
  let originalType = 'text';

  // 1. Audio -> text
  if (audio_base64 || audio_url) {
    originalType = 'audio';
    let audioData = audio_base64;

    if (audio_url && !audioData) {
      try {
        const audioRes = await fetch(audio_url);
        if (audioRes.ok) {
          const buffer = await audioRes.arrayBuffer();
          audioData = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        }
      } catch {}
    }

    if (audioData) {
      const asrResult = await speechToText(audioData, env);
      if (asrResult.text) {
        processedMessage = message.trim()
          ? `${message}\n[Voice]: ${asrResult.text}`
          : asrResult.text;
      } else {
        processedMessage = message || '(Voice recognition failed, please retry or type)';
      }
    }
  }

  // 2. Image -> description (intent-aware — helps orchestrator route to correct agent)
  if (image_url || image_base64) {
    originalType = originalType === 'audio' ? 'audio+image' : 'image';
    
    // Use user's question if provided, otherwise use an intent-aware prompt
    const userQuestion = processedMessage.trim();
    const visionPrompt = userQuestion
      ? `The user is asking: "${userQuestion}"\n\nPlease analyze the image to answer their question. If the image contains text, translate/extract the key content. Respond in Chinese (简体中文).`
      : `请分析这张图片，完成以下任务：
1. 描述图片内容（中文）
2. 如果是文件/信件/账单/合同，翻译关键内容并说明需要采取的行动
3. 如果是药品/药物标签，说明用途和注意事项
4. 如果是路标/标志，解释含义
5. 在回答末尾，用一行标注图片类型，格式：[TYPE: government_letter/bill/receipt/contract/medicine/road_sign/property/visa/food/general]`;
    
    const imageResult = await understandImageForChat(image_url, image_base64, visionPrompt, env);

    if (imageResult.description) {
      imageContext = imageResult.description;
      
      // Build a rich message that includes image analysis for intent routing
      if (!userQuestion) {
        processedMessage = `[用户发送了一张图片，请根据图片内容提供帮助]\n\n图片识别结果:\n${imageResult.description}`;
      } else {
        processedMessage = `${userQuestion}\n\n[用户同时发送了一张图片]\n图片分析:\n${imageResult.description}`;
      }
    } else if (imageResult.error && !userQuestion) {
      processedMessage = `[用户发送了图片但识别失败: ${imageResult.error}]  请提醒用户用清晰的照片重试。`;
    }
  }

  return {
    processedMessage: processedMessage.trim() || 'Hello',
    imageContext,
    originalType,
  };
}
