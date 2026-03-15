/**
 * NSW Rental Bond Data Converter
 * Converts Fair Trading bond lodgement data → median rents by postcode JSON
 * Run: node scripts/convert-rental.js
 * Update: Monthly (download new XLSX from fairtrading.nsw.gov.au)
 */

const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'rental');
const RAG_DIR = path.join(ROOT, 'rag-data', 'rental');

function convert() {
  fs.mkdirSync(RAG_DIR, { recursive: true });

  // ─── NSW Bond Lodgements ──────────────────────────────────────

  console.log('📖 Reading NSW Bond Lodgements...');
  const lodgeBuf = fs.readFileSync(path.join(DATA_DIR, 'nsw_lodgements_2026_jan.xlsx'));
  const lodgeWB = XLSX.read(lodgeBuf, { type: 'buffer' });
  const lodgeRows = XLSX.utils.sheet_to_json(lodgeWB.Sheets[lodgeWB.SheetNames[0]], { range: 2 });
  console.log(`  → ${lodgeRows.length} bond lodgements`);

  // Dwelling type codes: F=Flat, H=House, T=Townhouse, O=Other
  const typeNames = { F: 'Flat/Apartment', H: 'House', T: 'Townhouse', O: 'Other' };

  // Aggregate: median rent by postcode + dwelling type + bedrooms
  const postcodeData = {};

  for (const row of lodgeRows) {
    const pc = String(row['Postcode'] || '');
    const type = row['Dwelling Type'] || '';
    const beds = String(row['Bedrooms'] || '0');
    const rent = Number(row['Weekly Rent']);

    if (!pc || !rent || rent <= 0) continue;

    if (!postcodeData[pc]) postcodeData[pc] = {};
    const key = `${type}_${beds}`;
    if (!postcodeData[pc][key]) postcodeData[pc][key] = [];
    postcodeData[pc][key].push(rent);
  }

  // Calculate medians
  const medianRents = {};
  for (const [pc, types] of Object.entries(postcodeData)) {
    medianRents[pc] = {};
    const allRents = [];

    for (const [key, rents] of Object.entries(types)) {
      const [type, beds] = key.split('_');
      rents.sort((a, b) => a - b);
      const median = rents[Math.floor(rents.length / 2)];
      const typeName = typeNames[type] || type;

      if (!medianRents[pc][typeName]) medianRents[pc][typeName] = {};
      medianRents[pc][typeName][`${beds}br`] = {
        median,
        min: rents[0],
        max: rents[rents.length - 1],
        count: rents.length,
      };
      allRents.push(...rents);
    }

    allRents.sort((a, b) => a - b);
    medianRents[pc]._overall = {
      median: allRents[Math.floor(allRents.length / 2)],
      count: allRents.length,
    };
  }

  // ─── NSW Bonds Held ──────────────────────────────────────

  console.log('📖 Reading NSW Bonds Held...');
  const heldBuf = fs.readFileSync(path.join(DATA_DIR, 'nsw_bonds_held_2025.xlsx'));
  const heldWB = XLSX.read(heldBuf, { type: 'buffer' });
  const heldRows = XLSX.utils.sheet_to_json(heldWB.Sheets[heldWB.SheetNames[0]], { range: 2 });
  console.log(`  → ${heldRows.length} postcodes with bond data`);

  const bondsHeld = {};
  for (const row of heldRows) {
    const pc = String(row['Postcode'] || '');
    const bonds = Number(row['Bonds Held'] || 0);
    if (pc && bonds) bondsHeld[pc] = bonds;
  }

  // ─── Combine Results ──────────────────────────────────────

  const combined = {};
  const allPostcodes = new Set([...Object.keys(medianRents), ...Object.keys(bondsHeld)]);

  for (const pc of allPostcodes) {
    combined[pc] = {
      postcode: pc,
      state: 'NSW',
      rents: medianRents[pc] || {},
      bonds_held: bondsHeld[pc] || 0,
    };
  }

  // Save JSON
  const jsonPath = path.join(RAG_DIR, 'nsw-rental-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(combined));
  console.log(`\n💾 NSW rental data: ${jsonPath} (${Object.keys(combined).length} postcodes)`);

  // ─── Create RAG Markdown ──────────────────────────────────

  // Top 30 most expensive postcodes
  const expensiveList = Object.values(combined)
    .filter(d => d.rents._overall)
    .sort((a, b) => b.rents._overall.median - a.rents._overall.median)
    .slice(0, 30);

  const lines = [
    '# NSW 租金数据 (2026年1月)',
    '',
    '数据来源: NSW Fair Trading Bond Lodgements',
    '',
    '## Top 30 最贵邮编 (中位周租金)',
    '',
    '| # | 邮编 | 中位周租金 | 新增Bond数 | 总Bond持有 |',
    '|---|------|-----------|-----------|-----------|',
  ];

  expensiveList.forEach((d, i) => {
    lines.push(`| ${i + 1} | ${d.postcode} | $${d.rents._overall.median} | ${d.rents._overall.count} | ${d.bonds_held} |`);
  });

  // Popular suburbs for Chinese (Chatswood, Hurstville, Burwood, Eastwood, etc.)
  const chineseSuburbs = ['2067', '2220', '2134', '2122', '2121', '2060', '2113', '2065', '2031', '2032', '2017', '2205', '2036'];
  lines.push('');
  lines.push('## 华人热门区域租金');
  lines.push('');
  lines.push('| 邮编 | 区域(参考) | 中位周租金 | Bond数 |');
  lines.push('|------|-----------|-----------|--------|');

  const suburbNames = {
    '2067': 'Chatswood', '2220': 'Hurstville', '2134': 'Burwood',
    '2122': 'Eastwood/Marsfield', '2121': 'Epping', '2060': 'North Sydney/McMahons Pt',
    '2113': 'Macquarie Park/North Ryde', '2065': 'Crows Nest/St Leonards',
    '2031': 'Randwick/Coogee', '2032': 'Kingsford', '2017': 'Zetland/Waterloo',
    '2205': 'Arncliffe/Wolli Creek', '2036': 'Matraville/La Perouse',
  };

  for (const pc of chineseSuburbs) {
    const d = combined[pc];
    if (d && d.rents._overall) {
      lines.push(`| ${pc} | ${suburbNames[pc] || '?'} | $${d.rents._overall.median} | ${d.rents._overall.count} |`);
    }
  }

  // Common rent ranges by bedroom
  lines.push('');
  lines.push('## 按卧室数查询提示');
  lines.push('- 用户问"Chatswood两房租金" → 查 postcode 2067, Flat/Apartment, 2br');
  lines.push('- F=Flat/Apartment, H=House, T=Townhouse');
  lines.push('- 0br=Studio, 1br=一房, 2br=两房, 3br=三房');
  lines.push('');
  lines.push('数据更新: 每月 (NSW Fair Trading)');
  lines.push('来源: fairtrading.nsw.gov.au/about-fair-trading/rental-bond-data');

  const mdPath = path.join(RAG_DIR, 'nsw-rental-summary.md');
  fs.writeFileSync(mdPath, lines.join('\n'));
  console.log(`📝 RAG summary: ${mdPath}`);

  console.log('\n✅ NSW 完成！');
  console.log(`📊 ${Object.keys(medianRents).length} postcodes with rent data`);
  console.log(`📊 ${Object.keys(bondsHeld).length} postcodes with bonds held`);

  // ─── QLD RTA Bond Statistics ──────────────────────────────────

  const qldFile = path.join(DATA_DIR, 'qld_bond_statistics.xlsx');
  if (!fs.existsSync(qldFile)) {
    console.log('\n⚠️ QLD data file not found, skipping...');
    return;
  }

  console.log('\n📖 Reading QLD RTA Bond Statistics...');
  const qldBuf = fs.readFileSync(qldFile);
  const qldWB = XLSX.read(qldBuf, { type: 'buffer' });

  // Sheet "1 pc-rents" = median rents by postcode
  const pcSheet = qldWB.Sheets['1 pc-rents'];
  const qldRange = XLSX.utils.decode_range(pcSheet['!ref']);
  const lastCol = qldRange.e.c; // Last column = latest quarter (Dec 2025)
  const prevCol = lastCol - 1;  // Previous quarter (Sep 2025)

  // Data starts at row 6 (0-indexed), postcode col=2, dwelling col=3
  const qldData = {};
  let qldCount = 0;

  for (let r = 6; r <= qldRange.e.r; r++) {
    const pcCell = pcSheet[XLSX.utils.encode_cell({r, c: 2})];
    const dwCell = pcSheet[XLSX.utils.encode_cell({r, c: 3})];
    const latestCell = pcSheet[XLSX.utils.encode_cell({r, c: lastCol})];
    const prevCell = pcSheet[XLSX.utils.encode_cell({r, c: prevCol})];

    if (!pcCell) continue;
    const pc = String(pcCell.v);
    const dwRaw = dwCell ? String(dwCell.v) : '';

    // Parse dwelling type and bedrooms from "Flat 2", "House 3", etc.
    const parts = dwRaw.split(/\s+/);
    const dwType = parts[0] || '';
    const beds = parts[1] || '0';

    const latestRent = latestCell ? Number(latestCell.v) : null;
    const prevRent = prevCell ? Number(prevCell.v) : null;

    if (!latestRent && !prevRent) continue;

    if (!qldData[pc]) qldData[pc] = { postcode: pc, state: 'QLD', rents: {} };

    const typeName = dwType === 'Flat' ? 'Flat/Apartment' : dwType;
    if (!qldData[pc].rents[typeName]) qldData[pc].rents[typeName] = {};
    qldData[pc].rents[typeName][`${beds}br`] = {
      median: latestRent || prevRent,
      previous_quarter: prevRent,
    };
    qldCount++;
  }

  // Calculate overall median per postcode
  for (const pc of Object.keys(qldData)) {
    const allRents = [];
    for (const type of Object.values(qldData[pc].rents)) {
      for (const bed of Object.values(type)) {
        if (bed.median) allRents.push(bed.median);
      }
    }
    if (allRents.length > 0) {
      allRents.sort((a, b) => a - b);
      qldData[pc].rents._overall = {
        median: allRents[Math.floor(allRents.length / 2)],
        count: allRents.length,
      };
    }
  }

  // Save QLD JSON
  const qldJsonPath = path.join(RAG_DIR, 'qld-rental-data.json');
  fs.writeFileSync(qldJsonPath, JSON.stringify(qldData));
  console.log(`💾 QLD rental data: ${qldJsonPath} (${Object.keys(qldData).length} postcodes, ${qldCount} records)`);

  // QLD RAG Markdown
  const qldExpensive = Object.values(qldData)
    .filter(d => d.rents._overall)
    .sort((a, b) => b.rents._overall.median - a.rents._overall.median)
    .slice(0, 30);

  const qldLines = [
    '# QLD 租金数据 (Dec 2025 Quarter)',
    '',
    '数据来源: QLD Residential Tenancies Authority (RTA) Bond Statistics',
    '',
    '## Top 30 最贵邮编 (中位周租金)',
    '',
    '| # | 邮编 | 中位周租金 | 数据条数 |',
    '|---|------|-----------|---------|',
  ];

  qldExpensive.forEach((d, i) => {
    qldLines.push(`| ${i + 1} | ${d.postcode} | $${d.rents._overall.median} | ${d.rents._overall.count} |`);
  });

  // Brisbane Chinese suburbs
  const brisChineseSuburbs = {
    '4109': 'Sunnybank/Sunnybank Hills',
    '4116': 'Calamvale/Stretton',
    '4151': 'Coorparoo',
    '4000': 'Brisbane CBD',
    '4066': 'Toowong/Auchenflower',
    '4102': 'Woolloongabba/Dutton Park',
    '4101': 'South Brisbane/West End',
    '4170': 'Cannon Hill/Morningside',
    '4211': 'Mudgeeraba/Robina',
    '4217': 'Surfers Paradise',
    '4215': 'Southport',
  };

  qldLines.push('');
  qldLines.push('## 华人热门区域租金');
  qldLines.push('');
  qldLines.push('| 邮编 | 区域 | 中位周租金 |');
  qldLines.push('|------|------|-----------|');

  for (const [pc, name] of Object.entries(brisChineseSuburbs)) {
    const d = qldData[pc];
    if (d && d.rents._overall) {
      qldLines.push(`| ${pc} | ${name} | $${d.rents._overall.median} |`);
    }
  }

  qldLines.push('');
  qldLines.push('## 数据说明');
  qldLines.push('- 数据来源: QLD RTA (rta.qld.gov.au)');
  qldLines.push('- 更新频率: 每季度');
  qldLines.push('- 单元格"np"表示该季度无足够数据计算中位数');
  qldLines.push('- Dwelling类型: Flat(公寓), House(独立屋), Townhouse(联排)');

  const qldMdPath = path.join(RAG_DIR, 'qld-rental-summary.md');
  fs.writeFileSync(qldMdPath, qldLines.join('\n'));
  console.log(`📝 QLD RAG summary: ${qldMdPath}`);

  console.log('\n✅ 全部完成！');
  console.log('📌 NSW更新: 每月 | QLD更新: 每季度');
}

convert();

