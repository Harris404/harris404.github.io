#!/usr/bin/env node
/**
 * Parse VIC DFFH Quarterly Median Rents XLSX → structured JSON
 * VIC data: Region (col A) → LGA (col B) → latest quarter median
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, '..', 'data', 'rental', 'vic-median-rents.xlsx');
const OUTPUT = path.join(__dirname, '..', 'rag-data', 'rental', 'vic-rental-data.json');

const wb = XLSX.readFile(INPUT);

const SHEET_MAP = {
  '1br flat': { bedrooms: 1, dwelling: 'Flat' },
  '2br Flat': { bedrooms: 2, dwelling: 'Flat' },
  '3br Flat': { bedrooms: 3, dwelling: 'Flat' },
  '2br House': { bedrooms: 2, dwelling: 'House' },
  '3br House': { bedrooms: 3, dwelling: 'House' },
  '4br House': { bedrooms: 4, dwelling: 'House' },
};

const results = {};

for (const [sheetName, meta] of Object.entries(SHEET_MAP)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  
  // Latest quarter is in the last two data columns (count at col 212, median at col 213)
  const MEDIAN_COL = 213;
  const COUNT_COL = 212;
  
  let currentRegion = '';
  
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    
    const colA = row[0] ? String(row[0]).trim() : '';
    const colB = row[1] ? String(row[1]).trim() : '';
    
    // Update region from col A
    if (colA && !colA.includes('Total') && !colA.includes('METRO')) {
      currentRegion = colA;
    }
    
    // LGA data is in col B
    if (!colB || colB.includes('Total') || colB.includes('METRO')) continue;
    
    const median = row[MEDIAN_COL];
    const count = row[COUNT_COL];
    
    if (median === null || median === undefined || median === '-' || median === 'n.a.') continue;
    const medianNum = Number(median);
    if (isNaN(medianNum) || medianNum <= 0) continue;
    
    const lga = colB;
    if (!results[lga]) {
      results[lga] = { region: currentRegion, state: 'VIC' };
    }
    
    const key = `${meta.bedrooms}br_${meta.dwelling.toLowerCase()}`;
    results[lga][key] = {
      median_weekly: medianNum,
      count: count ? Number(count) : null,
    };
  }
  
  console.log(`📊 ${sheetName}: processed`);
}

// Build final output
const output = {
  source: 'Victoria DFFH (Department of Families, Fairness and Housing) - RTBA Bond Data',
  period: 'September Quarter 2025',
  data_type: 'LGA (Local Government Area)',
  note: 'VIC data by LGA (local council area), not postcode. E.g., Melbourne, Monash, Glen Eira',
  download_url: 'https://www.dffh.vic.gov.au/quarterly-median-rents-local-government-area-september-quarter-2025-excel',
  generated: new Date().toISOString(),
  total_lgas: Object.keys(results).length,
  data: results,
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

// Summary
console.log(`\n✅ VIC rental data: ${Object.keys(results).length} LGAs`);
const regions = {};
for (const [lga, data] of Object.entries(results)) {
  const r = data.region;
  if (!regions[r]) regions[r] = [];
  regions[r].push(lga);
}
for (const [region, lgas] of Object.entries(regions)) {
  console.log(`  ${region}: ${lgas.join(', ')}`);
}

// Show some key LGAs
console.log('\n📋 Key LGA samples:');
for (const lga of ['Melbourne', 'Monash', 'Glen Eira', 'Greater Geelong', 'Ballarat']) {
  if (results[lga]) {
    console.log(`  ${lga} (${results[lga].region}):`, JSON.stringify(results[lga]).substring(0, 200));
  }
}

const sz = fs.statSync(OUTPUT).size;
console.log(`\n📁 ${OUTPUT} (${(sz/1024).toFixed(1)} KB)`);
