/**
 * Job Search Tool — Adzuna API (免费 tier) + 内置薪资数据
 * 
 * Adzuna API: https://developer.adzuna.com/ 
 * Free: 250 calls/month
 * 不需要 API Key 时使用内置薪资指南 + web search
 */

// 澳洲常见职业薪资范围 (AUD/year, 2025-2026)
const SALARY_GUIDE = {
  // IT & Tech
  'software engineer': { min: 90000, max: 160000, median: 120000, demand: 'high' },
  'frontend developer': { min: 80000, max: 140000, median: 105000, demand: 'high' },
  'backend developer': { min: 90000, max: 150000, median: 115000, demand: 'high' },
  'full stack developer': { min: 85000, max: 150000, median: 115000, demand: 'high' },
  'data scientist': { min: 95000, max: 170000, median: 130000, demand: 'high' },
  'data analyst': { min: 70000, max: 120000, median: 90000, demand: 'high' },
  'devops engineer': { min: 100000, max: 170000, median: 135000, demand: 'high' },
  'cloud engineer': { min: 100000, max: 170000, median: 130000, demand: 'high' },
  'cybersecurity': { min: 95000, max: 170000, median: 130000, demand: 'very high' },
  'product manager': { min: 100000, max: 180000, median: 140000, demand: 'high' },
  'ux designer': { min: 80000, max: 140000, median: 105000, demand: 'medium' },
  'it support': { min: 55000, max: 85000, median: 68000, demand: 'medium' },
  'qa engineer': { min: 75000, max: 130000, median: 100000, demand: 'medium' },
  'mobile developer': { min: 85000, max: 150000, median: 115000, demand: 'high' },
  'ai engineer': { min: 110000, max: 200000, median: 150000, demand: 'very high' },

  // Business & Finance
  'accountant': { min: 60000, max: 110000, median: 80000, demand: 'high' },
  'financial analyst': { min: 70000, max: 130000, median: 95000, demand: 'medium' },
  'business analyst': { min: 80000, max: 140000, median: 105000, demand: 'high' },
  'project manager': { min: 90000, max: 160000, median: 120000, demand: 'high' },
  'marketing manager': { min: 80000, max: 140000, median: 105000, demand: 'medium' },
  'hr manager': { min: 85000, max: 140000, median: 110000, demand: 'medium' },

  // Healthcare
  'nurse': { min: 65000, max: 105000, median: 82000, demand: 'very high' },
  'registered nurse': { min: 65000, max: 105000, median: 82000, demand: 'very high' },
  'doctor': { min: 100000, max: 300000, median: 180000, demand: 'very high' },
  'pharmacist': { min: 70000, max: 110000, median: 85000, demand: 'high' },
  'dentist': { min: 100000, max: 200000, median: 140000, demand: 'high' },
  'physiotherapist': { min: 65000, max: 100000, median: 78000, demand: 'high' },
  'psychologist': { min: 70000, max: 120000, median: 90000, demand: 'high' },

  // Trades & Construction
  'electrician': { min: 65000, max: 120000, median: 85000, demand: 'very high' },
  'plumber': { min: 65000, max: 120000, median: 85000, demand: 'very high' },
  'carpenter': { min: 60000, max: 100000, median: 75000, demand: 'high' },
  'mechanic': { min: 55000, max: 90000, median: 70000, demand: 'medium' },
  'construction worker': { min: 55000, max: 90000, median: 70000, demand: 'high' },
  'civil engineer': { min: 75000, max: 140000, median: 100000, demand: 'high' },

  // Hospitality & Retail
  'chef': { min: 55000, max: 85000, median: 65000, demand: 'high' },
  'barista': { min: 45000, max: 58000, median: 50000, demand: 'medium' },
  'waiter': { min: 42000, max: 55000, median: 48000, demand: 'medium' },
  'retail assistant': { min: 42000, max: 55000, median: 48000, demand: 'medium' },
  'hotel manager': { min: 65000, max: 110000, median: 80000, demand: 'medium' },

  // Education
  'teacher': { min: 70000, max: 110000, median: 85000, demand: 'high' },
  'university lecturer': { min: 90000, max: 150000, median: 115000, demand: 'medium' },
  'tutor': { min: 40000, max: 65000, median: 50000, demand: 'medium' },

  // Other
  'lawyer': { min: 70000, max: 200000, median: 110000, demand: 'medium' },
  'architect': { min: 65000, max: 130000, median: 90000, demand: 'medium' },
  'graphic designer': { min: 55000, max: 95000, median: 72000, demand: 'medium' },
  'social worker': { min: 60000, max: 95000, median: 75000, demand: 'high' },
  'real estate agent': { min: 45000, max: 150000, median: 80000, demand: 'medium' }
};


// 最低工资
const MIN_WAGE = {
  national: { hourly: 24.10, weekly: 915.90, annual: 47607 },
  casual_loading: 1.25, // 25% casual loading
  updated: '2024-07-01',
  note: 'National Minimum Wage as of 1 July 2024. Some awards/agreements may set higher rates.'
};

