import fs from 'node:fs';

const file='public/index.html';
const runtimeFile='src/report-direct-link-runtime.js';
let html=fs.readFileSync(file,'utf8');
const runtime=fs.readFileSync(runtimeFile,'utf8');

// O hardener roda depois do modo oficial sem login. Troca somente a API interna
// do criador oficial por uma versão com timeout. GET pode falhar rápido; POST
// nunca é repetido automaticamente para impedir Report duplicado.
const marker='const allamoNoLoginCreateHost=';
const markerAt=html.indexOf(marker);
if(markerAt<0) throw new Error('API oficial de criação de Report não encontrada.');
const apiStart=html.indexOf('const api=async(p,o={})=>{',markerAt);
if(apiStart<0||apiStart-markerAt>2500) throw new Error('Função api do criador oficial não encontrada.');
const apiEndToken='return d};';
const apiEnd=html.indexOf(apiEndToken,apiStart);
if(apiEnd<0||apiEnd-apiStart>3500) throw new Error('Fim da API do criador oficial não encontrado.');
const oldApi=html.slice(apiStart,apiEnd+apiEndToken.length);

const resilientApi=`const api=async(p,o={})=>{const noLogin=allamoNoLoginCreateHost();const t=noLogin?'':token();if(!t&&!noLogin)throw new Error('Sessão não encontrada');const headers={'content-type':'application/json',...(o.headers||{})};if(t)headers.authorization='Bearer '+t;const method=String(o.method||'GET').toUpperCase();const timeoutMs=method==='POST'?20000:10000;const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeoutMs);try{const r=await fetch('/api/'+p,{...o,headers,cache:'no-store',credentials:'same-origin',signal:ctrl.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d}catch(err){if(err&&err.name==='AbortError'){if(method==='POST')throw new Error('A criação do Report excedeu 20 segundos. Confira a lista antes de tentar novamente para evitar duplicidade.');throw new Error('A atualização de empresas/projetos excedeu 10 segundos. Tente novamente.')}throw err}finally{clearTimeout(timer)}};`;

if(!oldApi.includes('AbortController')) html=html.slice(0,apiStart)+resilientApi+html.slice(apiEnd+apiEndToken.length);

// Runtime: gera link determinístico Empresa + Projeto + ID do Report e oferece
// copiar/abrir em toda edição. Não cria coluna; o ID já é único e imutável.
const begin='<!-- BEGIN ALLAMO REPORT DIRECT LINK -->';
const end='<!-- END ALLAMO REPORT DIRECT LINK -->';
const block=`${begin}\n<script>\n${runtime}\n<\\/script>\n${end}`;
if(html.includes(begin)){
  const a=html.indexOf(begin),b=html.indexOf(end,a);
  if(b<0) throw new Error('Marcador final do link direto ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const pos=html.lastIndexOf('</body>');
  if(pos<0) throw new Error('Fechamento do body não encontrado para link direto.');
  html=html.slice(0,pos)+block+'\n'+html.slice(pos);
}

if(!html.includes("searchParams.set('report',String(r.id))")) throw new Error('Link exclusivo por Report não foi injetado.');
if(!html.includes('A criação do Report excedeu 20 segundos')) throw new Error('Timeout do POST de Report não aplicado.');
if(!html.includes('A atualização de empresas/projetos excedeu 10 segundos')) throw new Error('Timeout de carga do criador não aplicado.');
if(!html.includes('POST nunca é repetido automaticamente')) throw new Error('Contrato de não repetição do POST ausente.');

fs.writeFileSync(file,html);
console.log('OK: criação de Report possui timeout seguro e cada Report recebe link exclusivo Empresa/Projeto/Report.');
