-- RESTAURAÇÃO MANUAL E EXCLUSIVA DO STAGE
-- Baseline aprovado: Madrid, PR e Dual Clima.
-- NUNCA incluir este arquivo em migrations automáticas ou deploy de Produção.
-- O script preserva usuários/sessões e dados pertencentes somente às 3 empresas.

PRAGMA foreign_keys = OFF;

CREATE TEMP TABLE _keep_company (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO _keep_company(id,name)
SELECT id,name
FROM companies
WHERE lower(trim(name)) IN ('madrid','pr','dual clima');

-- Fail-safe: se os três nomes exatos não existirem, interrompe ANTES de qualquer DELETE.
CREATE TEMP TABLE _baseline_guard (
  company_count INTEGER NOT NULL CHECK(company_count = 3)
);
INSERT INTO _baseline_guard(company_count)
SELECT COUNT(*) FROM _keep_company;

-- Dependências de Work Management.
DELETE FROM work_comments
WHERE work_item_id IN (SELECT id FROM work_items WHERE company_id NOT IN (SELECT id FROM _keep_company));
DELETE FROM work_checklist
WHERE work_item_id IN (SELECT id FROM work_items WHERE company_id NOT IN (SELECT id FROM _keep_company));
DELETE FROM work_links
WHERE source_item_id IN (SELECT id FROM work_items WHERE company_id NOT IN (SELECT id FROM _keep_company))
   OR target_item_id IN (SELECT id FROM work_items WHERE company_id NOT IN (SELECT id FROM _keep_company));
DELETE FROM work_events WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM work_items WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM work_sprints WHERE company_id NOT IN (SELECT id FROM _keep_company);

-- Reports nativos, histórico, roadmap e recorrência.
DELETE FROM report_versions
WHERE company_id NOT IN (SELECT id FROM _keep_company)
   OR report_id IN (SELECT id FROM report_records WHERE company_id NOT IN (SELECT id FROM _keep_company));
DELETE FROM report_roadmap_items WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM report_series_meetings
WHERE series_id IN (SELECT id FROM report_series WHERE company_id NOT IN (SELECT id FROM _keep_company));
DELETE FROM report_series_cycles
WHERE series_id IN (SELECT id FROM report_series WHERE company_id NOT IN (SELECT id FROM _keep_company));
DELETE FROM report_series WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM report_records WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM legacy_report_versions
WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM report_ai_runs
WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM _keep_company);

-- Campos dinâmicos e arquivos multitenant.
DELETE FROM tenant_file_chunks WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM tenant_files WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM tenant_field_values WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM tenant_field_definitions WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM project_milestone_assets WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM project_milestone_details WHERE company_id NOT IN (SELECT id FROM _keep_company);

-- Estruturas legadas ainda usadas pelo portal atual.
DELETE FROM project_reports_p WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM project_reports WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM project_updates WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM docs_files WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM plan_items WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM releases WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM gmud WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM issues WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM documents WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM notifications WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM rca WHERE company_id NOT IN (SELECT id FROM _keep_company);
DELETE FROM audit_log WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM _keep_company);

-- Horas importadas são mantidas apenas quando a chave textual corresponde ao baseline.
DELETE FROM horas_import
WHERE lower(replace(trim(company_key),' ','')) NOT IN ('madrid','pr','dualclima');

-- Projetos de outras empresas são removidos somente depois de seus dados dependentes.
DELETE FROM projects WHERE company_id NOT IN (SELECT id FROM _keep_company);

-- Por último, remove as empresas fora do baseline aprovado.
DELETE FROM companies WHERE id NOT IN (SELECT id FROM _keep_company);

PRAGMA foreign_keys = ON;

SELECT 'BASELINE_OK' AS status, COUNT(*) AS companies FROM companies;
SELECT id,name FROM companies ORDER BY name;
SELECT company_id,COUNT(*) AS projects FROM projects GROUP BY company_id ORDER BY company_id;
SELECT company_id,project_id,COUNT(*) AS reports FROM report_records GROUP BY company_id,project_id ORDER BY company_id,project_id;