function findJob(query) {
  const lower = query.toLowerCase().trim();
  
  // Direct match
  if (SALARY_GUIDE[lower]) return { key: lower, ...SALARY_GUIDE[lower] };
  
  // Partial match
  for (const [key, data] of Object.entries(SALARY_GUIDE)) {
    if (key.includes(lower) || lower.includes(key)) {
      return { key, ...data };
    }
  }
  
  // Word match
  const words = lower.split(/[\s,]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const [key, data] of Object.entries(SALARY_GUIDE)) {
      if (key.includes(word)) return { key, ...data };
    }
  }
  
  return null;
}

export async function searchJobs(args, env) {
  const query = args.query || '';
  const location = args.location || 'Sydney';
  
  if (!query) return { error: 'Please provide a job title or field' };

  // Check if asking about minimum wage
  if (/最低工资|minimum wage|min wage/.test(query.toLowerCase())) {
    return {
      query,
      type: 'minimum_wage',
      minimum_wage: MIN_WAGE,
      casual_rate: `$${(MIN_WAGE.national.hourly * MIN_WAGE.casual_loading).toFixed(2)}/hr`,
      tip: 'Check Fair Work Pay Calculator for specific award rates: https://calculate.fairwork.gov.au'
    };
  }

  // Try Adzuna API if key available
  if (env?.ADZUNA_APP_ID && env?.ADZUNA_API_KEY) {
    try {
      return await adzunaSearch(env.ADZUNA_APP_ID, env.ADZUNA_API_KEY, query, location);
    } catch (e) {
      console.error('Adzuna failed:', e.message);
    }
  }

  // Built-in salary guide
  const job = findJob(query);
  
  if (job) {
    const medianMonthly = Math.round(job.median / 12);
    const afterTax = estimateAfterTax(job.median);
    
    return {
      query,
      location,
      type: 'salary_guide',
      job_title: job.key,
      salary_range: {
        min: `$${(job.min / 1000).toFixed(0)}k`,
        max: `$${(job.max / 1000).toFixed(0)}k`,
        median: `$${(job.median / 1000).toFixed(0)}k`,
        monthly_gross: `$${medianMonthly.toLocaleString()}`,
        monthly_after_tax: `~$${afterTax.toLocaleString()}`
      },
      demand: job.demand,
      minimum_wage: `$${MIN_WAGE.national.hourly}/hr (national)`,
      search_links: {
        seek: `https://www.seek.com.au/${encodeURIComponent(job.key)}-jobs/in-${location}`,
        indeed: `https://au.indeed.com/jobs?q=${encodeURIComponent(job.key)}&l=${encodeURIComponent(location)}`,
        linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.key)}&location=${encodeURIComponent(location + ', Australia')}`
      },
      tips: [
        `${job.demand === 'very high' ? '🔥 This role is in very high demand' : job.demand === 'high' ? '📈 Good demand for this role' : '📊 Moderate demand'}`,
        'Salaries vary by experience, company, and city',
        'Check your visa working conditions before applying',
        'LinkedIn and SEEK are the top job platforms in Australia'
      ],
      source: 'built-in salary guide (2025-2026 estimates)'
    };
  }

  // No match — suggest web search
  return {
    query,
    location,
    type: 'search_suggestion',
    message: `No built-in salary data for "${query}". Try searching on job platforms:`,
    search_links: {
      seek: `https://www.seek.com.au/${encodeURIComponent(query)}-jobs/in-${location}`,
      indeed: `https://au.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`,
      linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(location + ', Australia')}`
    },
    minimum_wage: `National minimum: $${MIN_WAGE.national.hourly}/hr ($${MIN_WAGE.national.annual}/yr)`,
    available_roles: Object.keys(SALARY_GUIDE).slice(0, 20).join(', ')
  };
}

function estimateAfterTax(gross) {
  // Simplified after-tax estimate
  let tax = 0;
  if (gross > 190000) tax = 51638 + (gross - 190000) * 0.45;
  else if (gross > 135000) tax = 31288 + (gross - 135000) * 0.37;
  else if (gross > 45000) tax = 4288 + (gross - 45000) * 0.30;
  else if (gross > 18200) tax = (gross - 18200) * 0.16;
  tax += gross * 0.02; // Medicare
  return Math.round((gross - tax) / 12);
}

async function adzunaSearch(appId, apiKey, query, location) {
  const url = `https://api.adzuna.com/v1/api/jobs/au/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=5&what=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}&content-type=application/json`;
  
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'AustralianAssistant/1.0' }
  });
  
  if (!resp.ok) throw new Error(`Adzuna API error: ${resp.status}`);
  const data = await resp.json();
  
  return {
    query, location, type: 'live_search', source: 'Adzuna API',
    total: data.count || 0,
    jobs: (data.results || []).map(j => ({
      title: j.title?.replace(/<[^>]*>/g, '') || '',
      company: j.company?.display_name || '',
      location: j.location?.display_name || '',
      salary: j.salary_is_predicted ? `~$${Math.round(j.salary_min)}` : (j.salary_min ? `$${Math.round(j.salary_min)}-$${Math.round(j.salary_max)}` : 'Not specified'),
      url: j.redirect_url || '',
      posted: j.created?.split('T')[0] || ''
    }))
  };
}
