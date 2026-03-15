#!/usr/bin/env node
/**
 * Upload telco RAG documents to D1 + Vectorize
 * Usage: node scripts/upload-telco-rag.js
 * Requires: wrangler configured with D1 access
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKER_DIR = path.join(__dirname, '..', 'cloudflare', 'api-worker');
const RAG_DIR = path.join(__dirname, '..', 'rag-data', 'telco');
const DB_NAME = 'australian-rag-db';
const CATEGORY = 'living/telco';

const files = fs.readdirSync(RAG_DIR).filter(f => f.endsWith('.md'));
console.log(`📁 Found ${files.length} telco RAG files\n`);

let totalInserted = 0;

for (const filename of files) {
  const filepath = path.join(RAG_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Extract title from first # header
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');
  
  // Split by ## sections
  const sections = content.split(/^(?=## )/m).filter(s => s.trim());
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    const sectionTitle = section.match(/^##\s+(.+)$/m);
    const sectionName = sectionTitle ? sectionTitle[1].trim() : 'Overview';
    
    const chunkId = `${CATEGORY.replace('/', '_')}_${filename.replace('.md', '')}_s${i + 1}`;
    const metadata = JSON.stringify({
      source_file: filename,
      last_updated: '2026-03-11',
    });
    
    // Escape for SQL
    const escapedContent = section.replace(/'/g, "''");
    const escapedTitle = title.replace(/'/g, "''");
    const escapedSection = sectionName.replace(/'/g, "''");
    
    const sql = `INSERT OR REPLACE INTO rag_documents (id, title, section, content, category, source_url, metadata) VALUES ('${chunkId}', '${escapedTitle}', '${escapedSection}', '${escapedContent}', '${CATEGORY}', 'built-in telco data', '${metadata.replace(/'/g, "''")}')`;
    
    try {
      execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="${sql.replace(/"/g, '\\"')}"`, {
        cwd: WORKER_DIR,
        stdio: 'pipe',
      });
      totalInserted++;
      process.stdout.write(`  ✅ ${chunkId}\n`);
    } catch (err) {
      console.error(`  ❌ ${chunkId}: ${err.message.slice(0, 100)}`);
    }
  }
  console.log(`📄 ${filename}: ${sections.length} sections`);
}

console.log(`\n✅ Uploaded ${totalInserted} chunks to D1 (category: ${CATEGORY})`);

// Also insert into FTS5
console.log('\n🔍 Rebuilding FTS5 index...');
try {
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="INSERT INTO rag_fts(rag_fts) VALUES('rebuild')"`, {
    cwd: WORKER_DIR,
    stdio: 'pipe',
  });
  console.log('✅ FTS5 index rebuilt');
} catch (err) {
  console.log('⚠️ FTS5 rebuild skipped (may need manual rebuild):', err.message.slice(0, 80));
}
