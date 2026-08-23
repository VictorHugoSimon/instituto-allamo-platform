import fs from 'node:fs';

const stage = fs.readFileSync('src/stage-runtime-bootstrap.js','utf8');
const reportSchema = fs.readFileSync('src/report-schema-bootstrap.js','utf8');
const resetMigration = fs.readFileSync('migrations/2026-08-21-reset-stage.sql','utf8');
const reportAiMigration = fs.readFileSync('migrations/2026-08-21-report-ai-dynamic.sql','utf8');
const dynamicTenantMigration = fs.readFileSync('migrations/2026-08-21-dynamic-tenant-storage.sql','utf8');
const milestoneMigration = fs.readFileSync('migrations/2026-08-21-milestone-evidence.sql','utf8');
const d1ChunksMigration = fs.readFileSync('migrations/2026-08-21-d1-file-chunks.sql','utf8');
const gmudProjectMigration = fs.readFileSync('migrations/2026-08-23-gmud-project.sql','utf8');

// Procura comandos SQL destrutivos em qualquer posição, inclusive dentro de strings JS.
const destructive = /\b(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
for (const [name,content] of [
  ['bootstrap de Stage',stage],
  ['bootstrap de Reports',reportSchema],
  ['migration legada de reset',resetMigration],
  ['migration Reports IA',reportAiMigration],
  ['migration campos/arquivos multitenant',dynamicTenantMigration],
  ['migration marcos/evidências',milestoneMigration],
  ['migration chunks D1',d1ChunksMigration],
  ['migration associação GMUD/projeto',gmudProjectMigration]
]) {
  if (destructive.test(content)) throw new Error(`Falha de governança: ${name} contém SQL destrutivo. Deploy deve preservar dados.`);
}
if (!stage.includes("DATA_PERSISTENCE_MODE = 'persistent'")) throw new Error('Modo persistente não declarado no runtime de Stage.');
if (!stage.includes('reset_disabled: true')) throw new Error('Health-check não declara reset desativado.');
if (!resetMigration.includes('RESET DESATIVADO')) throw new Error('Migration legada não está explicitamente neutralizada.');
if (!reportSchema.includes('MODO PERSISTENTE')) throw new Error('Bootstrap de Reports não declara modo persistente.');
if (!reportAiMigration.includes('CREATE-ONLY')) throw new Error('Migration de Reports IA precisa permanecer explicitamente create-only.');
if (!dynamicTenantMigration.includes('somente aditiva')) throw new Error('Migration multitenant deve permanecer explicitamente aditiva.');
if (!d1ChunksMigration.includes('CREATE-ONLY') || !d1ChunksMigration.includes('tenant_file_chunks')) throw new Error('Migration do fallback D1 deve permanecer create-only e chunked.');
if (!reportSchema.includes('tenant_field_definitions') || !reportSchema.includes('tenant_files') || !reportSchema.includes('tenant_file_chunks')) throw new Error('Schema persistente não contempla campos dinâmicos/arquivos/chunks multitenant.');
if (!stage.includes("stageEnsureColumn('gmud', 'project'")) throw new Error('Stage não corrige de forma idempotente a coluna gmud.project.');
if (!gmudProjectMigration.includes("ALTER TABLE gmud ADD COLUMN project TEXT NOT NULL DEFAULT ''")) throw new Error('Migration GMUD/projeto não contém a evolução aditiva esperada.');

console.log('OK: persistência cobre Stage, Reports, IA, campos dinâmicos, arquivos R2/D1, chunks, marcos e evolução GMUD/projeto; nenhum reset automático ou SQL destrutivo permitido.');
