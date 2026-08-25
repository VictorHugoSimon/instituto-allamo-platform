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
must(runtime,'Assistente IA do Status Report','modal abre com identidade própria');
must(runtime,'id="meeting"','campo principal de reunião');
must(runtime,'Analisar reunião e gerar rascunho','CTA de geração');
must(runtime,"api('report-ai/status')",'validação assíncrona do provedor');
must(runtime,'window.__allamoLegacyReportAiGenerate','reuso da geração/aprovação já governada');
must(runtime,'sessionStorage.setItem(draftKey','preservação temporária do texto digitado');
must(runtime,"window.__allamoOpenReportAi=open",'ponte pública de fallback');

must(hardener,'JSON.parse(html.slice(start,end))','hardener trabalha no template decodificado');
must(hardener,'window.__allamoLegacyReportAiSetQuery','ponte para escopo empresa/projeto');
must(hardener,'BEGIN ALLAMO REPORT AI LAUNCHER RUNTIME','runtime possui marcador idempotente');
must(hardener,"JSON.stringify(template).replace(/<\\//gi,'<\\\\u002F')",'serialização segura');

must(html,'window.__allamoLegacyReportAiGenerate','ponte presente no artefato final');
must(html,'window.__allamoOpenReportAi','launcher presente no artefato final');
must(html,'Assistente IA do Status Report','modal presente no artefato final');
must(html,'data-allamo-report-ai-launcher','runtime injetado no artefato final');

if(!String(pkg.scripts['build:work']||'').includes('harden-report-ai-launcher.mjs'))throw new Error('build:work não instala o launcher do Assistente IA.');
if(!String(pkg.scripts['test:report-ai']||'').includes('validate-report-ai-launcher.mjs'))throw new Error('test:report-ai não valida o launcher do Assistente IA.');

// O launcher só abre/coleta entrada e delega à implementação governada. Não pode
// salvar automaticamente o Report fora do fluxo de aprovação já existente.
if(runtime.includes("fetch('/api/report'" )||runtime.includes("api('report?'"))throw new Error('Launcher não pode salvar Report diretamente.');

console.log('OK: Assistente IA abre imediatamente, mantém texto, identifica escopo e delega geração/aprovação sem gravação automática.');
