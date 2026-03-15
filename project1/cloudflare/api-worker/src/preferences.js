/**
 * User Preferences — KV-based cross-session preference memory
 * Stores and retrieves user preferences to personalize responses
 * 
 * v2.4 Fixes:
 * - last_topics now stores {topic, agent, ts} instead of plain strings
 * - home_city is updatable (not permanently locked)
 * - suburb regex tightened to avoid false matches
 * - Added resetPreferences() for explicit user resets
 */

const PREF_TTL = 86400 * 90; // 90 days

// Minimum interaction count before we lock a learned city
const CITY_CONFIDENCE_THRESHOLD = 3;

const DEFAULT_PREFS = {
  language: null,        // 'zh' or 'en' - detected from usage
  home_city: null,       // e.g. 'Sydney', 'Melbourne'
  home_suburb: null,     // e.g. 'Chatswood', 'CBD'
  _city_counts: {},      // Internal: { Sydney: 5, Melbourne: 1 } — track frequency
  dietary: [],           // e.g. ['halal', 'vegetarian', 'chinese']
  interests: [],         // e.g. ['property', 'jobs', 'weather']
  commute: null,         // e.g. { from: 'Chatswood', to: 'CBD' }
  family_status: null,   // e.g. 'single', 'couple', 'family'
  visa_type: null,       // e.g. 'PR', '500', '482', 'citizen'
  car: null,             // e.g. { make: 'Toyota', model: 'Corolla', year: 2018 }
  has_insurance: null,   // e.g. { car: true, contents: false, oshc: true }
  preferred_state: null, // e.g. 'NSW', 'VIC'
  recent_queries: [],    // last 5 query summaries for context
  interaction_count: 0,
  last_topics: [],       // last 5: [{topic, agent, ts}]
  created_at: null,
  updated_at: null
};

/**
 * Load user preferences from KV
 */
