-- Instituto Államo PMO — fallback de arquivos no D1 sem R2
-- CREATE-ONLY / somente aditiva. Não remove nem altera dados existentes.
-- Cada chunk fica abaixo de 2 MB; o aplicativo usa aproximadamente 1,5 MB por linha.

CREATE TABLE IF NOT EXISTS tenant_file_chunks (
  file_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  chunk_no INTEGER NOT NULL,
  data_blob BLOB NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(file_id, chunk_no)
);

CREATE INDEX IF NOT EXISTS idx_tenant_file_chunks_context
  ON tenant_file_chunks(company_id, project_id, file_id, chunk_no);
