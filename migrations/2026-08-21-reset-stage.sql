-- RESET CONTROLADO DO AMBIENTE STAGE / HOMOLOGAÇÃO
-- Objetivo: remover dados de negócio e reiniciar a homologação do zero.
-- NÃO executar em produção.

PRAGMA foreign_keys = OFF;

-- Work Management nativo
DELETE FROM work_comments;
DELETE FROM work_checklist;
DELETE FROM work_links;
DELETE FROM work_events;
DELETE FROM work_items;
DELETE FROM work_sprints;

-- Planejamento e execução legados
DELETE FROM plan_items;
DELETE FROM issues;
DELETE FROM gmud;
DELETE FROM releases;
DELETE FROM documents;
DELETE FROM notifications;
DELETE FROM project_reports;
DELETE FROM report_snapshots;
DELETE FROM projects;

-- Integrações / dados auxiliares visíveis no portal
DELETE FROM horas_import;
DELETE FROM sync_state;
DELETE FROM email_outbox;

-- Limpa usuários vinculados a clientes, preservando contas internas
DELETE FROM sessions
WHERE user_id IN (
  SELECT id FROM users
  WHERE company_id IS NOT NULL
     OR role IN ('gestor','usuario')
);
DELETE FROM users
WHERE company_id IS NOT NULL
   OR role IN ('gestor','usuario');
UPDATE users
SET company_id = NULL
WHERE role IN ('admin','pmo','techlead');

-- Empresa por último, após todos os vínculos
DELETE FROM companies;

-- Histórico também é reiniciado para homologação limpa
DELETE FROM audit_log;

-- Reinicia sequências das tabelas AUTOINCREMENT conhecidas
DELETE FROM sqlite_sequence
WHERE name IN (
  'projects','releases','documents','users','audit_log','report_snapshots',
  'plan_items','notifications','email_outbox','horas_import','work_comments','work_checklist','work_links','work_events'
);

PRAGMA foreign_keys = ON;
