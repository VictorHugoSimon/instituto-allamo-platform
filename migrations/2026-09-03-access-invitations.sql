-- Convites de acesso multiempresa — token armazenado somente como hash.
-- Migration aditiva; não cria usuário, senha ou convite automaticamente.

CREATE TABLE IF NOT EXISTS access_invitations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'usuario',
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invited_by TEXT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_access_invitations_company
  ON access_invitations(company_id,status,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_invitations_email
  ON access_invitations(lower(email),status,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_invitations_pending_email
  ON access_invitations(company_id,lower(email))
  WHERE status='PENDING';
