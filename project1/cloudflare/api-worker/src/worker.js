/**
 * Australian Assistant API Worker — v1
 * 
 * 主入口：路由分发 + CORS + 认证 + 限流 + 错误处理
 * 
 * API 版本管理：
 *   /api/v1/*  — 当前版本（推荐）
 *   /api/*     — 向后兼容（映射到 v1）
 */

import { handleChat, handleChatStream } from './orchestrator-handler.js';
import { handleRAGSearch } from './rag.js';
import { TOOL_REGISTRY } from './tools/index.js';
import { refreshSupermarketCache } from './tools/supermarket.js';
import { speechToText, understandImageForChat } from './multimodal.js';
import { loadPreferences, savePreferences, resetPreferences } from './preferences.js';

const API_VERSION = '1.1.0';
const PROMPT_VERSION = `v2.4-${new Date().toISOString().slice(0, 10)}`;

// --- Rate Limiter (KV-based, per IP, session-aware) ---

async function checkRateLimit(kv, ip, tier = 'public') {
  if (!kv || !ip) return true;
  const limits = {
    public: 15,      // 15/min for anonymous
    session: 30,     // 30/min for users with session
    auth: 60,        // 60/min for authenticated
  };
  const maxReq = limits[tier] || 15;
  const key = `rl:${tier}:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  try {
    const data = await kv.get(key, 'json');
    if (!data || data.window !== Math.floor(now / 60)) {
      await kv.put(key, JSON.stringify({ window: Math.floor(now / 60), count: 1 }), { expirationTtl: 120 });
      return true;
    }
    if (data.count >= maxReq) return false;
    data.count++;
    await kv.put(key, JSON.stringify(data), { expirationTtl: 120 });
    return true;
  } catch {
    return true;
  }
}

// --- Auth ---

function verifyAuth(request, env) {
  const token = env.API_AUTH_TOKEN;
  if (!token) return true;
  const auth = request.headers.get('Authorization');
  if (!auth) return false;
  return auth === `Bearer ${token}`;
}

// --- Multimodal Validation ---

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

const IMAGE_SIGNATURES = {
  'ffd8ff': 'image/jpeg',
  '89504e47': 'image/png',
  '52494646': 'image/webp', // RIFF (could also be other formats)
  '47494638': 'image/gif',
};

function detectBase64ImageType(base64Str) {
  try {
    // Remove data URI prefix if present
    const raw = base64Str.replace(/^data:[^;]+;base64,/, '');
    const bytes = atob(raw.substring(0, 16));
    const hex = Array.from(bytes).map(b => b.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    for (const [sig, type] of Object.entries(IMAGE_SIGNATURES)) {
      if (hex.startsWith(sig)) return type;
    }
    return null;
  } catch {
    return null;
  }
}

function validateImageInput(imageUrl, imageBase64) {
  const errors = [];
  
  if (imageUrl) {
    try {
      const u = new URL(imageUrl);
      if (!['http:', 'https:'].includes(u.protocol)) errors.push('Image URL must use http or https');
      // Reject SVG
      if (imageUrl.toLowerCase().endsWith('.svg')) errors.push('SVG images are not supported. Please use JPEG, PNG, or WebP.');
      if (imageUrl.toLowerCase().endsWith('.gif')) errors.push('GIF images are not supported. Please use JPEG, PNG, or WebP.');
    } catch {
      errors.push('Invalid image URL');
    }
  }
  
  if (imageBase64) {
    // Check size
    const sizeEstimate = (imageBase64.length * 3) / 4;
    if (sizeEstimate > MAX_IMAGE_SIZE) {
      errors.push(`Image too large (${(sizeEstimate / 1024 / 1024).toFixed(1)}MB). Max: 10MB.`);
    }
    // Check format
    const detectedType = detectBase64ImageType(imageBase64);
    if (detectedType === 'image/gif') {
      errors.push('GIF images are not supported. Please use JPEG, PNG, or WebP.');
    }
    if (detectedType && !ALLOWED_IMAGE_TYPES.includes(detectedType)) {
      errors.push(`Unsupported image format: ${detectedType}. Use JPEG, PNG, or WebP.`);
    }
  }
  
  return errors;
}

function validateAudioInput(audioBase64) {
  if (!audioBase64) return [];
  const errors = [];
  const sizeEstimate = (audioBase64.length * 3) / 4;
  if (sizeEstimate > MAX_AUDIO_SIZE) {
    errors.push(`Audio too large (${(sizeEstimate / 1024 / 1024).toFixed(1)}MB). Max: 25MB.`);
  }
  return errors;
}

// --- Route Handler ---

function resolveRoute(pathname) {
  // Support both /api/v1/* and /api/* (backward compat)
  const v1Match = pathname.match(/^\/api\/v1(\/.*)/);
  if (v1Match) return v1Match[1];
  const apiMatch = pathname.match(/^\/api(\/.*)/);
  if (apiMatch) return apiMatch[1];
  return pathname;
}

// --- CORS Origin Whitelist ---

function getCorsOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  // Configurable via env: comma-separated list of allowed origins
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  // Always allow localhost for development
  const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8787', 'http://127.0.0.1:3000'];
  const allAllowed = [...allowed, ...devOrigins];
  // If ALLOWED_ORIGINS not set (dev mode), allow all
  if (allowed.length === 0) return '*';
  // Check if origin is in whitelist
  if (allAllowed.includes(origin)) return origin;
  // Default: reject (return first allowed origin)
  return allowed[0];
}

// --- Main Worker ---

export default {
  async scheduled(event, env, ctx) {
    console.log(`[scheduled] cron fired: ${event.cron}`);

    // Daily: supermarket cache refresh (existing)
    if (event.cron === '0 20 * * *') {
      ctx.waitUntil(refreshSupermarketCache(env));
      return;
    }

    // RAG auto-updates by schedule
    const { runScheduledUpdate } = await import('./rag-updater.js');

    const cronToSchedule = {
      '0 18 * * 0':        'weekly',     // Every Sunday: scams
      '0 16 1 * *':        'monthly',    // 1st of month: visa, telco, finance
      '0 14 1 1,4,7,10 *': 'quarterly',  // Jan/Apr/Jul/Oct: rental, insurance
      '0 12 1 3 *':        'annual',     // March 1st: schools, tax, housing
    };

    const schedule = cronToSchedule[event.cron];
    if (schedule) {
      ctx.waitUntil(
        runScheduledUpdate(schedule, env)
          .then(report => console.log(`[RAG Update] ${schedule} complete:`, JSON.stringify(report).slice(0, 500)))
          .catch(err => console.error(`[RAG Update] ${schedule} failed:`, err.message))
      );
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsOrigin = getCorsOrigin(request, env);
    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      const route = resolveRoute(url.pathname);
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

      // Public endpoints (no auth)
      if (url.pathname === '/health') {
        return json({ status: 'ok', service: 'australian-assistant-api', version: API_VERSION, tools: Object.keys(TOOL_REGISTRY) }, cors);
      }

      if (route === '/status') {
        return json({
          status: 'ok',
          version: API_VERSION,
          timestamp: new Date().toISOString(),
          services: {
            api_server: true,
            vectorize: true,
            d1: true,
            llm: !!env.DASHSCOPE_API_KEY || !!env.DEEPSEEK_API_KEY || !!env.AI,
            llm_provider: env.DASHSCOPE_API_KEY ? 'Qwen (DashScope)' : env.DEEPSEEK_API_KEY ? 'DeepSeek API' : 'Cloudflare Workers AI',
            multimodal: { vision: true, speech_to_text: true },
          },
          tools: Object.keys(TOOL_REGISTRY),
          tool_count: Object.keys(TOOL_REGISTRY).length,
          endpoints: {
            chat: '/api/v1/chat',
            stream: '/api/v1/chat/stream',
            transcribe: '/api/v1/transcribe',
            vision: '/api/v1/vision',
            status: '/api/v1/status',
            preferences: '/api/v1/preferences',
            feedback: '/api/v1/feedback',
          },
          prompt_version: PROMPT_VERSION,
        }, cors);
      }

      // Detailed health check
      if (route === '/health/detailed') {
        const checks = {};
        // Check KV
        try { await env.KV?.get('_health_check'); checks.kv = 'ok'; } catch (e) { checks.kv = `error: ${e.message}`; }
        // Check D1
        try { const r = await env.DB?.prepare('SELECT 1').first(); checks.d1 = r ? 'ok' : 'empty'; } catch (e) { checks.d1 = `error: ${e.message}`; }
        // Check Vectorize
        try { checks.vectorize = env.VECTORIZE ? 'bound' : 'not bound'; } catch { checks.vectorize = 'error'; }
        // Check AI
        checks.ai = env.AI ? 'bound' : 'not bound';
        checks.llm_key = env.DASHSCOPE_API_KEY ? 'configured' : env.DEEPSEEK_API_KEY ? 'configured (deepseek)' : 'not configured';
        checks.tavily = env.TAVILY_API_KEY ? 'configured' : 'not configured';
        checks.google = env.GOOGLE_PLACES_API_KEY ? 'configured' : 'not configured';

        return json({ status: 'ok', version: API_VERSION, checks }, cors);
      }

      // --- Browser Rendering Proxy (for crawl scripts) ---
      if (route === '/browser-render') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, cors, 405);
        if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, cors, 401);
        if (!env.BROWSER) return json({ error: 'Browser Rendering not configured' }, cors, 500);

        const { url: targetUrl } = await request.json();
        if (!targetUrl) return json({ error: 'url is required' }, cors, 400);

        try {
          const puppeteer = await import('@cloudflare/puppeteer');
          const browser = await puppeteer.default.launch(env.BROWSER);
          const page = await browser.newPage();
          await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

          // Extract text content and title
          const title = await page.title();
          const content = await page.evaluate(() => {
            // Remove nav, header, footer, script, style
            for (const el of document.querySelectorAll('nav, header, footer, script, style, [role="navigation"], .cookie-banner, #cookie-banner')) {
              el.remove();
            }
            return document.body?.innerText || '';
          });

          await browser.close();

          return json({
            success: true,
            result: {
              url: targetUrl,
              title,
              markdown: content,
            }
          }, cors);
        } catch (err) {
          return json({ success: false, error: err.message }, cors, 500);
        }
      }

      // --- Chat endpoints ---
      if (route === '/chat' || route === '/chat/stream') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, cors, 405);

        // Determine rate limit tier
        const hasSession = request.headers.get('x-session-id');
        const isAuth = verifyAuth(request, env);
        const tier = isAuth && env.API_AUTH_TOKEN ? 'auth' : hasSession ? 'session' : 'public';
        
        if (!(await checkRateLimit(env.KV, clientIP, tier))) {
          return json({ error: 'Too many requests. Please wait a moment.', retry_after: 60 }, cors, 429);
        }

        // Validate multimodal inputs if present
        let body;
        try {
          body = await request.clone().json();
        } catch {
          return json({ error: 'Invalid JSON body' }, cors, 400);
        }

        if (body.image_url || body.image_base64) {
          const imgErrors = validateImageInput(body.image_url, body.image_base64);
          if (imgErrors.length > 0) {
            return json({ 
              error: 'Invalid image input', 
              details: imgErrors,
              supported_formats: ['JPEG', 'PNG', 'WebP', 'BMP', 'TIFF'],
              max_size: '10MB',
            }, cors, 400);
          }
        }

        if (body.audio_base64 || body.audio_url) {
          const audioErrors = validateAudioInput(body.audio_base64);
          if (audioErrors.length > 0) {
            return json({ error: 'Invalid audio input', details: audioErrors, max_size: '25MB' }, cors, 400);
          }
        }

        return route === '/chat/stream'
          ? await handleChatStream(request, env, cors, ctx)
          : await handleChat(request, env, cors, ctx);
      }

      // --- Speech-to-text ---
      if (route === '/transcribe') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, cors, 405);
        if (!(await checkRateLimit(env.KV, clientIP, 'session'))) {
          return json({ error: 'Too many requests.' }, cors, 429);
        }
        try {
          const contentType = request.headers.get('Content-Type') || '';
          let audioData;
          if (contentType.includes('application/json')) {
            const body = await request.json();
            audioData = body.audio_base64 || body.audio;
          } else {
            audioData = await request.arrayBuffer();
          }
          if (!audioData) return json({ error: 'No audio data. Send audio_base64 in JSON or binary audio.' }, cors, 400);
          const result = await speechToText(audioData, env);
          return json(result, cors);
        } catch (err) {
          return json({ error: `Transcription failed: ${err.message}` }, cors, 500);
        }
      }

      // --- Vision ---
      if (route === '/vision') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, cors, 405);
        if (!(await checkRateLimit(env.KV, clientIP, 'session'))) {
          return json({ error: 'Too many requests.' }, cors, 429);
        }
        try {
          const body = await request.json();
          const { image_url, image_base64, question } = body;
          if (!image_url && !image_base64) return json({ error: 'Provide image_url or image_base64' }, cors, 400);

          // Validate format
          const imgErrors = validateImageInput(image_url, image_base64);
          if (imgErrors.length > 0) {
            return json({
              error: 'Invalid image',
              details: imgErrors,
              supported_formats: ['JPEG', 'PNG', 'WebP'],
            }, cors, 400);
          }

          const result = await understandImageForChat(image_url, image_base64, question || '请分析这张图片', env);
          return json(result, cors);
        } catch (err) {
          return json({ error: `Vision failed: ${err.message}` }, cors, 500);
        }
      }

      // --- User Preferences ---
      if (route === '/preferences') {
        const userId = request.headers.get('x-session-id') || 'default';
        if (request.method === 'GET') {
          const prefs = await loadPreferences(env.KV, userId);
          return json({ preferences: prefs, user_id: userId }, cors);
        }
        if (request.method === 'PUT' || request.method === 'POST') {
          try {
            const body = await request.json();
            const current = await loadPreferences(env.KV, userId);
            // Only allow updating specific safe fields
            const ALLOWED_FIELDS = ['home_city', 'home_suburb', 'preferred_state', 'visa_type', 'family_status', 'dietary', 'language'];
            for (const key of ALLOWED_FIELDS) {
              if (body[key] !== undefined) current[key] = body[key];
            }
            // If user explicitly sets home_city, reset frequency counter to match
            if (body.home_city) {
              current._city_counts = { [body.home_city]: 3 }; // match CITY_CONFIDENCE_THRESHOLD
            }
            await savePreferences(env.KV, userId, current);
            return json({ ok: true, preferences: current }, cors);
          } catch {
            return json({ error: 'Invalid JSON body' }, cors, 400);
          }
        }
        // DELETE: Reset preferences (full or partial)
        if (request.method === 'DELETE') {
          try {
            let fields = null;
            // Support optional body with { fields: ['home_city', 'home_suburb'] }
            try {
              const body = await request.json();
              fields = body?.fields || null;
            } catch { /* no body = full reset */ }
            const reset = await resetPreferences(env.KV, userId, fields);
            return json({
              ok: true,
              reset_type: fields ? 'partial' : 'full',
              fields_reset: fields || 'all',
              preferences: reset
            }, cors);
          } catch {
            return json({ error: 'Reset failed' }, cors, 500);
          }
        }
        return json({ error: 'GET, PUT/POST, or DELETE' }, cors, 405);
      }

      // --- User Feedback (A/B testing) ---
      if (route === '/feedback') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, cors, 405);
        try {
          const body = await request.json();
          const { session_id, rating, message_id, comment } = body;
          if (!session_id || rating === undefined) {
            return json({ error: 'session_id and rating (1-5) required' }, cors, 400);
          }
          // Store feedback in D1
          if (env.DB) {
            try {
              await env.DB.prepare(
                `INSERT INTO feedback (session_id, message_id, rating, comment, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?)`
              ).bind(
                session_id,
                message_id || null,
                Math.min(5, Math.max(1, Number(rating))),
                (comment || '').substring(0, 500),
                PROMPT_VERSION,
                new Date().toISOString()
              ).run();
            } catch (dbErr) {
              console.error('Feedback DB error:', dbErr.message);
              // Table might not exist yet — try to create it
              try {
                await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  session_id TEXT,
                  message_id TEXT,
                  rating INTEGER,
                  comment TEXT,
                  prompt_version TEXT,
                  created_at TEXT
                )`).run();
                await env.DB.prepare(
                  `INSERT INTO feedback (session_id, message_id, rating, comment, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(session_id, message_id || null, Math.min(5, Math.max(1, Number(rating))), (comment || '').substring(0, 500), PROMPT_VERSION, new Date().toISOString()).run();
              } catch { /* ignore */ }
            }
          }
          return json({ ok: true, prompt_version: PROMPT_VERSION }, cors);
        } catch {
          return json({ error: 'Invalid JSON' }, cors, 400);
        }
      }

      // --- Protected endpoints ---
      if (!verifyAuth(request, env)) {
        return json({ error: 'Unauthorized' }, cors, 401);
      }
      if (!(await checkRateLimit(env.KV, clientIP, 'auth'))) {
        return json({ error: 'Too many requests.' }, cors, 429);
      }

      // RAG auto-update status & manual trigger
      if (route === '/rag/status') {
        const { getUpdateStatus } = await import('./rag-updater.js');
        const status = await getUpdateStatus(env);
        return json({ status, timestamp: new Date().toISOString() }, cors);
      }

      if (route === '/rag/trigger' && request.method === 'POST') {
        const { category } = await request.json();
        if (!category) return json({ error: 'category required (e.g. "scams", "rental")' }, cors, 400);
        const { triggerCategoryUpdate } = await import('./rag-updater.js');
        const result = await triggerCategoryUpdate(category, env);
        return json({ result, timestamp: new Date().toISOString() }, cors);
      }

      if (route === '/rag/search') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, cors, 405);
        return await handleRAGSearch(request, env, cors);
      }

      // 404
      return json({
        error: 'Not found',
        version: API_VERSION,
        available: {
          v1: ['/api/v1/chat', '/api/v1/chat/stream', '/api/v1/transcribe', '/api/v1/vision', '/api/v1/status', '/api/v1/preferences', '/api/v1/feedback', '/api/v1/health/detailed'],
          legacy: ['/api/chat', '/api/chat/stream', '/api/transcribe', '/api/vision', '/api/status'],
          public: ['/health'],
        },
      }, cors, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return json({ error: 'Internal server error', version: API_VERSION }, cors, 500);
    }
  }
};

export function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}
