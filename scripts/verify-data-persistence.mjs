import fs from 'node:fs';

const stage = fs.readFileSync('src/stage-runtime-bootstrap.js','utf8');
const reportSchema = fs.readFileSync('src/report-schema-bootstrap.js','utf8');
const resetMigration = fs.readFileSync('migrations/2026-08-21-reset-stage.sql','utf8');
const reportAiMigration = fs.readFileSync('migrations/2026-08-21-report-ai-dynamic.sql','utf8');

const destructive = /^\s*(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\b)/im;
for (const [name,content] of [
  ['bootstrap de Stage',stage],
  ['bootstrap de Reports',reportSchema],
  ['migration legada de reset',resetMigration],
  ['migration Reports IA',reportAiMigration]
]) {
  if (destructive.test(content)) throw new Error(`Falha de governança: ${name} contém SQL destrutivo. Deploy deve preservar dados.`);
}
if (!stage.includes("DATA_PERSISTENCE_MODE = 'persistent'")) {
  throw new Error('Modo persistente não declarado no runtime de Stage.');
}
if (!stage.includes('reset_disabled: true')) {
  throw new Error('Health-check não declara reset desativado.');
}
if (!resetMigration.includes('RESET DESATIVADO')) {
  throw new Error('Migration legada não está explicitamente neutralizada.');
}
if (!reportSchema.includes('MODO PERSISTENTE')) {
  throw new Error('Bootstrap de Reports não declara modo persistente.');
}
if (!reportAiMigration.includes('CREATE-ONLY')) {
  throw new Error('Migration de Reports IA precisa permanecer explicitamente create-only.');
}

console.log('OK: política de persistência cobre Stage, Reports, histórico IA e migrations; nenhum reset automático ou SQL destrutivo permitido.');
