import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};

must('allamoNoLoginReportHost','Central de Reports reconhece host oficial sem login');
must('allamoNoLoginAdminHost','Navegação de Reports reconhece host oficial sem login');
must('allamoNoLoginAiHost','Assistente IA reconhece host oficial sem login');
must('allamoNoLoginCreateHost','Criação oficial de Report reconhece host oficial sem login');
must('allamo-report-create-delegated','Clique de Novo Report tem autoridade única');
must('falha ao abrir template oficial','Central delega Novo Report ao template executivo oficial');
must('window.AllamoOfficialReportCreate','Runtime oficial de criação permanece exposto');
must('data-allamo-report-ai-launcher','Launcher IA permanece presente no artefato final');
must("api('report-ai/status')",'Assistente IA continua validando o provedor');
must('allamo-no-login-profile-cleaner','Cleaner do perfil no cabeçalho');
must('data-allamo-hidden-profile','Marca de remoção do perfil');
must('data-allamo-hidden-avatar','Marca de remoção do avatar');
must('data-allamo-hidden-auth-ui','Marca de remoção do botão Sair');

const oldReport="const api=async(p,o={})=>{const t=tok();if(!t)throw new Error('Sessão não encontrada')";
const oldNav="const api=async p=>{const t=token();if(!t)return []";
const oldAi="if(!t)throw new Error('Sua sessão não foi encontrada. Entre novamente no portal.')";
const oldCreate="const api=async(p,o={})=>{const t=token();if(!t)throw new Error('Sessão não encontrada');const r=await fetch('/api/'+p,{...o,headers:{'content-type':'application/json','authorization':'Bearer '+t";
const oldCapture="document.addEventListener('click',e=>{const b=e.target.closest('#arm [data-a=\"new-report\"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open()},true);";
const oldGeneric="if(t.dataset.a==='new-report'){reportForm();return}";
if(html.includes(oldReport))throw new Error('Central de Reports ainda depende de allamo_session.');
if(html.includes(oldNav))throw new Error('Navegação de Reports ainda aborta sem token.');
if(html.includes(oldAi))throw new Error('Assistente IA ainda bloqueia os hosts oficiais por ausência de allamo_session.');
if(html.includes(oldCreate))throw new Error('Fluxo + Novo report ainda bloqueia os hosts oficiais por ausência de allamo_session.');
if(html.includes(oldCapture))throw new Error('Novo Report ainda possui listener concorrente de captura.');
if(html.includes(oldGeneric))throw new Error('Central ainda abre o formulário legado em vez do template oficial.');

console.log('OK: Reports, Novo Report no template oficial e Assistente IA operam no modo oficial; nome/avatar/cargo não aparecem no cabeçalho.');
