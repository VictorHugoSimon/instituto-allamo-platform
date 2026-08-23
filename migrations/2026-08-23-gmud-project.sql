-- Instituto Államo PMO — evolução aditiva da tabela GMUD
-- Motivo: /api/releases e o cadastro de GMUD utilizam gmud.project.
-- Segurança: esta migration NÃO remove, substitui ou reseta dados existentes.
-- Antes de executar manualmente em Produção, confirme a ausência da coluna com:
--   PRAGMA table_info(gmud);
-- Execute o ALTER apenas se `project` ainda não existir.

ALTER TABLE gmud ADD COLUMN project TEXT NOT NULL DEFAULT '';
