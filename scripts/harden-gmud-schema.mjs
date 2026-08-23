import fs from 'node:fs';

const workerFile='public/_worker.js';
let worker=fs.readFileSync(workerFile,'utf8');

// Bases legadas de Stage podem não possuir gmud.project. O GET de /api/releases
// não precisa exigir a coluna para carregar as viradas; SELECT * mantém o endpoint
// funcional antes/durante a evolução aditiva do schema. Após a migration, g.project
// passa a existir normalmente e continua sendo usado pelo map existente.
const legacyQuery='SELECT id,title,company_id,project,window_txt,description FROM gmud WHERE status=\'Implementada\'';
const compatibleQuery='SELECT * FROM gmud WHERE status=\'Implementada\'';
worker=worker.split(legacyQuery).join(compatibleQuery);

if(worker.includes(legacyQuery)) throw new Error('Consulta /api/releases ainda exige gmud.project em schema legado.');
if(!worker.includes(compatibleQuery)) throw new Error('Consulta GMUD compatível não encontrada em /api/releases.');
if(!worker.includes('INSERT INTO gmud (id,title,company_id,project,')) throw new Error('Cadastro de GMUD perdeu a associação com projeto.');
if(!worker.includes("stageEnsureColumn('gmud', 'project'")) throw new Error('Bootstrap de Stage não garante gmud.project.');

fs.writeFileSync(workerFile,worker);
console.log('OK: /api/releases tolera schema GMUD legado e Stage evolui gmud.project sem perda de dados.');
