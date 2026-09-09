import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const worker=read('public/_worker.js');
const index=read('public/index.html');
const api=read('src/work-import-api.js');
const ui=read('src/work-import-ui.js');
const hardener=read('scripts/harden-work-import.mjs');
const mutationHardener=read('scripts/harden-no-login-mutation-safety.mjs');
const mutationValidator=read('scripts/validate-no-login-mutation-safety.mjs');
const must=(haystack,needle,label)=>{if(!haystack.includes(needle))throw new Error(`Ausente ${label}: ${needle}`)};

for(const [needle,label] of [
  ["path==='work-items/import'",'rota de importação'],
  ["if(!wmWrite)",'RBAC do Work Management'],
  ['Limite de 500 linhas por importação','limite de lote'],
  ['source_name','origem da importação'],
  ['dry_run','pré-validação sem escrita'],
  ['excel-import:','token estável de deduplicação'],
  ['duplicates','contagem de duplicados'],
  ["await wmEvent(item,'imported'",'auditoria via Work Events'],
  ["work-items:importar",'auditoria de lote']
])must(api,needle,label);
if(/\b(?:DELETE|DROP|TRUNCATE)\b/i.test(api))throw new Error('API de importação não pode conter operação destrutiva.');

for(const [needle,label] of [
  ['Importar Excel','botão do importador'],
  ['Colar conteúdo do Excel','fluxo de copiar/colar'],
  ['Mapeamento de colunas','mapeamento flexível'],
  ["title:['demanda','tarefa','atividade'",'aliases de demanda'],
  ["start_date:['entrada'",'alias Entrada'],
  ["due_date:['saida'",'alias Saída'],
  ["owner:['responsavel','desenvolvedor'",'alias Responsável/Desenvolvedor'],
  ["dry_run:true",'validação antes da importação'],
  ["work-items/import",'chamada da API em lote'],
  ['duplicadas ignoradas','feedback de deduplicação']
])must(ui,needle,label);

for(const [needle,label] of [
  ['BEGIN ALLAMO WORK IMPORT API','API materializada no Worker'],
  ['END ALLAMO WORK IMPORT API','fim da API materializada'],
  ['BEGIN ALLAMO WORK IMPORT UI','UI materializada no portal'],
  ['END ALLAMO WORK IMPORT UI','fim da UI materializada']
])must(worker+index,needle,label);

must(hardener,"src/work-import-api.js",'fonte API no hardener');
must(hardener,"src/work-import-ui.js",'fonte UI no hardener');
must(mutationHardener,"await import('./harden-work-import.mjs')",'importador encadeado no build oficial');
must(mutationValidator,"await import('./validate-work-import.mjs')",'validador encadeado ao gate de mutações');

console.log('OK: importador Excel→Work Management possui mapeamento flexível, prévia/dry-run, RBAC, auditoria e deduplicação sem schema ou seed automático.');
