/**
 * Cache Layer — Cloudflare Workers KV-based caching for API calls
 *
 * Reduces Tavily API usage by caching search results.
 * Falls back to no-cache if KV namespace not bound.
 *
 * Usage:
 *   const cache = new ToolCache(env);
 *   const cached = await cache.get('tavily', query, domains);
 *   if (cached) return cached;
 *   const result = await actualAPICall();
 *   await cache.set('tavily', query, domains, result, 7200);
 *   return result;
 */

export class ToolCache {
    /**
     * @param {Object} env - Cloudflare Workers env bindings
     * @param {string} [kvBindingName='TOOL_CACHE'] - Name of the KV namespace binding
     */
    constructor(env, kvBindingName = 'TOOL_CACHE') {
        this.kv = env?.[kvBindingName] || null;
    }

    /**
     * Generate a deterministic cache key from tool name + query + optional domains
     * @param {string} tool - Tool name (e.g., 'tavily', 'hotdoc', 'domain')
     * @param {string} query - Search query
     * @param {Array<string>} [domains=[]] - Domain filter
     * @returns {string} Cache key
     */
    _makeKey(tool, query, domains = []) {
        const normalized = `${tool}:${query.toLowerCase().trim()}:${domains.sort().join(',')}`;
        // Simple hash — good enough for cache keys, avoids crypto import
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const chr = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return `cache:${tool}:${Math.abs(hash).toString(36)}`;
    }

    /**
     * Get cached value
     * @param {string} tool - Tool name
     * @param {string} query - Search query
     * @param {Array<string>} [domains=[]] - Domain filter
     * @returns {Object|null} Cached data or null if miss
     */
    async get(tool, query, domains = []) {
        if (!this.kv) return null;
        try {
            const key = this._makeKey(tool, query, domains);
            const value = await this.kv.get(key, { type: 'json' });
            if (value) {
                value._cached = true;
                value._cache_key = key;
            }
            return value;
        } catch {
            return null;
        }
    }

    /**
     * Set cached value with TTL
     * @param {string} tool - Tool name
     * @param {string} query - Search query
     * @param {Array<string>} [domains=[]] - Domain filter
     * @param {Object} data - Data to cache
     * @param {number} [ttlSeconds=7200] - Time-to-live in seconds (default 2 hours)
     */
    async set(tool, query, domains = [], data, ttlSeconds = 7200) {
        if (!this.kv) return;
        try {
            const key = this._makeKey(tool, query, domains);
            // Strip large fields to save KV storage
            const toCache = { ...data };
            delete toCache._cached;
            delete toCache._cache_key;
            await this.kv.put(key, JSON.stringify(toCache), {
                expirationTtl: Math.max(60, ttlSeconds) // Minimum 60s
            });
        } catch (e) {
            console.error('Cache set failed:', e.message);
        }
    }
}

// ─── TTL Presets ───
export const CACHE_TTL = {
    WEB_SEARCH: 2 * 3600,      // 2 hours — general web search
    HOTDOC: 30 * 60,            // 30 minutes — appointment availability changes fast
    DOMAIN_SEARCH: 30 * 60,     // 30 minutes — rental listings change fast
    WEATHER: 30 * 60,           // 30 minutes — weather updates frequently
    SUPERMARKET: 6 * 3600,      // 6 hours — specials usually weekly
    FUEL: 2 * 3600,             // 2 hours — fuel prices change daily
    TRANSPORT: 5 * 60,          // 5 minutes — real-time departures
    STATIC: 24 * 3600,          // 24 hours — holidays, AQF, postcodes
};
