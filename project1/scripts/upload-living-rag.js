#!/usr/bin/env node
/**
 * Upload living RAG documents (driving/citizenship/pets/insurance/licensing) to D1
 * 
 * Usage: node scripts/upload-living-rag.js
 * 
 * Categories uploaded:
 *   living/driving, living/citizenship, living/pets, living/insurance, government/licensing
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKER_DIR = path.join(__dirname, '..', 'cloudflare', 'api-worker');
const RAG_DIR = path.join(__dirname, '..', 'rag-data');
const DB_NAME = 'australian-rag-db';

const CATEGORY_MAP = {
  'driving': 'living/driving',
  'citizenship': 'living/citizenship',
  'pets': 'living/pets',
  'insurance': 'living/insurance',
  'licensing': 'government/licensing',
  'finance': 'government/banking',
  'student': 'government/education',
  'telco': 'living/telco',
  'medicare': 'government/medicare',
  'scams': 'government/scams',
};

let totalInserted = 0;
let totalSkipped = 0;

for (const [dir, category] of Object.entries(CATEGORY_MAP)) {
  const dirPath = path.join(RAG_DIR, dir);
  if (!fs.existsSync(dirPath)) { console.log(`⚠️ ${dir}/ not found, skipping`); continue; }
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  
  for (const filename of files) {
    const content = fs.readFileSync(path.join(dirPath, filename), 'utf8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename;
    
    // Split by ## sections
    const sections = content.split(/^(?=## )/m).filter(s => s.trim());
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (section.length < 20) continue; // Skip too-short sections
      
      const sectionTitle = section.match(/^##\s+(.+)$/m);
      const sectionName = sectionTitle ? sectionTitle[1].trim() : 'Overview';
      const chunkId = `${category.replace(/\//g, '_')}_${filename.replace('.md', '')}_s${i + 1}`;
      
      // Write content to temp SQL file to avoid shell escaping issues
      const tmpSqlFile = `/tmp/rag-${chunkId}.sql`;
      const escapedContent = section.replace(/'/g, "''");
      const escapedTitle = title.substring(0, 200).replace(/'/g, "''");
      const escapedSection = sectionName.substring(0, 100).replace(/'/g, "''");
      const meta = JSON.stringify({ last_updated: '2026-03-12', source_file: filename }).replace(/'/g, "''");
      
      const sql = `INSERT OR REPLACE INTO rag_documents (id, title, section, content, category, source_url, metadata) VALUES ('${chunkId}', '${escapedTitle}', '${escapedSection}', '${escapedContent}', '${category}', 'built-in', '${meta}');`;
      
      fs.writeFileSync(tmpSqlFile, sql);
      
      try {
        execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file="${tmpSqlFile}"`, {
          cwd: WORKER_DIR,
          stdio: 'pipe',
          timeout: 30000,
        });
        totalInserted++;
        process.stdout.write(`  ✅ ${chunkId}\n`);
      } catch (err) {
        console.error(`  ❌ ${chunkId}: ${err.message.substring(0, 100)}`);
        totalSkipped++;
      }
      
      // cleanup
      try { fs.unlinkSync(tmpSqlFile); } catch {}
    }
    console.log(`📄 [${category}] ${filename}: ${sections.length} sections`);
  }
}

console.log(`\n✅ Uploaded ${totalInserted} chunks, ❌ Skipped ${totalSkipped}`);

// Rebuild FTS5
console.log('\n🔍 Rebuilding FTS5...');
try {
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="INSERT INTO rag_fts(rag_fts) VALUES('rebuild')"`, {
    cwd: WORKER_DIR, stdio: 'pipe', timeout: 60000,
  });
  console.log('✅ FTS5 rebuilt');
} catch (err) {
  console.log('⚠️ FTS5 rebuild:', err.message.substring(0, 100));
}
