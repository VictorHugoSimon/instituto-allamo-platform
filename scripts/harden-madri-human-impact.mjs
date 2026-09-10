import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/madri-human-impact-api.js';
const pageFile='public/madri-impacto-humano/index.html';
const START='    // BEGIN MADRI HUMAN IMPACT API';
const END='    // END MADRI HUMAN IMPACT API';
const PRIVATE_END='    // END MADRI PMO PRIVATE API';

if(!fs.existsSync(workerFile)||!fs.existsSync(apiFile)||!fs.existsSync(pageFile))throw new Error('Worker, API ou página de Impacto Humano MADRI ausente.');
let worker=fs.readFileSync(workerFile,'utf8');
const api=fs.readFileSync(apiFile,'utf8').trim();

const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const stripBlock=text=>text.replace(new RegExp(`^[\\t ]*${esc(START.trim())}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${esc(END.trim())}[\\t ]*(?:\\r?\\n)?`,'gm'),'');
worker=stripBlock(worker);

const privateEnds=(worker.match(new RegExp(`^[\\t ]*${esc(PRIVATE_END.trim())}[\\t ]*$`,'gm'))||[]).length;
if(privateEnds!==1)throw new Error(`Bloco privado MADRI inconsistente: esperado 1 marcador final, encontrado ${privateEnds}.`);
const block=`${START}\n${api.split('\n').map(x=>'    '+x).join('\n')}\n${END}\n`;
worker=worker.replace(PRIVATE_END,block+PRIVATE_END);

const starts=(worker.match(new RegExp(`^[\\t ]*${esc(START.trim())}[\\t ]*$`,'gm'))||[]).length;
const ends=(worker.match(new RegExp(`^[\\t ]*${esc(END.trim())}[\\t ]*$`,'gm'))||[]).length;
const routes=(worker.match(/path==='madri-platform\/human-impact'/g)||[]).length;
if(starts!==1||ends!==1)throw new Error(`Impacto Humano MADRI deve existir uma única vez no Worker (begin=${starts}, end=${ends}).`);
if(routes<2)throw new Error(`Contrato da API Impacto Humano MADRI incompleto: rotas-base encontradas=${routes}.`);

// A fonte v0.2 possui o nível "Muito alta". Materializamos a opção no artefato
// sem reescrever a avaliação existente ao editar um registro já persistido.
let page=fs.readFileSync(pageFile,'utf8');
const oldManuality="['Alta','Média','Baixa','A confirmar']";
const canonicalManuality="['Muito alta','Alta','Média','Baixa','A confirmar']";
if(page.includes(oldManuality))page=page.replace(oldManuality,canonicalManuality);
if(!page.includes(canonicalManuality))throw new Error('Página do Impacto Humano não contém a escala canônica de manualidade com "Muito alta".');

fs.writeFileSync(workerFile,worker);
fs.writeFileSync(pageFile,page);
console.log('OK: API do Mapa de Impacto Humano MADRI e escala de manualidade canônica materializadas de forma idempotente.');
