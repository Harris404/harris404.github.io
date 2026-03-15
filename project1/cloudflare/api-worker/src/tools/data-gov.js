/**
 * data.gov.au CKAN API — Australian Government Open Data search
 * Free, no API key required
 * 
 * Exposes data.gov.au dataset search capability —
 * lets users find any Australian government dataset
 */

const CKAN_BASE = 'https://data.gov.au/data/api/3';

export async function searchDataGov(args, env) {
  const query = args.query || args.topic || '';
  const org = args.organization || args.agency || '';
  const format = args.format || '';
  const rows = Math.min(args.limit || 5, 10);

  if (!query && !org) {
    return {
      error: '请提供搜索关键词',
      examples: [
        '{ "query": "rental prices" }',
        '{ "query": "school statistics" }',
        '{ "query": "immigration", "organization": "home-affairs" }',
        '{ "query": "fuel prices NSW" }',
        '{ "query": "housing affordability" }',
      ],
      tip: 'data.gov.au 包含 30,000+ 政府公开数据集。',
      source: 'data.gov.au',
    };
  }

  try {
    // Build search URL
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('rows', rows);
    if (org) params.set('fq', `organization:${org}`);

    const url = `${CKAN_BASE}/action/package_search?${params}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`CKAN API returned ${res.status}`);

    const data = await res.json();
    
    if (!data.success || !data.result) {
      return { 
        query, error: 'data.gov.au 返回了无效结果', 
        manual_search: `https://data.gov.au/search?q=${encodeURIComponent(query)}`,
      };
    }

    const total = data.result.count || 0;
    const datasets = (data.result.results || []).map(ds => {
      // Extract download resources
      const resources = (ds.resources || [])
        .filter(r => r.url)
        .slice(0, 3)
        .map(r => ({
          name: r.name || r.description || 'Download',
          format: r.format || 'Unknown',
          url: r.url,
          size: r.size ? formatSize(r.size) : undefined,
          last_modified: r.last_modified || '',
        }));

      return {
        title: ds.title || '',
        description: (ds.notes || '').substring(0, 200),
        organization: ds.organization?.title || '',
        url: `https://data.gov.au/dataset/${ds.name || ds.id}`,
        format: resources.map(r => r.format).filter((v, i, a) => a.indexOf(v) === i).join(', '),
        resources: resources,
        last_updated: ds.metadata_modified || '',
        license: ds.license_title || '',
      };
    });

    return {
      query,
      total_results: total,
      showing: datasets.length,
      datasets,
      source: 'data.gov.au (Australian Government Open Data)',
      search_url: `https://data.gov.au/search?q=${encodeURIComponent(query)}`,
      tip: '所有数据集都可以免费下载和使用，遵循 Creative Commons 或其他开放许可。',
    };
  } catch (err) {
    return {
      query,
      error: `data.gov.au 搜索失败: ${err.message}`,
      manual_search: `https://data.gov.au/search?q=${encodeURIComponent(query)}`,
    };
  }
}

function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = Number(bytes);
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}
