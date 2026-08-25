import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('src/report-ai-launcher-runtime.js');
const hardener=read('scripts/harden-report-ai-launcher.mjs');
const html=read('public/index.html');
const pkg=JSON.parse(read('package.json'));
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(runtime,"#ard-panel [data-act=\"ai\"]",'captura direta do botão IA');
must(runtime,"window.addEventListener('click'",'listener de clique no window/capture');
must(runtime,'e.stopImmediatePropagation()','bloqueio do fallback legado após captura');
must(runtime,'Assistente IA do Status Report','modal abre imediatamente com identidade própria');
must(runtime,'id="meeting"','campo principal de reunião');
must(runtime,'Analisar reunião e gerar rascunho','CTA de geração');
must(runtime,"api('report-ai/status')",'validação assíncrona do provedor');
must(runtime,"api('report-ai?'+q",'geração pelo backend governado');
must(runtime,"api('report?'+q)",'leitura do Report no escopo selecionado');
must(runtime,'sessionStorage.setItem(draftKey','preservação temporária do texto digitado');
must(runtime,"window.__allamoOpenReportAi=open",'ponte pública de fallback');
must(runtime,'GOVERNANÇA: o Report só é gravado','regra explícita de aprovação humana');
must(runtime,"out.querySelector('#apply').onclick=()=>applyApproved",'salvamento ligado ao clique explícito de aprovação');
must(runtime,"api('report?'+q,{method:'POST'",'nova versão salva somente no método aprovado');
must(runtime,"api('report-ai/mark-applied'",'auditoria de aplicação da IA');

must(hardener,'END ALLAMO WORK MANAGEMENT UI','launcher segue runtime externo pós-unpack');
must(hardener,'BEGIN ALLAMO REPORT AI LAUNCHER RUNTIME','runtime possui marcador idempotente');
must(hardener,'data-allamo-report-ai-launcher','script do launcher é identificável');

must(html,'window.__allamoOpenReportAi','launcher presente no artefato final');
must(html,'Assistente IA do Status Report','modal presente no artefato final');
must(html,'data-allamo-report-ai-launcher','runtime injetado no artefato final');
must(html,'GOVERNANÇA: o Report só é gravado','governança presente no artefato final');

if(!String(pkg.scripts['build:work']||'').includes('harden-report-ai-launcher.mjs'))throw new Error('build:work não instala o launcher do Assistente IA.');
if(!String(pkg.scripts['test:report-ai']||'').includes('validate-report-ai-launcher.mjs'))throw new Error('test:report-ai não valida o launcher do Assistente IA.');

// A geração pode chamar /api/report-ai, mas jamais pode gravar /api/report antes de
// o usuário clicar em Aplicar. Fazemos a checagem diretamente no corpo de generateDraft.
const gs=runtime.indexOf('async function generateDraft');
const ge=runtime.indexOf('// GOVERNANÇA:',gs);
if(gs<0||ge<0)throw new Error('Não foi possível isolar o fluxo de geração da IA.');
const generation=runtime.slice(gs,ge);
if(generation.includes("api('report?'+q,{method:'POST'"))throw new Error('A geração está gravando o Report antes da aprovação do PMO.');

const as=runtime.indexOf('async function applyApproved');
if(as<0)throw new Error('Fluxo explícito de aplicação não encontrado.');
const approval=runtime.slice(as);
if(!approval.includes("api('report?'+q,{method:'POST'"))throw new Error('Fluxo aprovado não salva nova versão do Report.');

console.log('OK: Assistente IA abre imediatamente, preserva reunião, gera rascunho e só grava nova versão após aprovação explícita do PMO.');
