#!/usr/bin/env python3
"""
Upload RAG data to Cloudflare Vectorize and D1
"""

import sqlite3
import struct
import json
import subprocess
import tempfile
import os
import hashlib
from pathlib import Path

# Config
DB_PATH = Path(__file__).parent.parent / "data" / "processed" / "rag_database.db"
VECTORIZE_INDEX = "australian-rag"
D1_DATABASE = "australian-rag-db"
BATCH_SIZE = 100  # Vectorize insert batch size
MAX_ID_LENGTH = 64  # Cloudflare Vectorize limit

def wrangler_env():
    """Build environment for wrangler subprocess calls.
    Prefers Global API Key (CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY) over API Token.
    Removes conflicting CF_API_TOKEN to prevent wrangler confusion."""
    env = os.environ.copy()
    # Remove conflicting API tokens that wrangler might auto-detect
    for key in ['CF_API_TOKEN', 'CLOUDFLARE_API_TOKEN']:
        env.pop(key, None)
    return env

def truncate_id(original_id: str) -> str:
    """Truncate ID to max 64 bytes, using hash suffix if needed"""
    if len(original_id.encode('utf-8')) <= MAX_ID_LENGTH:
        return original_id
    # Use first 48 chars + hash of full ID
    hash_suffix = hashlib.md5(original_id.encode()).hexdigest()[:12]
    prefix = original_id[:48]
    return f"{prefix}_{hash_suffix}"

def deserialize_embedding(blob: bytes) -> list:
    """Deserialize numpy float32 array from blob"""
    count = len(blob) // 4  # float32 = 4 bytes
    return list(struct.unpack(f'{count}f', blob))

def export_vectorize_data():
    """Export data in NDJSON format for Vectorize"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT c.id, c.content, c.category, c.title, c.section, e.embedding
        FROM chunks c
        JOIN embeddings e ON c.id = e.chunk_id
    """)
    
    vectors = []
    for row in cursor.fetchall():
        embedding = deserialize_embedding(row['embedding'])
        vectors.append({
            "id": truncate_id(row['id']),
            "values": embedding,
            "metadata": {
                "category": row['category'],
                "title": row['title'] or "",
                "section": row['section'] or "",
                "original_id": row['id']  # Store original ID in metadata
            }
        })
    
    conn.close()
    return vectors

def export_d1_data():
    """Export document data for D1"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, content, source_file, title, section, category, 
               subcategory, source_url, last_updated
        FROM chunks
    """)
    
    documents = []
    for row in cursor.fetchall():
        documents.append({
            "id": truncate_id(row['id']),
            "title": row['title'] or "",
            "section": row['section'] or "",
            "content": row['content'],
            "category": row['category'],
            "source": row['source_file'] or "",
            "source_url": row['source_url'] or "",
            "tags": json.dumps([row['category'], row['subcategory']] if row['subcategory'] else [row['category']]),
            "metadata": json.dumps({"last_updated": row['last_updated'], "original_id": row['id']})
        })
    
    conn.close()
    return documents

def upload_to_vectorize(vectors):
    """Upload vectors to Cloudflare Vectorize"""
    print(f"Uploading {len(vectors)} vectors to Vectorize...")
    
    # Write NDJSON to temp file and upload in batches
    total_uploaded = 0
    for i in range(0, len(vectors), BATCH_SIZE):
        batch = vectors[i:i + BATCH_SIZE]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ndjson', delete=False) as f:
            for vector in batch:
                f.write(json.dumps(vector) + '\n')
            temp_path = f.name
        
        try:
            result = subprocess.run(
                ['wrangler', 'vectorize', 'insert', VECTORIZE_INDEX, '--file', temp_path],
                capture_output=True,
                text=True,
                env=wrangler_env()
            )
            
            if result.returncode != 0:
                print(f"Error uploading batch {i//BATCH_SIZE + 1}: {result.stderr}")
            else:
                total_uploaded += len(batch)
                print(f"  Uploaded batch {i//BATCH_SIZE + 1}/{(len(vectors)-1)//BATCH_SIZE + 1} ({total_uploaded}/{len(vectors)})")
                
        finally:
            os.unlink(temp_path)
    
    print(f"✅ Successfully uploaded {total_uploaded} vectors to Vectorize")
    return total_uploaded

