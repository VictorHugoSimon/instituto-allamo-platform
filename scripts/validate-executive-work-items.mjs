import fs from 'node:fs';
const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente ${label}: ${needle}`)};
for(const [needle,label] of [
  ["this.api('work-items'+qs)",'carga de work_items com filtro de empresa'],
  ['this.workItems = Array.isArray(workItems)','coleção Work Management no dashboard'],
  ["{label:'Demandas', value:String((this.workItems||[])",'KPI Demandas baseado em work_items'],
  ["i.status==='EM ANDAMENTO'",'KPI Em andamento'],
  ["i.status==='BACKLOG'",'KPI Backlog'],
  ["i.status==='CONCLUÍDO'",'KPI Concluído'],
  ["i.status==='CANCELADO'",'KPI Cancelado'],
  ['BEGIN ALLAMO EXECUTIVE WORK ITEMS RUNTIME','runtime de gráficos'],
  ["STATUSES=['BACKLOG','A FAZER','EM ANDAMENTO','CODE REVIEW','QA','HOMOLOGAÇÃO','CONCLUÍDO','CANCELADO']",'todos os status do Work Management'],
  ["norm(o.textContent)==='todas empresas'",'filtro Todas as empresas'],
  ["installChart(['Distribuição por status','Distribuição do portfólio']",'distribuição por status'],
  ["installChart(['Demandas por projeto']",'demandas por projeto'],
  ["estimate_hours",'capacidade baseada em horas estimadas'],
  ['Horas estimadas não informadas','ausência de capacidade sem KPI inventado']
])must(needle,label);
if(html.includes("{label:'Demandas', value:String((this.issues||[])"))throw new Error('KPI Demandas ainda depende de issues legadas.');
if(!html.includes("st.company==='all'"))throw new Error('Semântica de Todas as empresas ausente no portal.');
console.log('OK: Visão Executiva usa Work Management para demandas/tarefas, respeita Todas as empresas e cobre todos os status sem dados fictícios.');
