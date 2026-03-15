/**
 * ABN Lookup Tool — Australian Business Number verification
 * Uses the free ABR (Australian Business Register) API
 * 
 * ABR provides free ABN lookup via:
 * - Web service (XML): https://abr.business.gov.au/abrxmlsearch/
 * - No API key needed for basic lookups
 */

const ABR_SEARCH_URL = 'https://abr.business.gov.au/json/AbnDetails.aspx';
const ABR_NAME_URL = 'https://abr.business.gov.au/json/MatchingNames.aspx';

// ABR requires a GUID — this is the public demo GUID available from ABR website
const ABR_GUID = '3e283a0f-89c5-4f07-8e7a-71b924471f42';

export async function lookupABN(args, env) {
  const abn = String(args.abn || args.number || '').replace(/\s/g, '');
  const name = args.name || args.query || args.business || '';
  const mode = args.mode || (abn ? 'abn' : 'name');

  if (!abn && !name) {
    return {
      error: '请提供 ABN 号码或公司名称',
      examples: [
        '{ "abn": "51824753556" }',
        '{ "name": "Woolworths" }',
        '{ "mode": "validate", "abn": "51824753556" }',
      ],
      tip: 'ABN 是 11 位数字，ACN 是 9 位数字。所有在澳注册的公司都有 ABN。',
    };
  }

  try {
    if (mode === 'abn' || mode === 'validate') {
      return await searchByABN(abn);
    } else {
      return await searchByName(name);
    }
  } catch (err) {
    return {
      error: `ABN 查询失败: ${err.message}`,
      fallback_url: abn
        ? `https://abr.business.gov.au/ABN/View?abn=${abn}`
        : `https://abr.business.gov.au/Search/Run?SearchText=${encodeURIComponent(name)}`,
    };
  }
}

async function searchByABN(abn) {
  // Validate ABN format (11 digits)
  const cleanABN = abn.replace(/\D/g, '');
  if (cleanABN.length !== 11 && cleanABN.length !== 9) {
    return {
      error: `ABN 应为 11 位数字，ACN 应为 9 位数字。收到: ${abn} (${cleanABN.length}位)`,
      tip: 'ABN 示例: 51 824 753 556',
    };
  }

  // ABN checksum validation (Modulus 89)
  if (cleanABN.length === 11 && !validateABNChecksum(cleanABN)) {
    return {
      abn: cleanABN,
      valid: false,
      message: `ABN ${formatABN(cleanABN)} 校验位不正确，这不是一个有效的 ABN。`,
      tip: '请检查是否有数字输入错误。',
    };
  }

  // Try ABR JSON API
  const url = `${ABR_SEARCH_URL}?abn=${cleanABN}&callback=callback&guid=${ABR_GUID}`;
  const res = await fetch(url);
  const text = await res.text();
  
  // Parse JSONP response: callback({...})
  const jsonStr = text.replace(/^callback\(/, '').replace(/\)$/, '');
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    // Fallback: return validation result
    return {
      abn: formatABN(cleanABN),
      valid: cleanABN.length === 11 ? validateABNChecksum(cleanABN) : true,
      message: 'ABR 服务暂时无法访问，请稍后重试。',
      manual_check: `https://abr.business.gov.au/ABN/View?abn=${cleanABN}`,
    };
  }

  if (!data || data.Message) {
    return {
      abn: formatABN(cleanABN),
      available: false,
      error: data?.Message || '未找到此 ABN',
      manual_check: `https://abr.business.gov.au/ABN/View?abn=${cleanABN}`,
    };
  }

  return {
    abn: formatABN(data.Abn || cleanABN),
    valid: true,
    status: data.AbnStatus || 'Unknown',
    active: (data.AbnStatus || '').toLowerCase() === 'active',
    entity_name: data.EntityName || '',
    entity_type: data.EntityTypeName || data.EntityTypeCode || '',
    business_names: (data.BusinessName || []).map(bn => ({
      name: bn.OrganisationName || bn.Name || '',
      effective_from: bn.EffectiveFrom || '',
    })),
    gst_registered: data.Gst ? {
      registered: true,
      effective_from: data.Gst,
    } : { registered: false },
    state: data.AddressState || '',
    postcode: data.AddressPostcode || '',
    abn_status_effective_from: data.AbnStatusEffectiveFrom || '',
    source: 'Australian Business Register (ABR)',
    url: `https://abr.business.gov.au/ABN/View?abn=${data.Abn || cleanABN}`,
    tip: data.AbnStatus?.toLowerCase() !== 'active'
      ? '⚠️ 此ABN不在活跃状态。与该公司交易前请谨慎确认。'
      : '✅ 此ABN有效且活跃。',
  };
}

async function searchByName(name) {
  const url = `${ABR_NAME_URL}?name=${encodeURIComponent(name)}&maxResults=8&callback=callback&guid=${ABR_GUID}`;
  const res = await fetch(url);
  const text = await res.text();
  
  const jsonStr = text.replace(/^callback\(/, '').replace(/\)$/, '');
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return {
      query: name,
      error: 'ABR 名称搜索服务暂时无法访问',
      manual_search: `https://abr.business.gov.au/Search/Run?SearchText=${encodeURIComponent(name)}`,
    };
  }

  if (!data || !data.Names || data.Names.length === 0) {
    return {
      query: name,
      results_count: 0,
      message: `未找到包含 "${name}" 的注册公司。`,
      manual_search: `https://abr.business.gov.au/Search/Run?SearchText=${encodeURIComponent(name)}`,
    };
  }

  const results = data.Names.map(n => ({
    name: n.Name || '',
    abn: formatABN(n.Abn || ''),
    state: n.State || '',
    postcode: n.Postcode || '',
    type: n.NameType || '',
    score: n.Score || 0,
    url: `https://abr.business.gov.au/ABN/View?abn=${n.Abn}`,
  }));

  return {
    query: name,
    results_count: results.length,
    results,
    source: 'Australian Business Register (ABR)',
    tip: '点击 URL 查看完整公司信息。GST 注册表示该公司需收取 10% GST。',
  };
}

function validateABNChecksum(abn) {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = abn.split('').map(Number);
  digits[0] -= 1; // Subtract 1 from first digit
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  return sum % 89 === 0;
}

function formatABN(abn) {
  const clean = String(abn).replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  return clean;
}
