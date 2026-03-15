#!/usr/bin/env python3
"""
Generate embeddings for RAG chunks using BGE-base-en-v1.5 and build SQLite-VSS database.

This script:
1. Loads processed JSONL chunks from data/processed/rag_chunks.jsonl
2. Generates embeddings using BGE-base-en-v1.5 (768 dimensions)
3. Creates SQLite database with vector search extension (sqlite-vss)
4. Builds search indexes for fast retrieval
5. Tests retrieval quality with sample queries

Requirements:
- sentence-transformers (for BGE model)
- sqlite-vss (for vector search)
- numpy (for embedding normalization)

Usage:
    python3 scripts/generate_embeddings.py
"""

import json
import sqlite3
import struct
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
except ImportError:
    print("❌ Missing dependencies. Install with:")
    print("   pip3 install sentence-transformers numpy")
    exit(1)

# Check for sqlite-vss
try:
    import sqlite_vss
    HAS_VSS = True
except ImportError:
    print("⚠️  sqlite-vss not found. Vector search will be limited.")
    print("   Install with: pip3 install sqlite-vss")
    HAS_VSS = False


class EmbeddingGenerator:
    """Generate embeddings for RAG chunks using BGE-base-en-v1.5."""
    
    def __init__(self, model_name: str = "BAAI/bge-base-en-v1.5"):
        """Initialize embedding model."""
        print(f"📥 Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = 768  # BGE-base-en-v1.5 produces 768-dimensional embeddings
        print(f"✅ Model loaded (dimension: {self.dimension})")
    
    def generate_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for a single text."""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding
    
    def generate_batch_embeddings(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generate embeddings for a batch of texts."""
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=True
        )
        return embeddings


