-- RAG Auto-Update: Add content_hash column for change detection
-- Run with: npx wrangler d1 execute australian-rag-db --file=migrations/001_add_content_hash.sql

ALTER TABLE rag_documents ADD COLUMN content_hash TEXT DEFAULT '';

-- Index for fast hash lookups during updates
CREATE INDEX IF NOT EXISTS idx_rag_content_hash ON rag_documents(content_hash);

-- Index for category-based queries (used by update status)
CREATE INDEX IF NOT EXISTS idx_rag_category ON rag_documents(category);
