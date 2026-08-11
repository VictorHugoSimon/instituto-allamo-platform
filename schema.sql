-- Instituto Allamo · Portal PMO — Esquema Cloudflare D1
-- Aplicar: wrangler d1 execute allamo-pmo --file=./schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE companies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  city         TEXT,
  system       TEXT,          -- SallamoS, TOTVS, Nucci, Sankhya
  own_system   INTEGER DEFAULT 0,  -- 1 = sistema proprio (SallamoS)
  lead         TEXT,          -- responsavel PMO
  start_date   TEXT,
  status       TEXT,          -- g=concluido a=ok r=risco s=reconciliar
  status_text  TEXT,
  pmo_mode     TEXT,          -- PMO Direto / Indireto
  progress     INTEGER,       -- 0-100, NULL = sem medicao
  summary      TEXT
);

CREATE TABLE projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  company_id   TEXT REFERENCES companies(id),
  status       TEXT,          -- Em andamento / Backlog / Completo / Cancelado
  badge        TEXT,
  urgency      TEXT,
  summary      TEXT,
  lead         TEXT,
  start_date   TEXT,
  meta_date    TEXT,
  pmo_read     TEXT,          -- Critico / Atencao / Regular
  note         TEXT,
  linear_url   TEXT
);

CREATE TABLE issues (
  id           TEXT PRIMARY KEY,   -- ALL-10
  title        TEXT NOT NULL,
  project      TEXT,
  company_id   TEXT REFERENCES companies(id),
  status       TEXT,
  priority     TEXT,
  owner        TEXT,
  due_date     TEXT,
  flag         TEXT,
  flag_type    TEXT            -- c=critico w=aviso
);

CREATE TABLE gmud (
  id           TEXT PRIMARY KEY,   -- GMUD-014
  title        TEXT NOT NULL,
  company_id   TEXT REFERENCES companies(id),
  type         TEXT,          -- Emergencial / Normal / Padrao
  risk         TEXT,          -- Alto / Medio / Baixo
  status       TEXT,          -- Rascunho / Em aprovacao / Aprovada / Agendada / Implementada / Rejeitada
  requester    TEXT,
  approver     TEXT,
  window_txt   TEXT,
  affects      TEXT,
  rollback     TEXT,
  client_visible INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  decided_by   TEXT,
  decided_at   TEXT
);

CREATE TABLE releases (   -- viradas / versoes
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rel_date     TEXT,
  weekday      TEXT,
  company_id   TEXT REFERENCES companies(id),
  title        TEXT NOT NULL,
  description  TEXT,
  tags         TEXT           -- JSON: [["SallamoS","sal"],["Correcao",""]]
);

CREATE TABLE documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT REFERENCES companies(id),
  name         TEXT NOT NULL,
  doc_type     TEXT,
  doc_date     TEXT,
  ext          TEXT,          -- PDF / XLS / DOC
  url          TEXT
);

CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- PBKDF2/scrypt hash (nunca senha em texto)
  role         TEXT NOT NULL,  -- admin / pmo / gestor / usuario
  company_id   TEXT REFERENCES companies(id),  -- NULL = escopo Allamo (todas)
  status       TEXT DEFAULT 'Ativo',  -- Ativo / Convidado / Bloqueado
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token        TEXT PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  expires_at   TEXT NOT NULL
);

CREATE INDEX idx_issues_company ON issues(company_id);
CREATE INDEX idx_gmud_company   ON gmud(company_id);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_users_company  ON users(company_id);
