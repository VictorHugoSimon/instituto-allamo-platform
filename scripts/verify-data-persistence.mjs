import fs from 'node:fs';

const stage = fs.readFileSync('src/stage-runtime-bootstrap.js','utf8');
const reportSchema = fs.readFileSync('src/report-schema-bootstrap.js','utf8');
const globalReportSchema = fs.readFileSync('src/global-report-schema-bootstrap.js','utf8');
const governanceSchema = fs.readFileSync('src/governance-schema-bootstrap.js','utf8');
const governanceMigration = fs.readFileSync('migrations/2026-08-23-governance-roadmap.sql','utf8');
const resetMigration = fs.readFileSync('migrations/2026-08-21-reset-stage.sql','utf8');
const reportAiMigration = fs.readFileSync('migrations/2026-08-21-report-ai-dynamic.sql','utf8');
const dynamicTenantMigration = fs.readFileSync('migrations/2026-08-21-dynamic-tenant-storage.sql','utf8');
const milestoneMigration = fs.readFileSync('migrations/2026-08-21-milestone-evidence.sql','utf8');
const d1ChunksMigration = fs.readFileSync('migrations/2026-08-21-d1-file-chunks.sql','utf8');
const gmudProjectMigration = fs.readFileSync('migrations/2026-08-23-gmud-project.sql','utf8');
const legacyStageRestoreSql = fs.readFileSync('ops/stage/restore-baseline-three-companies.sql','utf8');
const legacyStageRestoreCmd = fs.readFileSync('scripts/restore-stage-baseline-three.cmd','utf8');

// Procura comandos SQL destrutivos em qualquer posição, inclusive dentro de strings JS.
// No SQL legado neutralizado, comentários são removidos antes da inspeção para evitar falso positivo documental.
const destructive = /\b(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
const stripSqlComments = content => content.replace(/^\s*--.*$/gm,'');
for (const [name,content] of [
  ['bootstrap de Stage',stage],
  ['bootstrap de Reports',reportSchema],
  ['bootstrap global de Reports',globalReportSchema],
  ['bootstrap de Governança',governanceSchema],
  ['migration Governança',governanceMigration],
  ['migration legada de reset',resetMigration],
  ['migration Reports IA',reportAiMigration],
  ['migration campos/arquivos multitenant',dynamicTenantMigration],
  ['migration marcos/evidências',milestoneMigration],
  ['migration chunks D1',d1ChunksMigration],
  ['migration associação GMUD/projeto',gmudProjectMigration],
  ['SQL legado de restore do Stage',stripSqlComments(legacyStageRestoreSql)]
]) {
  if (destructive.test(content)) throw new Error(`Falha de governança: ${name} contém SQL destrutivo. Deploy deve preservar dados.`);
}
if (/\bwrangler\s+d1\s+(execute|export)\b/i.test(legacyStageRestoreCmd)) throw new Error('Falha de governança: script legado de restore ainda consegue acessar D1.');
if (/RESTAURAR-STAGE-3/i.test(legacyStageRestoreCmd)) throw new Error('Falha de governança: confirmação destrutiva antiga ainda está presente no script legado.');
if (!legacyStageRestoreCmd.includes('RESTORE DE BASELINE DO STAGE - DESATIVADO')) throw new Error('Script legado de restore não está explicitamente neutralizado.');
if (!legacyStageRestoreSql.includes('RESTORE DESATIVADO')) throw new Error('SQL legado de restore não está explicitamente neutralizado.');
if (!stage.includes("DATA_PERSISTENCE_MODE = 'persistent'")) throw new Error('Modo persistente não declarado no runtime de Stage.');
if (!stage.includes('reset_disabled: true')) throw new Error('Health-check não declara reset desativado.');
if (!stage.includes("governance_events: await stageCount('governance_events')")) throw new Error('Health-check de Stage não valida a camada de governança.');
if (!stage.includes("stageEnsureColumn('gmud', 'project'")) throw new Error('Stage não corrige de forma idempotente a coluna gmud.project.');
if (!stage.includes("schema: { gmud_project: gmudProjectReady }")) throw new Error('Health-check de Stage não expõe a prontidão do schema GMUD.');
if (!resetMigration.includes('RESET DESATIVADO')) throw new Error('Migration legada não está explicitamente neutralizada.');
if (!reportSchema.includes('MODO PERSISTENTE')) throw new Error('Bootstrap de Reports não declara modo persistente.');
if (!globalReportSchema.includes('Stage e Produção')) throw new Error('Bootstrap global precisa declarar cobertura de Stage e Produção.');
if (!globalReportSchema.includes('CREATE TABLE IF NOT EXISTS report_records')) throw new Error('Bootstrap global não garante report_records.');
if (!globalReportSchema.includes('CREATE TABLE IF NOT EXISTS report_roadmap_items')) throw new Error('Bootstrap global não garante report_roadmap_items.');
if (!governanceSchema.includes('criação idempotente e não destrutiva')) throw new Error('Bootstrap de Governança precisa declarar criação não destrutiva.');
if (!governanceMigration.includes('Migration aditiva e persistente')) throw new Error('Migration de Governança precisa permanecer explicitamente aditiva.');
if (!reportAiMigration.includes('CREATE-ONLY')) throw new Error('Migration de Reports IA precisa permanecer explicitamente create-only.');
if (!dynamicTenantMigration.includes('somente aditiva')) throw new Error('Migration multitenant deve permanecer explicitamente aditiva.');
if (!d1ChunksMigration.includes('CREATE-ONLY') || !d1ChunksMigration.includes('tenant_file_chunks')) throw new Error('Migration do fallback D1 deve permanecer create-only e chunked.');
if (!gmudProjectMigration.includes("ALTER TABLE gmud ADD COLUMN project TEXT NOT NULL DEFAULT ''")) throw new Error('Migration GMUD/projeto não contém a evolução aditiva esperada.');
if (!reportSchema.includes('tenant_field_definitions') || !reportSchema.includes('tenant_files') || !reportSchema.includes('tenant_file_chunks')) throw new Error('Schema persistente não contempla campos dinâmicos/arquivos/chunks multitenant.');
for(const table of ['governance_events','governance_event_agenda_items','governance_event_stakeholders','governance_event_work_links','governance_event_decisions']){
  if(!governanceSchema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)||!governanceMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`))throw new Error(`Governança persistente incompleta: ${table}`);
}

console.log('OK: persistência cobre Stage e Produção, Reports, IA, campos dinâmicos, arquivos R2/D1, marcos, governança e evolução GMUD/projeto; restore legado neutralizado e nenhum SQL destrutivo permitido.');