class RAGDatabase:
    """SQLite database with vector search for RAG."""
    
    def __init__(self, db_path: Path):
        """Initialize database connection."""
        self.db_path = db_path
        self.conn = None
        self.dimension = 768
    
    def connect(self):
        """Connect to SQLite database and load extensions."""
        global HAS_VSS
        
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        
        # Try to load sqlite-vss extension if available
        # Note: Some Python sqlite3 builds don't support extensions
        if HAS_VSS:
            try:
                self.conn.enable_load_extension(True)
                sqlite_vss.load(self.conn)
                self.conn.enable_load_extension(False)
                print("✅ SQLite-VSS extension loaded")
            except (AttributeError, sqlite3.OperationalError) as e:
                print(f"⚠️  SQLite-VSS not available: {e}")
                print("   Using fallback Python cosine similarity instead")
                HAS_VSS = False
    
    def create_schema(self):
        """Create database schema with vector search support."""
        cursor = self.conn.cursor()
        
        # Main chunks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                source_file TEXT NOT NULL,
                title TEXT,
                section TEXT,
                category TEXT NOT NULL,
                subcategory TEXT,
                source_url TEXT,
                last_updated TEXT,
                chunk_index INTEGER,
                total_chunks INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Embeddings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                chunk_id TEXT PRIMARY KEY,
                embedding BLOB NOT NULL,
                FOREIGN KEY (chunk_id) REFERENCES chunks(id)
            )
        """)
        
        # Create indexes for fast filtering
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON chunks(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_source_file ON chunks(source_file)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subcategory ON chunks(subcategory)")
        
        # Create virtual table for vector search if VSS available
        if HAS_VSS:
            cursor.execute(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS vss_chunks USING vss0(
                    embedding({self.dimension})
                )
            """)
            print("✅ Vector search table created")
        
        self.conn.commit()
        print("✅ Database schema created")
    
    def insert_chunks(self, chunks: List[Dict[str, Any]], embeddings: np.ndarray):
        """Insert chunks and their embeddings into database."""
        cursor = self.conn.cursor()
        
        for i, chunk in enumerate(chunks):
            metadata = chunk.get('metadata', {})
            
            # Insert chunk metadata
            cursor.execute("""
                INSERT OR REPLACE INTO chunks (
                    id, content, source_file, title, section,
                    category, subcategory, source_url, last_updated,
                    chunk_index, total_chunks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                chunk['id'],
                chunk['content'],
                metadata.get('source_file', ''),
                metadata.get('title', ''),
                metadata.get('section', ''),
                metadata.get('category', ''),
                metadata.get('subcategory', ''),
                metadata.get('source_url', ''),
                metadata.get('last_updated', ''),
                metadata.get('chunk_index', 0),
                metadata.get('total_chunks', 0)
            ))
            
            # Insert embedding as BLOB
            embedding_blob = embeddings[i].astype(np.float32).tobytes()
            cursor.execute("""
                INSERT OR REPLACE INTO embeddings (chunk_id, embedding)
                VALUES (?, ?)
            """, (chunk['id'], embedding_blob))
            
            # Insert into VSS table if available
            if HAS_VSS:
                cursor.execute("""
                    INSERT OR REPLACE INTO vss_chunks (rowid, embedding)
                    VALUES (?, ?)
                """, (i, embedding_blob))
        
        self.conn.commit()
    
    def search(self, query_embedding: np.ndarray, top_k: int = 5, 
               category_filter: str = None) -> List[Dict[str, Any]]:
        """Search for similar chunks using vector similarity."""
        cursor = self.conn.cursor()
        
        if HAS_VSS:
            # Use VSS for fast vector search
            query_blob = query_embedding.astype(np.float32).tobytes()
            
            if category_filter:
                cursor.execute("""
                    SELECT c.*, v.distance
                    FROM vss_chunks v
                    JOIN chunks c ON v.rowid = (
                        SELECT rowid FROM chunks WHERE id = c.id LIMIT 1
                    )
                    WHERE c.category LIKE ?
                    AND vss_search(v.embedding, ?)
                    ORDER BY v.distance
                    LIMIT ?
                """, (f"%{category_filter}%", query_blob, top_k))
            else:
                cursor.execute("""
                    SELECT c.*, v.distance
                    FROM vss_chunks v
                    JOIN chunks c ON v.rowid = (
                        SELECT rowid FROM chunks WHERE id = c.id LIMIT 1
                    )
                    WHERE vss_search(v.embedding, ?)
                    ORDER BY v.distance
                    LIMIT ?
                """, (query_blob, top_k))
        else:
            # Fallback: compute cosine similarity in Python
            if category_filter:
                cursor.execute("""
                    SELECT c.*, e.embedding
                    FROM chunks c
                    JOIN embeddings e ON c.id = e.chunk_id
                    WHERE c.category LIKE ?
                """, (f"%{category_filter}%",))
            else:
                cursor.execute("""
                    SELECT c.*, e.embedding
                    FROM chunks c
                    JOIN embeddings e ON c.id = e.chunk_id
                """)
            
            # Compute similarities
            results = []
            for row in cursor:
                embedding = np.frombuffer(row['embedding'], dtype=np.float32)
                similarity = np.dot(query_embedding, embedding)
                results.append((dict(row), similarity))
            
            # Sort by similarity and take top K
            results.sort(key=lambda x: x[1], reverse=True)
            results = results[:top_k]
            
            # Format results
            formatted_results = []
            for row_dict, similarity in results:
                row_dict['distance'] = 1 - similarity  # Convert similarity to distance
                formatted_results.append(row_dict)
            
            return formatted_results
        
        # Format VSS results
        results = []
        for row in cursor:
            results.append(dict(row))
        
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics."""
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as total FROM chunks")
        total_chunks = cursor.fetchone()['total']
        
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM chunks
            GROUP BY category
            ORDER BY count DESC
        """)
        by_category = {row['category']: row['count'] for row in cursor}
        
        return {
            'total_chunks': total_chunks,
            'by_category': by_category,
            'db_size_mb': self.db_path.stat().st_size / (1024 * 1024) if self.db_path.exists() else 0
        }
    
    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()


def load_chunks(jsonl_path: Path) -> List[Dict[str, Any]]:
    """Load chunks from JSONL file."""
    chunks = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            chunks.append(json.loads(line))
    return chunks


def test_retrieval(db: RAGDatabase, generator: EmbeddingGenerator):
    """Test retrieval quality with sample queries."""
    print("\n🧪 Testing retrieval quality...")
    
    test_queries = [
        "How do I apply for Medicare?",
        "What are the tax deductions for rental properties?",
        "Can I break my lease early in NSW?",
        "What is JobSeeker payment and who is eligible?",
        "How much notice do I need to give when ending a tenancy?"
    ]
    
    for query in test_queries:
        print(f"\n📝 Query: {query}")
        query_embedding = generator.generate_embedding(query)
        results = db.search(query_embedding, top_k=3)
        
        for i, result in enumerate(results, 1):
            print(f"   {i}. [{result['category']}] {result['title']}")
            print(f"      Section: {result['section']}")
            print(f"      Distance: {result.get('distance', 0):.4f}")
            print(f"      Content: {result['content'][:150]}...")


def main():
    """Main execution flow."""
    print("🚀 RAG Embedding Generation & Database Creation\n")
    
    # Setup paths
    project_root = Path(__file__).parent.parent
    chunks_path = project_root / "data" / "processed" / "rag_chunks.jsonl"
    db_path = project_root / "data" / "processed" / "rag_database.db"
    stats_path = project_root / "data" / "processed" / "embedding_stats.json"
    
    # Ensure output directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Load chunks
    print(f"📂 Loading chunks from: {chunks_path}")
    chunks = load_chunks(chunks_path)
    print(f"✅ Loaded {len(chunks)} chunks")
    
    # Initialize embedding generator
    generator = EmbeddingGenerator()
    
    # Generate embeddings
    print(f"\n🔮 Generating embeddings for {len(chunks)} chunks...")
    texts = [chunk['content'] for chunk in chunks]
    embeddings = generator.generate_batch_embeddings(texts, batch_size=32)
    print(f"✅ Generated {len(embeddings)} embeddings")
    
    # Create database
    print(f"\n💾 Creating database: {db_path}")
    if db_path.exists():
        print("⚠️  Database exists, removing old version")
        db_path.unlink()
    
    db = RAGDatabase(db_path)
    db.connect()
    db.create_schema()
    
    # Insert data
    print(f"\n📥 Inserting {len(chunks)} chunks into database...")
    db.insert_chunks(chunks, embeddings)
    print("✅ Data inserted")
    
    # Get statistics
    stats = db.get_statistics()
    stats['generation_date'] = datetime.now().isoformat()
    stats['model'] = "BAAI/bge-base-en-v1.5"
    stats['dimension'] = generator.dimension
    stats['has_vss'] = HAS_VSS
    
    # Save statistics
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    print(f"\n📊 Database Statistics:")
    print(f"   Total chunks: {stats['total_chunks']}")
    print(f"   Database size: {stats['db_size_mb']:.2f} MB")
    print(f"   Vector search: {'Enabled' if HAS_VSS else 'Disabled (install sqlite-vss)'}")
    print(f"\n   Chunks by category:")
    for category, count in stats['by_category'].items():
        print(f"      {category}: {count} chunks")
    
    # Test retrieval
    test_retrieval(db, generator)
    
    # Close database
    db.close()
    
    print(f"\n✨ Complete!")
    print(f"   Database: {db_path}")
    print(f"   Statistics: {stats_path}")
    print(f"\n💡 Next: Integrate database into iOS app RAG system")


if __name__ == "__main__":
    main()
