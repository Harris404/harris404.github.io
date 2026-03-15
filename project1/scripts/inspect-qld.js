const XLSX = require('xlsx');
const wb = XLSX.read(require('fs').readFileSync('data/rental/qld_bond_statistics.xlsx'), {type:'buffer'});

const s = wb.Sheets['1 pc-rents'];
const range = XLSX.utils.decode_range(s['!ref']);

// Find actual data start by searching for "Postcode" text
let dataStartRow = -1;
let pcCol = -1, dwCol = -1;
for (let r = 0; r <= 10; r++) {
  for (let c = 0; c <= 5; c++) {
    const cell = s[XLSX.utils.encode_cell({r, c})];
    if (cell && String(cell.v).includes('Postcode')) {
      dataStartRow = r;
      pcCol = c;
      console.log('Found "Postcode" at row', r, 'col', c);
    }
    if (cell && String(cell.v).includes('Dwelling')) {
      dwCol = c;
      console.log('Found "Dwelling" at row', r, 'col', c);
    }
  }
}

if (dataStartRow < 0) { console.log('Cannot find header'); process.exit(1); }

// Find year headers
const yearRow = dataStartRow - 1; // years are one row above quarters
const qtrRow = dataStartRow; // quarter names same row or one below
console.log('\nScanning year/quarter headers from col 4...');
for (let c = 3; c <= Math.min(range.e.c, 59); c++) {
  const yrCell = s[XLSX.utils.encode_cell({r: yearRow, c})];
  const qtrCell = s[XLSX.utils.encode_cell({r: dataStartRow + 1, c})];
  if (yrCell || qtrCell) console.log('  Col', c, ': yr=', yrCell ? yrCell.v : '', ' qtr=', qtrCell ? qtrCell.v : '');
}

// Now try to read actual data rows (start from dataStartRow + 2)
console.log('\nData samples:');
for (let r = dataStartRow + 2; r < dataStartRow + 15; r++) {
  const pc = s[XLSX.utils.encode_cell({r, c: pcCol})];
  const dw = s[XLSX.utils.encode_cell({r, c: dwCol})];
  // Last data column
  let lastColVal = null;
  for (let c2 = range.e.c; c2 >= range.e.c - 5; c2--) {
    const v = s[XLSX.utils.encode_cell({r, c: c2})];
    if (v && v.v !== '') { lastColVal = c2 + ':' + v.v; break; }
  }
  if (pc || dw) console.log('  Row', r, ':', pc ? pc.v : '?', dw ? dw.v : '?', '| latest:', lastColVal);
}
