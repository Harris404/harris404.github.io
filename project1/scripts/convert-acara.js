/**
 * ACARA School Data Converter
 * Converts School Profile + Location XLSX → JSON for RAG
 * Run: node scripts/convert-acara.mjs
 * Update: Once per year (ACARA updates Feb-Mar)
 */

const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'acara');
const RAG_DIR = path.join(ROOT, 'rag-data', 'schools');

function convert() {
  console.log('📖 Reading School Profile 2025...');
  const profileBuf = fs.readFileSync(path.join(DATA_DIR, 'School_Profile_2025.xlsx'));
  const profileWB = XLSX.read(profileBuf, { type: 'buffer' });
  // Data is in the second sheet
  const profileSheet = profileWB.Sheets[profileWB.SheetNames[1]] || profileWB.Sheets[profileWB.SheetNames[0]];
  const profileRows = XLSX.utils.sheet_to_json(profileSheet);
  console.log(`  → ${profileRows.length} schools in profile`);

  console.log('📖 Reading School Location 2025...');
  const locationBuf = fs.readFileSync(path.join(DATA_DIR, 'School_Location_2025.xlsx'));
  const locationWB = XLSX.read(locationBuf, { type: 'buffer' });
  const locationSheet = locationWB.Sheets[locationWB.SheetNames[1]] || locationWB.Sheets[locationWB.SheetNames[0]];
  const locationRows = XLSX.utils.sheet_to_json(locationSheet);
  console.log(`  → ${locationRows.length} schools in location`);

  // Build location lookup by ACARA SML ID
  const locationMap = {};
  for (const row of locationRows) {
    const id = row['ACARA SML ID'];
    if (id) {
      // Geolocation might be in separate lat/lng columns or combined
      locationMap[id] = {
        latitude: row['Latitude'] || row['Lat'] || null,
        longitude: row['Longitude'] || row['Long'] || null,
        lga: row['LGA Name'] || row['LGA'] || '',
      };
    }
  }

  // Merge profile + location
  const schools = profileRows.map(row => {
    const id = String(row['ACARA SML ID'] || '');
    const loc = locationMap[id] || {};

    // Parse geolocation from profile if available (format: "lat, lng" or separate)
    let lat = loc.latitude;
    let lng = loc.longitude;
    if (!lat && row['Geolocation']) {
      const geo = String(row['Geolocation']).split(',').map(s => parseFloat(s.trim()));
      if (geo.length === 2 && !isNaN(geo[0])) {
        lat = geo[0];
        lng = geo[1];
      }
    }

    return {
      id,
      name: row['School Name'] || '',
      suburb: row['Suburb'] || '',
      state: row['State'] || '',
      postcode: String(row['Postcode'] || ''),
      sector: row['School Sector'] || '',
      type: row['School Type'] || '',
      year_range: row['Year Range'] || '',
      url: row['School URL'] || '',
      icsea: Number(row['ICSEA']) || 0,
      icsea_percentile: Number(row['ICSEA Percentile']) || 0,
      total_enrolments: Number(row['Total Enrolments']) || 0,
      girls: Number(row['Girls Enrolments']) || 0,
      boys: Number(row['Boys Enrolments']) || 0,
      teaching_staff: Number(row['Teaching Staff']) || 0,
      indigenous_pct: Number(row['Indigenous Enrolments (%)']) || 0,
      lbote_pct: Number(row['Language Background Other Than English - Yes (%)']) || 0,
      latitude: lat,
      longitude: lng,
      lga: loc.lga || '',
    };
  }).filter(s => s.name && s.state);

  console.log(`\n✅ Merged ${schools.length} schools`);

  // Stats
  const states = {};
  const sectors = {};
  for (const s of schools) {
    states[s.state] = (states[s.state] || 0) + 1;
    sectors[s.sector] = (sectors[s.sector] || 0) + 1;
  }
  console.log('📊 By State:', states);
  console.log('📊 By Sector:', sectors);

  // Create output dir
  fs.mkdirSync(RAG_DIR, { recursive: true });

  // Output 1: Full compact JSON
  const fullPath = path.join(RAG_DIR, 'all-schools.json');
  fs.writeFileSync(fullPath, JSON.stringify(schools));
  const fullSize = fs.statSync(fullPath).size;
  console.log(`\n💾 Full: ${fullPath} (${(fullSize / 1024 / 1024).toFixed(1)} MB)`);

  // Output 2: Per-state JSON
  for (const state of Object.keys(states)) {
    const stateSchools = schools.filter(s => s.state === state);
    const p = path.join(RAG_DIR, `schools-${state.toLowerCase()}.json`);
    fs.writeFileSync(p, JSON.stringify(stateSchools));
    console.log(`  → ${state}: ${stateSchools.length} schools`);
  }

  // Output 3: Top schools JSON
  const topSchools = {};
  for (const state of Object.keys(states)) {
    topSchools[state] = schools
      .filter(s => s.state === state && s.icsea > 0)
      .sort((a, b) => b.icsea - a.icsea)
      .slice(0, 50)
      .map(s => ({
        name: s.name, suburb: s.suburb, postcode: s.postcode,
        sector: s.sector, type: s.type, icsea: s.icsea,
        year_range: s.year_range, enrolments: s.total_enrolments,
      }));
  }
  fs.writeFileSync(path.join(RAG_DIR, 'top-schools-by-state.json'), JSON.stringify(topSchools, null, 2));

  // Output 4: RAG markdown per state
  for (const state of ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']) {
    const stateSchools = schools.filter(s => s.state === state && s.icsea > 0);
    if (stateSchools.length === 0) continue;

    const top30 = [...stateSchools].sort((a, b) => b.icsea - a.icsea).slice(0, 30);
    const avgIcsea = Math.round(stateSchools.reduce((s, x) => s + x.icsea, 0) / stateSchools.length);

    const lines = [
      `# ${state} 学校排名 (ICSEA 2025)`,
      '',
      `共 ${stateSchools.length} 所学校 | 平均 ICSEA: ${avgIcsea} | 全国平均: 1000`,
      '',
      '## Top 30 学校 (按ICSEA排名)',
      '',
      '| # | 学校 | 区域 | 邮编 | 类型 | 性质 | ICSEA | 年级 | 学生数 |',
      '|---|------|------|------|------|------|-------|------|--------|',
    ];

    top30.forEach((s, i) => {
      lines.push(`| ${i + 1} | ${s.name} | ${s.suburb} | ${s.postcode} | ${s.type} | ${s.sector} | ${s.icsea} | ${s.year_range} | ${s.total_enrolments} |`);
    });

    lines.push('');
    lines.push('## 数据说明');
    lines.push('- **ICSEA**: Index of Community Socio-Educational Advantage (社区教育优势指数)');
    lines.push('- ICSEA 1000 = 全国平均线，越高社区教育背景越好');
    lines.push('- **Sector**: Government(公立) / Catholic(天主教) / Independent(私立)');
    lines.push('- **LBOTE**: Language Background Other Than English (非英语背景)');
    lines.push('- 数据来源: ACARA MySchool.edu.au (2025年)');
    lines.push('- 更新频率: 每年一次 (2-3月)');

    const mdPath = path.join(RAG_DIR, `top-schools-${state.toLowerCase()}.md`);
    fs.writeFileSync(mdPath, lines.join('\n'));
    console.log(`  📝 ${state} markdown → ${mdPath}`);
  }

  console.log('\n✅ 完成！学校数据已准备好用于 RAG。');
  console.log('📌 更新频率: ACARA 每年更新一次 (2-3月)，每年运行一次此脚本即可。');
}

convert();
