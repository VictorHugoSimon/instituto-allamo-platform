import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
const marker='data-report-central-warning';
if(html.includes(marker)){
  console.log('OK: Central de Reports já está resiliente a falhas parciais.');
  process.exit(0);
}

const oldLoad="async function load(){const [cs,ps,rs,ws]=await Promise.all([api('companies'),api('projects'),api('report-records'),api('work-items')]);R.companies=Array.isArray(cs)?cs:[];R.projects=Array.isArray(ps)?ps:[];R.reports=Array.isArray(rs)?rs:[];R.work=Array.isArray(ws)?ws:[];if(R.selected){try{R.selected=await api('report-records/'+encodeURIComponent(R.selected.id))}catch(_){R.selected=null;R.view='list'}}render()}";
const newLoad="async function load(){const labels=['Empresas','Projetos','Reports','Trabalho'];const settled=await Promise.allSettled([api('companies'),api('projects'),api('report-records'),api('work-items')]);const val=i=>settled[i].status==='fulfilled'?settled[i].value:[];const cs=val(0),ps=val(1),rs=val(2),ws=val(3);R.companies=Array.isArray(cs)?cs:[];R.projects=Array.isArray(ps)?ps:[];R.reports=Array.isArray(rs)?rs:[];R.work=Array.isArray(ws)?ws:[];if(R.selected){try{R.selected=await api('report-records/'+encodeURIComponent(R.selected.id))}catch(_){R.selected=null;R.view='list'}}render();const failed=settled.map((x,i)=>x.status==='rejected'?labels[i]:'').filter(Boolean);if(failed.length){const root=body();if(root){const w=document.createElement('div');w.className='err';w.setAttribute('data-report-central-warning','1');w.innerHTML='<b>Conectividade parcial.</b> '+failed.join(', ')+' não responderam após as tentativas automáticas. Os dados disponíveis foram mantidos; use <b>Atualizar</b> para tentar novamente.';root.prepend(w)}}}";

if(!html.includes(oldLoad)) throw new Error('Função load() da Central de Reports não encontrada no artefato final; patch abortado para evitar alteração insegura.');
html=html.replace(oldLoad,newLoad);
fs.writeFileSync(file,html);
console.log('OK: Central de Reports carrega fontes de forma independente e mantém dados disponíveis quando uma API falha.');
