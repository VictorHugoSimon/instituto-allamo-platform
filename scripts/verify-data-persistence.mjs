import fs from 'node:fs';

const stage = fs.readFileSync('src/stage-runtime-bootstrap.js','utf8');
const resetMigration = fs.readFileSync('migrations/2026-08-21-reset-stage.sql','utf8');

const destructive = /^\s*(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\b)/im;

if (destructive.test(stage)) {
  throw new Error('Falha de governança: bootstrap de Stage contém SQL destrutivo. Deploy deve preservar dados.');
}
if (destructive.test(resetMigration)) {
  throw new Error('Falha de governança: migration legada de reset voltou a conter SQL destrutivo.');
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

console.log('OK: política de persistência ativa; deploy não contém reset automático nem SQL destrutivo de baseline.');