def upload_to_d1(documents):
    """Upload documents to Cloudflare D1"""
    print(f"Uploading {len(documents)} documents to D1...")
    
    # Generate SQL inserts in batches
    total_uploaded = 0
    batch_size = 50  # Smaller batches for D1
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        
        # Create SQL file
        sql_statements = []
        for doc in batch:
            # Escape all single-quote variants (ASCII ' and Unicode curly ' ' `)
            def sql_escape(s):
                return (s.replace("'", "''")       # U+0027 ASCII apostrophe
                         .replace('\u2019', "''")   # ' RIGHT SINGLE QUOTATION MARK
                         .replace('\u2018', "''")   # ' LEFT SINGLE QUOTATION MARK
                         .replace('\u0060', "''")   # ` GRAVE ACCENT
                        )
            content = sql_escape(doc['content'])
            title = sql_escape(doc['title'])
            section = sql_escape(doc['section'])
            source = sql_escape(doc['source'])
            source_url = sql_escape(doc['source_url'])
            tags = sql_escape(doc['tags'])
            metadata = sql_escape(doc['metadata'])
            
            sql = f"""INSERT OR REPLACE INTO rag_documents 
                (id, title, section, content, category, source, source_url, tags, metadata)
                VALUES ('{doc["id"]}', '{title}', '{section}', '{content}', '{doc["category"]}', 
                        '{source}', '{source_url}', '{tags}', '{metadata}');"""
            sql_statements.append(sql)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
            f.write('\n'.join(sql_statements))
            temp_path = f.name
        
        try:
            result = subprocess.run(
                ['wrangler', 'd1', 'execute', D1_DATABASE, '--remote', '--file', temp_path],
                capture_output=True,
                text=True,
                input='y\n',  # Auto-confirm
                env=wrangler_env()
            )
            
            if result.returncode != 0:
                print(f"Error uploading D1 batch {i//batch_size + 1}: STDOUT={result.stdout[-500:]} STDERR={result.stderr[-500:]}")
                print(f"  Failing SQL saved at: {temp_path}")
                # Retry once
                import time
                time.sleep(3)
                result2 = subprocess.run(
                    ['wrangler', 'd1', 'execute', D1_DATABASE, '--remote', '--file', temp_path],
                    capture_output=True, text=True, input='y\n',
                    env=wrangler_env()
                )
                if result2.returncode == 0:
                    total_uploaded += len(batch)
                    print(f"  Retried D1 batch {i//batch_size + 1} — success ({total_uploaded}/{len(documents)})")
                    os.unlink(temp_path)
                else:
                    print(f"  Retry also failed: {result2.stderr[-300:]}")
                    # Don't delete the file so it can be inspected
            else:
                total_uploaded += len(batch)
                print(f"  Uploaded D1 batch {i//batch_size + 1}/{(len(documents)-1)//batch_size + 1} ({total_uploaded}/{len(documents)})")
                os.unlink(temp_path)
        except Exception as exc:
            print(f"  Exception in batch {i//batch_size + 1}: {exc}")
            try: os.unlink(temp_path)
            except: pass
    
    print(f"✅ Successfully uploaded {total_uploaded} documents to D1")
    return total_uploaded

def rebuild_fts_index():
    """Rebuild FTS5 index from rag_documents table"""
    print("Rebuilding FTS5 full-text search index...")

    sql = """
-- Drop and recreate FTS5 table to ensure clean state
DROP TABLE IF EXISTS rag_fts;
CREATE VIRTUAL TABLE rag_fts USING fts5(title, section, content, content='rag_documents', content_rowid='rowid');

-- Populate FTS5 from existing documents
INSERT INTO rag_fts(rowid, title, section, content) SELECT rowid, title, section, content FROM rag_documents;

-- Create sync triggers
DROP TRIGGER IF EXISTS rag_fts_insert;
CREATE TRIGGER rag_fts_insert AFTER INSERT ON rag_documents BEGIN
  INSERT INTO rag_fts(rowid, title, section, content) VALUES (new.rowid, new.title, new.section, new.content);
END;

DROP TRIGGER IF EXISTS rag_fts_update;
CREATE TRIGGER rag_fts_update AFTER UPDATE ON rag_documents BEGIN
  INSERT INTO rag_fts(rag_fts, rowid, title, section, content) VALUES ('delete', old.rowid, old.title, old.section, old.content);
  INSERT INTO rag_fts(rowid, title, section, content) VALUES (new.rowid, new.title, new.section, new.content);
END;

DROP TRIGGER IF EXISTS rag_fts_delete;
CREATE TRIGGER rag_fts_delete AFTER DELETE ON rag_documents BEGIN
  INSERT INTO rag_fts(rag_fts, rowid, title, section, content) VALUES ('delete', old.rowid, old.title, old.section, old.content);
END;
"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        f.write(sql)
        temp_path = f.name

    try:
        result = subprocess.run(
            ['wrangler', 'd1', 'execute', D1_DATABASE, '--remote', '--file', temp_path],
            capture_output=True, text=True, input='y\n'
        )
        if result.returncode != 0:
            print(f"⚠️  FTS5 rebuild warning: {result.stderr[:200]}")
        else:
            print("✅ FTS5 index rebuilt successfully")
    finally:
        os.unlink(temp_path)

def main():
    print("=" * 50)
    print("Cloudflare RAG Data Upload Script")
    print("=" * 50)
    
    if not DB_PATH.exists():
        print(f"❌ Database not found: {DB_PATH}")
        return
    
    print(f"📂 Source: {DB_PATH}")
    print(f"🎯 Vectorize Index: {VECTORIZE_INDEX}")
    print(f"🗄️ D1 Database: {D1_DATABASE}")
    print()
    
    # Export data
    print("📤 Exporting data from local database...")
    vectors = export_vectorize_data()
    documents = export_d1_data()
    print(f"   Found {len(vectors)} vectors and {len(documents)} documents")
    print()
    
    # Upload to Vectorize
    upload_to_vectorize(vectors)
    print()
    
    # Upload to D1
    upload_to_d1(documents)
    print()
    
    # Rebuild FTS5 index
    rebuild_fts_index()
    print()

    print("=" * 50)
    print("✅ Upload Complete!")
    print("=" * 50)

if __name__ == '__main__':
    main()
