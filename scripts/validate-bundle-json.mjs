import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');

function parseScript(type){
  const open=`<script type="${type}">`;
  const a=html.indexOf(open);
  if(a<0) throw new Error(`Script ${type} não encontrado.`);
  const start=a+open.length;
  const end=html.indexOf('</script>',start);
  if(end<0) throw new Error(`Fechamento de ${type} não encontrado.`);
  const raw=html.slice(start,end);
  try{return JSON.parse(raw)}
  catch(err){throw new Error(`${type} contém JSON inválido: ${String(err&&err.message||err)}`)}
}

const manifest=parseScript('__bundler/manifest');
const template=parseScript('__bundler/template');
const pageOrder=parseScript('__bundler/page_order');
const extResources=parseScript('__bundler/ext_resources');

if(!manifest || typeof manifest!=='object' || Array.isArray(manifest)) throw new Error('Manifesto do bundler inválido.');
if(typeof template!=='string' || !template.includes('class Component extends DCLogic')) throw new Error('Template principal do portal inválido.');
if(!Array.isArray(pageOrder)) throw new Error('page_order do bundler inválido.');
if(!Array.isArray(extResources)) throw new Error('ext_resources do bundler inválido.');
if(!template.includes("this.api('session-status').then")) throw new Error('Template serializado perdeu a validação dedicada de sessão.');

console.log('OK: todos os blocos JSON do bundle são parseáveis e o template principal está íntegro.');
