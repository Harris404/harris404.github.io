/**
 * ACARA School Data Converter
 * Downloads School Profile + Location XLSX → JSON for RAG
 * Run: node scripts/convert-acara.mjs
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { read, utils } from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data', 'acara');
const RAG_DIR = join(ROOT, 'rag-data', 'schools');

async function convert() {
  console.log('📖 Reading School Profile 2025...');
  const profileBuf = await readFile(join(DATA_DIR, 'School_Profile_2025.xlsx'));
  const profileWB = read(profileBuf, { type: 'buffer' });
  const profileSheet = profileWB.Sheets[profileWB.SheetNames[0]];
  const profileRows = utils.sheet_to_json(profileSheet);

  console.log(`  → ${profileRows.length} schools in profile`);

  console.log('📖 Reading School Location 2025...');
  const locationBuf = await readFile(join(DATA_DIR, 'School_Location_2025.xlsx'));
  const locationWB = read(locationBuf, { type: 'buffer' });
  const locationSheet = locationWB.Sheets[locationWB.SheetNames[0]];
  const locationRows = utils.sheet_to_json(locationSheet);

  console.log(`  → ${locationRows.length} schools in location`);

  // Build a location lookup by ACARA SML ID
  const locationMap = {};
  for (const row of locationRows) {
    const id = row['ACARA SML ID'] || row['School ID'] || row['ACARA_SML_ID'];
    if (id) {
      locationMap[id] = {
        latitude: row['Latitude'] || row['latitude'] || row['Lat'],
        longitude: row['Longitude'] || row['longitude'] || row['Long'],
        lga: row['LGA Name'] || row['LGA_Name'] || row['LGA'],
      };
    }
  }

  // Merge profile + location
  const schools = profileRows.map(row => {
    // Normalize column names (ACARA uses various naming conventions)
    const id = row['ACARA SML ID'] || row['School ID'] || row['ACARA_SML_ID'] || '';
    const loc = locationMap[id] || {};

    return {
      id: String(id),
      name: row['School Name'] || row['School_Name'] || '',
      suburb: row['Suburb'] || row['Town'] || '',
      state: row['State'] || row['State/Territory'] || '',
      postcode: String(row['Postcode'] || row['Post Code'] || ''),
      sector: row['School Sector'] || row['Sector'] || '', // Government, Catholic, Independent
      type: row['School Type'] || row['Type'] || '', // Primary, Secondary, Combined, Special
      icsea: Number(row['ICSEA Value'] || row['ICSEA'] || 0),
      total_enrolments: Number(row['Total Enrolments'] || row['Total_Enrolments'] || 0),
      indigenous_pct: Number(row['Indigenous %'] || row['Indigenous_Pct'] || 0),
      lbote_pct: Number(row['LBOTE %'] || row['LBOTE_Pct'] || 0),  // Language Background Other Than English
      latitude: loc.latitude || null,
      longitude: loc.longitude || null,
      lga: loc.lga || '',
    };
  }).filter(s => s.name && s.state); // Remove empty rows

  console.log(`\n✅ Merged ${schools.length} schools with location data`);

  // Stats
  const states = {};
  const sectors = {};
  const types = {};
  for (const s of schools) {
    states[s.state] = (states[s.state] || 0) + 1;
    sectors[s.sector] = (sectors[s.sector] || 0) + 1;
    types[s.type] = (types[s.type] || 0) + 1;
  }
  console.log('\n📊 By State:', states);
  console.log('📊 By Sector:', sectors);
  console.log('📊 By Type:', types);

  // Create RAG output directory
  await mkdir(RAG_DIR, { recursive: true });

  // Output 1: Full JSON (for direct lookup)
  const fullPath = join(RAG_DIR, 'all-schools.json');
  await writeFile(fullPath, JSON.stringify(schools, null, 0)); // compact
  const fullSize = (await readFile(fullPath)).length;
  console.log(`\n💾 Full data: ${fullPath} (${(fullSize / 1024 / 1024).toFixed(1)} MB)`);

  // Output 2: State-level JSON files (smaller, for filtered RAG)
  for (const state of Object.keys(states)) {
    const stateSchools = schools.filter(s => s.state === state);
    const statePath = join(RAG_DIR, `schools-${state.toLowerCase()}.json`);
    await writeFile(statePath, JSON.stringify(stateSchools, null, 0));
    console.log(`  → ${statePath} (${stateSchools.length} schools)`);
  }

  // Output 3: Top ICSEA schools by state (for quick reference / RAG highlights)
  const topSchools = {};
  for (const state of Object.keys(states)) {
    topSchools[state] = schools
      .filter(s => s.state === state && s.icsea > 0)
      .sort((a, b) => b.icsea - a.icsea)
      .slice(0, 50)
      .map(s => ({
        name: s.name,
        suburb: s.suburb,
        postcode: s.postcode,
        sector: s.sector,
        type: s.type,
        icsea: s.icsea,
        enrolments: s.total_enrolments,
      }));
  }
  const topPath = join(RAG_DIR, 'top-schools-by-state.json');
  await writeFile(topPath, JSON.stringify(topSchools, null, 2));
  console.log(`\n⭐ Top 50 per state: ${topPath}`);

  // Output 4: RAG-friendly markdown summaries per state
  for (const state of ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']) {
    const stateSchools = schools.filter(s => s.state === state && s.icsea > 0);
    if (stateSchools.length === 0) continue;

    const top20 = stateSchools.sort((a, b) => b.icsea - a.icsea).slice(0, 20);
    const mdLines = [
      `# ${state} Top Schools by ICSEA (2025)`,
      '',
      '| Rank | School | Suburb | Sector | Type | ICSEA | Students |',
      '|------|--------|--------|--------|------|-------|----------|',
    ];

    top20.forEach((s, i) => {
      mdLines.push(`| ${i + 1} | ${s.name} | ${s.suburb} | ${s.sector} | ${s.type} | ${s.icsea} | ${s.total_enrolments} |`);
    });

    mdLines.push('');
    mdLines.push(`Total schools in ${state}: ${stateSchools.length}`);
    mdLines.push(`Average ICSEA: ${Math.round(stateSchools.reduce((s, x) => s + x.icsea, 0) / stateSchools.length)}`);
    mdLines.push('');
    mdLines.push('Source: ACARA MySchool.edu.au (2025). ICSEA = Index of Community Socio-Educational Advantage.');
    mdLines.push('ICSEA 1000 = national average. Higher = more advantaged community.');

    const mdPath = join(RAG_DIR, `top-schools-${state.toLowerCase()}.md`);
    await writeFile(mdPath, mdLines.join('\n'));
    console.log(`  📝 ${mdPath}`);
  }

  console.log('\n✅ Done! School data ready for RAG.');
  console.log('\n📌 Update frequency: ACARA updates annually (Feb-Mar). Re-run this script once a year.');
}

convert().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