export async function loadPreferences(kv, userId) {
  if (!kv || !userId) return { ...DEFAULT_PREFS };
  try {
    const data = await kv.get(`pref:${userId}`, 'json');
    return data ? { ...DEFAULT_PREFS, ...data } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Save user preferences to KV
 */
export async function savePreferences(kv, userId, prefs) {
  if (!kv || !userId) return;
  try {
    prefs.updated_at = new Date().toISOString();
    if (!prefs.created_at) prefs.created_at = prefs.updated_at;
    await kv.put(`pref:${userId}`, JSON.stringify(prefs), { expirationTtl: PREF_TTL });
  } catch (e) {
    console.error('Failed to save preferences:', e.message);
  }
}

/**
 * Reset user preferences — allows user to clear specific fields or all
 * @param {string[]} fields - Fields to reset, or empty/null for full reset
 */
export async function resetPreferences(kv, userId, fields = null) {
  if (!kv || !userId) return { ...DEFAULT_PREFS };
  if (!fields || fields.length === 0) {
    // Full reset
    await kv.delete(`pref:${userId}`);
    return { ...DEFAULT_PREFS };
  }
  // Partial reset: only clear specified fields
  const prefs = await loadPreferences(kv, userId);
  for (const field of fields) {
    if (field in DEFAULT_PREFS) {
      prefs[field] = Array.isArray(DEFAULT_PREFS[field])
        ? [] : (typeof DEFAULT_PREFS[field] === 'number' ? 0 : null);
    }
  }
  // Also reset internal counters if resetting city
  if (fields.includes('home_city')) prefs._city_counts = {};
  await savePreferences(kv, userId, prefs);
  return prefs;
}

/**
 * Auto-learn preferences from conversation context
 * Called after each chat to update preferences based on usage patterns
 */
export function learnFromConversation(prefs, message, analysis, toolResults) {
  const updated = { ...prefs };
  updated.interaction_count = (updated.interaction_count || 0) + 1;

  // Learn language preference
  const lang = analysis?.language;
  if (lang && !updated.language) {
    updated.language = lang;
  }

  // ── Learn location from queries (updatable, frequency-based) ──
  // Instead of locking on first mention, track city frequency.
  // The most-mentioned city becomes home_city.
  const cityPatterns = [
    { pattern: /悉尼|sydney/i, city: 'Sydney' },
    { pattern: /墨尔本|melbourne/i, city: 'Melbourne' },
    { pattern: /布里斯班|brisbane/i, city: 'Brisbane' },
    { pattern: /珀斯|perth/i, city: 'Perth' },
    { pattern: /阿德莱德|adelaide/i, city: 'Adelaide' },
    { pattern: /堪培拉|canberra/i, city: 'Canberra' },
    { pattern: /霍巴特|hobart/i, city: 'Hobart' },
    { pattern: /达尔文|darwin/i, city: 'Darwin' },
    { pattern: /黄金海岸|gold coast/i, city: 'Gold Coast' },
  ];
  if (!updated._city_counts) updated._city_counts = {};
  for (const { pattern, city } of cityPatterns) {
    if (pattern.test(message)) {
      updated._city_counts[city] = (updated._city_counts[city] || 0) + 1;
    }
  }
  // Set home_city to the most frequently mentioned city (with minimum threshold)
  const topCity = Object.entries(updated._city_counts)
    .sort((a, b) => b[1] - a[1])[0];
  if (topCity && topCity[1] >= CITY_CONFIDENCE_THRESHOLD) {
    if (updated.home_city !== topCity[0]) {
      console.log(`[Preferences] home_city updated: ${updated.home_city} → ${topCity[0]} (mentioned ${topCity[1]}x)`);
      updated.home_city = topCity[0];
    }
  } else if (!updated.home_city && topCity) {
    // First-time: set immediately but can be overridden later
    updated.home_city = topCity[0];
  }

  // ── Learn suburb — tightened regex ──
  // Only match explicit residential context, not casual mentions like "在 Coles 买东西"
  // Requires: "住在/live in/home in" + suburb name (2+ words or known format)
  if (!updated.home_suburb) {
    const suburbMatch = message.match(
      /(?:住在|家在|live\s+in|home\s+in|based\s+in|located\s+in|搬到|moved\s+to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[\u4e00-\u9fff]{2,6})/i
    );
    if (suburbMatch) {
      const candidate = suburbMatch[1].trim();
      // Validate: must look like a suburb name (capitalized word or Chinese chars)
      // Reject: common non-suburb words
      const rejectList = /^(coles|woolworths|aldi|kmart|target|bunnings|ikea|costco|jbhifi|officeworks|myer|david jones|chemist|pharmacy|hospital|uni|university|station|airport|school|work|office|home|australia|here|there|the)$/i;
      if (candidate.length >= 3 && candidate.length <= 30 && !rejectList.test(candidate)) {
        updated.home_suburb = candidate;
      }
    }
  }

  // Learn dietary preferences
  const dietaryMap = {
    '素食|vegetarian|vegan': 'vegetarian',
    '清真|halal': 'halal',
    '中餐|chinese food': 'chinese',
    '日料|japanese': 'japanese',
    '韩餐|korean': 'korean',
    '印度|indian': 'indian',
    '意大利|italian|pasta|pizza': 'italian',
    '海鲜|seafood': 'seafood',
  };
  for (const [pattern, diet] of Object.entries(dietaryMap)) {
    if (new RegExp(pattern, 'i').test(message) && !updated.dietary.includes(diet)) {
      updated.dietary.push(diet);
      if (updated.dietary.length > 5) updated.dietary.shift();
    }
  }

  // Learn interests from tool usage
  const topicMap = {
    weather: 'weather', property: 'property', jobs: 'jobs',
    tax_calculator: 'finance', exchange_rate: 'finance',
    centrelink: 'welfare', energy_compare: 'living',
    bank_rates: 'finance', medicine: 'health',
    healthcare: 'health', education: 'education',
    public_transport: 'transport', maps_assistant: 'local_explore'
  };
  for (const tool of (analysis?.tool_calls || [])) {
    const interest = topicMap[tool.tool];
    if (interest && !updated.interests.includes(interest)) {
      updated.interests.push(interest);
      if (updated.interests.length > 8) updated.interests.shift();
    }
  }

  // ── Track recent topics with agent attribution ──
  // Format: [{topic, agent, ts}] — allows filtering by agent later
  const intents = analysis?.intents || [];
  const agentName = Array.isArray(intents) && typeof intents[0] === 'string'
    ? intents[0] : (intents[0]?.agent || 'unknown');
  const now = new Date().toISOString();
  if (intents.length > 0) {
    const newTopics = intents.map(intent => {
      const topic = typeof intent === 'string' ? intent : (intent.topic || intent);
      return { topic, agent: agentName, ts: now };
    });
    // Migrate legacy string topics to new format
    const existingTopics = (updated.last_topics || []).map(t =>
      typeof t === 'string' ? { topic: t, agent: 'unknown', ts: now } : t
    );
    updated.last_topics = [...newTopics, ...existingTopics].slice(0, 8);
  }

  // Learn family status
  if (!updated.family_status) {
    if (/孩子|小孩|child|kids|育儿|family tax|FTB/.test(message)) updated.family_status = 'family';
    else if (/配偶|老婆|老公|spouse|partner|couple/.test(message)) updated.family_status = 'couple';
    else if (/单身|single|一个人/.test(message)) updated.family_status = 'single';
  }

  // Learn visa type
  if (!updated.visa_type) {
    if (/PR|永居|permanent resident/i.test(message)) updated.visa_type = 'PR';
    else if (/公民|citizen/i.test(message)) updated.visa_type = 'citizen';
    else if (/学生签|student visa|500签/i.test(message)) updated.visa_type = '500';
    else if (/工作签|work visa|482|494|186/i.test(message)) {
      const visaMatch = message.match(/\b(482|494|186|189|190|491)\b/);
      updated.visa_type = visaMatch ? visaMatch[1] : 'work_visa';
    }
  }

  return updated;
}

/**
 * Build preference context string for LLM system prompt
 */
export function buildPreferenceContext(prefs) {
  if (!prefs || prefs.interaction_count === 0) return '';

  const parts = [];
  if (prefs.home_city) parts.push(`用户常在${prefs.home_city}`);
  if (prefs.home_suburb) parts.push(`住在${prefs.home_suburb}附近`);
  if (prefs.dietary.length > 0) parts.push(`饮食偏好: ${prefs.dietary.join(', ')}`);
  if (prefs.family_status) parts.push(`家庭状态: ${prefs.family_status}`);
  if (prefs.visa_type) parts.push(`签证类型: ${prefs.visa_type}`);
  if (prefs.interests.length > 0) parts.push(`关注领域: ${prefs.interests.join(', ')}`);
  if (prefs.car) parts.push(`车辆: ${prefs.car.year || ''} ${prefs.car.make || ''} ${prefs.car.model || ''}`);
  if (prefs.preferred_state) parts.push(`常用州: ${prefs.preferred_state}`);
  if (prefs.interaction_count > 1) parts.push(`第${prefs.interaction_count}次使用`);
  // Show recent agent-tagged topics for cross-domain awareness
  if (prefs.last_topics?.length > 0) {
    const topicSummary = prefs.last_topics.slice(0, 3).map(t =>
      typeof t === 'string' ? t : `${t.topic}(${t.agent})`
    ).join(', ');
    parts.push(`最近话题: ${topicSummary}`);
  }

  if (parts.length === 0) return '';
  return `\n【用户偏好】${parts.join('；')}`;
}
