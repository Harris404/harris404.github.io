-- RAG 文档存储表
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  section TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  tags TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_category ON rag_documents(category);
CREATE INDEX IF NOT EXISTS idx_source ON rag_documents(source);
CREATE INDEX IF NOT EXISTS idx_title ON rag_documents(title);

-- 全文搜索 (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS rag_fts USING fts5(
  title,
  section,
  content,
  content='rag_documents',
  content_rowid='rowid'
);

-- FTS5 同步触发器: INSERT
CREATE TRIGGER IF NOT EXISTS rag_fts_insert AFTER INSERT ON rag_documents BEGIN
  INSERT INTO rag_fts(rowid, title, section, content)
  VALUES (new.rowid, new.title, new.section, new.content);
END;

-- FTS5 同步触发器: UPDATE
CREATE TRIGGER IF NOT EXISTS rag_fts_update AFTER UPDATE ON rag_documents BEGIN
  INSERT INTO rag_fts(rag_fts, rowid, title, section, content)
  VALUES ('delete', old.rowid, old.title, old.section, old.content);
  INSERT INTO rag_fts(rowid, title, section, content)
  VALUES (new.rowid, new.title, new.section, new.content);
END;

-- FTS5 同步触发器: DELETE
CREATE TRIGGER IF NOT EXISTS rag_fts_delete AFTER DELETE ON rag_documents BEGIN
  INSERT INTO rag_fts(rag_fts, rowid, title, section, content)
  VALUES ('delete', old.rowid, old.title, old.section, old.content);
END;
