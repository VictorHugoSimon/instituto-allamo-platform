import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const worker=read('public/_worker.js');
const index=read('public/index.html');
const api=read('src/work-import-api.js');
const ui=read('src/work-import-ui.js');
const hardener=read('scripts/harden-work-import.mjs');
const fileUploadHardener=read('scripts/harden-work-import-file-upload.mjs');
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
  ['END ALLAMO WORK IMPORT UI','fim da UI materializada'],
  ['allamoWorkNoLoginHost','Work Management sem login nos hosts oficiais'],
  ['allamoWorkImportNoLoginHost','importador sem login nos hosts oficiais'],
  ['awm-import-excel','botão Importar Excel materializado'],
  ['allamoImportReady','botão do importador religado após render'],
  ['setInterval(ensureButton,1200)','fallback de renderização do botão'],
  ['// [allamo-work-import-file-upload]','upload direto de arquivo materializado'],
  ['data-allamo-work-file-upload="1"','área visual de seleção de arquivo'],
  ['accept=".xlsx,.xls,.csv,.tsv','formatos de arquivo aceitos'],
  ['xlsx-0.20.3/package/dist/xlsx.full.min.js','SheetJS fixado em versão segura'],
  ['sheet_to_json','leitura das abas do workbook'],
  ['O arquivo é lido no navegador','privacidade do upload'],
  ['O limite atual é 500 por importação','limite de arquivo alinhado ao backend'],
  ["src.value=f.name",'nome do arquivo usado como origem']
])must(worker+index,needle,label);

if(index.includes("const t=T();if(!t)throw new Error('Sessão não encontrada. Entre novamente no portal.')"))throw new Error('Work Management ainda exige token local no host oficial.');
if(index.includes("const t=token();if(!t)throw new Error('Sessão não encontrada. Entre novamente no portal.')"))throw new Error('Importador Excel ainda exige token local no host oficial.');
if(index.includes('xlsx-latest')||index.includes('xlsx-0.20.1')||index.includes('xlsx-0.18.5'))throw new Error('Leitor XLSX não pode usar versão flutuante ou versão conhecida vulnerável.');

must(hardener,"src/work-import-api.js",'fonte API no hardener');
must(hardener,"src/work-import-ui.js",'fonte UI no hardener');
must(hardener,'allamoWorkNoLoginHost','hardening sem login do Work Management');
must(hardener,'allamoWorkImportNoLoginHost','hardening sem login do importador');
must(hardener,"await import('./harden-work-import-file-upload.mjs')",'upload de arquivo encadeado no build do importador');
must(fileUploadHardener,'10*1024*1024','limite de 10 MB no navegador');
must(fileUploadHardener,"ext!=='xlsx'&&ext!=='xls'",'gate conjunto para formatos XLSX/XLS');
must(fileUploadHardener,"ext==='csv'||ext==='tsv'",'leitura CSV/TSV local');
must(fileUploadHardener,"XLSX.read(data,{type:'array',cellDates:true})",'parsing local do workbook XLSX/XLS');
must(fileUploadHardener,"m.querySelector('#wia').click()",'arquivo reutiliza análise/mapeamento existente');
if(fileUploadHardener.includes("api('work-items/import'"))throw new Error('Leitura do arquivo não pode importar diretamente; deve passar pela validação/prévia existente.');
must(mutationHardener,"await import('./harden-work-import.mjs')",'importador encadeado no build oficial');
must(mutationValidator,"await import('./validate-work-import.mjs')",'validador encadeado ao gate de mutações');

console.log('OK: Work Management + importador Excel aceitam colar ou selecionar .xlsx/.xls/.csv/.tsv, com leitura local, mapeamento flexível, dry-run, RBAC, auditoria, deduplicação e limites seguros.');
