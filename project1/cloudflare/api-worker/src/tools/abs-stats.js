/**
 * ABS Statistics API — Australian Bureau of Statistics
 * Free SDMX RESTful API for CPI, unemployment, population, wages
 * 
 * Base URL: https://api.data.abs.gov.au
 * No API key needed.
 */

const ABS_BASE = 'https://api.data.abs.gov.au';

// Key data flows
const DATAFLOWS = {
  cpi: { id: 'CPI', name: 'Consumer Price Index (CPI)', desc: '通胀率/物价指数' },
  lf: { id: 'LF', name: 'Labour Force', desc: '失业率/就业数据' },
  wpi: { id: 'WPI', name: 'Wage Price Index', desc: '工资增长指数' },
  pop: { id: 'ERP_Q', name: 'Estimated Resident Population', desc: '各州人口估计' },
  build: { id: 'ABS_BA_SA2', name: 'Building Approvals', desc: '建筑审批数据' },
};

export async function getABSStats(args, env) {
  const topic = (args.topic || args.query || 'cpi').toLowerCase();
  const mode = args.mode || 'latest';

  // Map common queries to data flows
  let dataflow = null;
  if (/cpi|inflation|通胀|物价|consumer price/i.test(topic)) {
    dataflow = DATAFLOWS.cpi;
  } else if (/unemploy|employment|labour|labor|失业|就业|工作/i.test(topic)) {
    dataflow = DATAFLOWS.lf;
  } else if (/wage|salary|工资|薪资/i.test(topic)) {
    dataflow = DATAFLOWS.wpi;
  } else if (/population|人口/i.test(topic)) {
    dataflow = DATAFLOWS.pop;
  } else if (/building|construction|建筑|房屋审批/i.test(topic)) {
    dataflow = DATAFLOWS.build;
  }

  if (!dataflow) {
    return {
      error: `不支持查询: "${topic}"`,
      available_topics: Object.entries(DATAFLOWS).map(([k, v]) => ({
        key: k, name: v.name, description: v.desc,
      })),
      examples: [
        '{ "topic": "cpi" } → 最新 CPI 通胀率',
        '{ "topic": "unemployment" } → 最新失业率',
        '{ "topic": "wage" } → 工资增长指数',
        '{ "topic": "population" } → 各州人口',
      ],
      source: 'Australian Bureau of Statistics (ABS)',
    };
  }

  try {
    return await fetchABSData(dataflow, mode);
  } catch (err) {
    return {
      topic: dataflow.name,
      error: `ABS API 请求失败: ${err.message}`,
      fallback_url: `https://www.abs.gov.au/statistics`,
      tip: '可以直接访问 ABS 官网查看最新统计数据。',
    };
  }
}

async function fetchABSData(dataflow, mode) {
  // Fetch the latest observation for the dataflow
  // Using SDMX-JSON format for easier parsing
  const url = `${ABS_BASE}/data/${dataflow.id}?format=jsondata&detail=dataonly&lastNObservations=4`;
  
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  
  if (!res.ok) {
    // Try simpler endpoint
    return await fetchABSSimple(dataflow);
  }
  
  const data = await res.json();
  
  // Parse SDMX-JSON structure
  const dataSets = data?.dataSets || [];
  const structure = data?.structure || {};
  const dimensions = structure?.dimensions?.observation || [];
  const series = dataSets[0]?.series || {};
  
  // Extract key series
  const results = [];
  const seriesKeys = Object.keys(series);
  
  // Limit to most relevant series (avoid overwhelming output)
  const relevantKeys = seriesKeys.slice(0, 10);
  
  for (const key of relevantKeys) {
    const s = series[key];
    const observations = s.observations || {};
    const attrs = s.attributes || [];
    
    // Get dimension labels
    const keyParts = key.split(':');
    const labels = [];
    for (let i = 0; i < keyParts.length && i < dimensions.length; i++) {
      const dim = dimensions[i];
      const val = dim?.values?.[parseInt(keyParts[i])];
      if (val?.name) labels.push(val.name);
    }
    
    // Get latest observations
    const obsKeys = Object.keys(observations).sort((a, b) => Number(b) - Number(a));
    const latestObs = obsKeys.slice(0, 4).map(k => ({
      period: k,
      value: observations[k]?.[0],
    }));
    
    if (latestObs.length > 0 && latestObs[0].value !== null) {
      results.push({
        series: labels.join(' | ') || key,
        latest: latestObs[0],
        history: latestObs,
      });
    }
  }

  return {
    topic: dataflow.name,
    description: dataflow.desc,
    results_count: results.length,
    data: results.slice(0, 8),
    source: 'Australian Bureau of Statistics (ABS)',
    url: `https://www.abs.gov.au/statistics`,
    note: 'ABS 数据通常有 1-3 个月的延迟（统计需要时间收集和处理）。',
  };
}

async function fetchABSSimple(dataflow) {
  // Fallback: use the indicator API for simple headline stats
  const indicators = {
    CPI: {
      latest_url: 'https://api.data.abs.gov.au/data/ABS,CPI,1.0.0/1.10001.10.Q?format=jsondata&lastNObservations=4',
      description: 'All Groups CPI, All Australia',
    },
    LF: {
      latest_url: 'https://api.data.abs.gov.au/data/ABS,LF,1.0.0/1.M4.3.1599.20.M?format=jsondata&lastNObservations=4',
      description: 'Unemployment Rate, Australia',
    },
  };
  
  const indicator = indicators[dataflow.id];
  if (indicator) {
    try {
      const res = await fetch(indicator.latest_url, {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        // Try to extract data
        const series = data?.dataSets?.[0]?.series || {};
        const firstSeries = Object.values(series)[0];
        if (firstSeries) {
          const obs = firstSeries.observations || {};
          const latest = Object.entries(obs).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => ({
            period: k, value: v?.[0],
          }));
          return {
            topic: dataflow.name,
            description: indicator.description,
            latest: latest[0],
            recent_history: latest.slice(0, 4),
            source: 'ABS',
          };
        }
      }
    } catch {}
  }
  
  // Ultimate fallback with well-known stat URLs
  return {
    topic: dataflow.name,
    description: dataflow.desc,
    message: 'ABS API 当前无法获取实时数据，请参考以下链接：',
    urls: {
      cpi: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',
      unemployment: 'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release',
      wages: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release',
    },
    source: 'Australian Bureau of Statistics (ABS)',
  };
}
