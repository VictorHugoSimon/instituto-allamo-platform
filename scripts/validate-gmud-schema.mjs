import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const stage=fs.readFileSync('src/stage-runtime-bootstrap.js','utf8');
const migration=fs.readFileSync('migrations/2026-08-23-gmud-project.sql','utf8');

const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
must(worker,"SELECT * FROM gmud WHERE status='Implementada'",'GET /api/releases compatível com schema GMUD legado');
if(worker.includes("SELECT id,title,company_id,project,window_txt,description FROM gmud WHERE status='Implementada'")) throw new Error('GET /api/releases ainda referencia gmud.project obrigatoriamente.');
must(worker,'INSERT INTO gmud (id,title,company_id,project,','Cadastro de GMUD preserva vínculo com projeto');
must(stage,"stageEnsureColumn('gmud', 'project'",'Stage evolui gmud.project automaticamente e sem reset');
must(stage,'PRAGMA table_info(','Bootstrap verifica schema antes do ALTER');
must(stage,"schema: { gmud_project: gmudProjectReady }",'Health de Stage expõe prontidão do schema GMUD');
must(migration,"ALTER TABLE gmud ADD COLUMN project TEXT NOT NULL DEFAULT ''",'Migration aditiva para Produção');

const destructive=/\b(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
if(destructive.test(stage)||destructive.test(migration)) throw new Error('Correção GMUD contém SQL destrutivo.');
console.log('OK: schema GMUD/projeto compatível, aditivo e protegido contra o erro no such column: project.');
