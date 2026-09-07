const base=(process.env.ALLAMO_PRODUCTION_URL||'https://allamo-pmo.pages.dev').replace(/\/$/,'');
const token=String(process.env.ALLAMO_PMO_SMOKE_TOKEN||'').trim();
if(!token)throw new Error('ALLAMO_PMO_SMOKE_TOKEN não informado.');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const must=(condition,message)=>{if(!condition)throw new Error(message)};

async function request(path,{json=false,auth=false}={}){
  let last;
  for(let attempt=1;attempt<=6;attempt++){
    try{
      const headers={'cache-control':'no-store'};
      if(auth)headers.authorization='Bearer '+token;
      const response=await fetch(base+path,{headers,redirect:'follow'});
      const body=json?await response.json().catch(()=>null):await response.text();
      if(response.ok)return {response,body};
      const detail=json&&body&&typeof body==='object'?body.error||JSON.stringify(body):String(body||'').slice(0,180);
      last=new Error(`${path}: HTTP ${response.status}${detail?' · '+detail:''}`);
    }catch(error){last=error}
    if(attempt<6)await sleep(3000);
  }
  throw last||new Error(`Falha desconhecida em ${path}`);
}

const portal=await request('/');
must(/text\/html/i.test(portal.response.headers.get('content-type')||''),'Portal principal não retornou HTML.');
const navStart='<!-- BEGIN ALLAMO PMO COCKPIT NAVIGATION -->';
const navEnd='<!-- END ALLAMO PMO COCKPIT NAVIGATION -->';
const navStarts=portal.body.split(navStart).length-1;
const navEnds=portal.body.split(navEnd).length-1;
must(navStarts===1&&navEnds===1,`Navegação do Cockpit deveria estar materializada uma única vez no portal publicado; início=${navStarts}, fim=${navEnds}.`);
must(portal.body.includes("link.href='/pmo-cockpit/'"),'Portal publicado não contém a rota canônica /pmo-cockpit/.');
must(portal.body.includes('Cockpit Executivo'),'Portal publicado não contém o rótulo Cockpit Executivo.');
must(portal.body.includes("norm(button.textContent)==='visao executiva'"),'Portal publicado não ancora o Cockpit após Visão Executiva.');
console.log('OK navegação publicada: bloco único do Cockpit Executivo presente no portal principal de PRODUÇÃO.');

const page=await request('/pmo-cockpit/');
must(/text\/html/i.test(page.response.headers.get('content-type')||''),'Cockpit não retornou HTML.');
for(const marker of ['Cockpit Executivo 2.0','/api/pmo-cockpit','/api/dash-curve','sem KPI fictício','/pmo-cockpit/operational-blocks.js']){
  must(page.body.includes(marker),`Página publicada sem marcador obrigatório: ${marker}`);
}
console.log('OK página: /pmo-cockpit/ publicada com contratos PMO e extensão operacional.');

const operational=await request('/pmo-cockpit/operational-blocks.js');
must(/javascript|text\/plain/i.test(operational.response.headers.get('content-type')||''),'Extensão operacional não foi servida como JavaScript/texto.');
for(const marker of ['Gestão e riscos','Capacidade e horas','Governança','Adoção e telemetria','Riscos críticos estruturados','Utilização por profissional','Mapa de calor','Não disponível']){
  must(operational.body.includes(marker),`Extensão operacional publicada sem marcador: ${marker}`);
}
console.log('OK UI operacional: quatro blocos publicados sem KPI fictício.');

const cockpit=(await request('/api/pmo-cockpit',{json:true,auth:true})).body;
must(cockpit&&typeof cockpit==='object','API do Cockpit não retornou objeto JSON.');
must(cockpit.source==='D1','API do Cockpit não está declarando D1 como fonte real.');
must(Number.isFinite(Date.parse(cockpit.generated_at)),'generated_at inválido.');
must(cockpit.portfolio&&typeof cockpit.portfolio==='object','portfolio ausente.');
must(cockpit.health&&typeof cockpit.health==='object','health ausente.');
must(cockpit.management&&typeof cockpit.management==='object','management ausente.');
must(cockpit.capacity&&typeof cockpit.capacity==='object','capacity ausente.');
must(cockpit.governance&&typeof cockpit.governance==='object','governance ausente.');
must(cockpit.adoption&&typeof cockpit.adoption==='object','adoption ausente.');
must(cockpit.sources&&typeof cockpit.sources==='object','sources ausente.');
must(Array.isArray(cockpit.projects),'projects precisa ser array.');

const portfolioKeys=['companies','projects','active','in_progress','backlog','completed','cancelled','delayed','at_risk'];
for(const key of portfolioKeys){
  must(Number.isInteger(cockpit.portfolio[key])&&cockpit.portfolio[key]>=0,`portfolio.${key} inválido.`);
}
const healthKeys=['green','yellow','red','stale','not_applicable'];
for(const key of healthKeys){
  must(Number.isInteger(cockpit.health[key])&&cockpit.health[key]>=0,`health.${key} inválido.`);
}
must(cockpit.portfolio.projects===cockpit.projects.length,'Total de projetos diverge do drill-down retornado.');
must(healthKeys.reduce((sum,key)=>sum+cockpit.health[key],0)===cockpit.projects.length,'Total por saúde diverge do total de projetos.');
for(const project of cockpit.projects){
  must(project&&project.id!=null,'Projeto sem id no drill-down.');
  must(typeof project.delayed==='boolean',`Projeto ${project.id} sem delayed booleano.`);
  must(healthKeys.includes(project.health),`Projeto ${project.id} com saúde inválida: ${project.health}`);
}

const checkMetric=(m,label)=>{
  must(m&&typeof m==='object',`${label} não é objeto de métrica.`);
  must(typeof m.available==='boolean',`${label}.available inválido.`);
  if(m.available)must(m.value!==null&&m.value!==undefined,`${label} disponível sem valor.`);
  else{
    must(m.value===null,`${label} indisponível deve preservar value=null.`);
    must(String(m.reason||'').trim()!=='',`${label} indisponível sem justificativa.`);
  }
};

for(const key of ['blocked_items','overdue_actions','dependencies','open_decisions','critical_projects','structured_critical_risks'])checkMetric(cockpit.management[key],`management.${key}`);
for(const key of ['planned_hours','sprint_capacity_hours','actual_hours','people_with_actual_hours','utilization'])checkMetric(cockpit.capacity[key],`capacity.${key}`);
for(const key of ['latest_report_at','projects_without_report','report_freshness_policy','dor_documents','dod_documents','critical_pending'])checkMetric(cockpit.governance[key],`governance.${key}`);
for(const key of ['heatmap','work_management_events','last_work_management_event_at'])checkMetric(cockpit.adoption[key],`adoption.${key}`);

must(cockpit.management.structured_critical_risks.available===false,'Risco estruturado não pode ser marcado disponível sem fonte genérica confiável.');
must(cockpit.capacity.utilization.available===false,'Utilização não pode ser calculada sem denominador individual confiável.');
must(String(cockpit.capacity.no_double_count_rule||'').includes('source_entry_hash'),'Regra de deduplicação FCH por source_entry_hash ausente.');
must(cockpit.governance.report_freshness_policy.available===false,'SLA de Status Report não pode ser inventado sem política configurada.');
must(cockpit.adoption.heatmap.available===false,'Mapa de calor não pode ser marcado disponível antes da telemetria global.');
must(cockpit.governance.next_rites&&typeof cockpit.governance.next_rites.available==='boolean','governance.next_rites inválido.');
if(cockpit.governance.next_rites.available)must(Array.isArray(cockpit.governance.next_rites.items),'governance.next_rites.items precisa ser array.');

if(cockpit.portfolio.projects===0){
  must(cockpit.portfolio.companies===0,'Baseline PRODUÇÃO esperado em 0 empresas / 0 projetos.');
  for(const key of ['active','in_progress','backlog','completed','cancelled','delayed','at_risk'])must(cockpit.portfolio[key]===0,`Estado vazio inconsistente em portfolio.${key}.`);
  must(healthKeys.every(key=>cockpit.health[key]===0),'Estado vazio inconsistente na saúde.');
  for(const key of ['blocked_items','overdue_actions','dependencies','open_decisions','critical_projects']){
    must(cockpit.management[key].available===true&&Number(cockpit.management[key].value)===0,`Baseline vazio inconsistente em management.${key}.`);
  }
  for(const key of ['planned_hours','sprint_capacity_hours','actual_hours','people_with_actual_hours']){
    must(cockpit.capacity[key].available===true&&Number(cockpit.capacity[key].value)===0,`Baseline vazio inconsistente em capacity.${key}.`);
  }
  must(cockpit.governance.projects_without_report.available===true&&Number(cockpit.governance.projects_without_report.value)===0,'Baseline vazio inconsistente em governance.projects_without_report.');
  for(const key of ['dor_documents','dod_documents','critical_pending'])must(cockpit.governance[key].available===true&&Number(cockpit.governance[key].value)===0,`Baseline vazio inconsistente em governance.${key}.`);
  must(cockpit.adoption.work_management_events.available===true&&Number(cockpit.adoption.work_management_events.value)===0,'Baseline vazio inconsistente em adoption.work_management_events.');
  console.log('OK estado vazio: Cockpit não fabricou empresas, projetos, horas, governança ou adoção.');
}
console.log(`OK API Cockpit: ${cockpit.portfolio.companies} empresa(s), ${cockpit.portfolio.projects} projeto(s), ${cockpit.portfolio.delayed} atrasado(s), ${cockpit.portfolio.at_risk} em risco.`);

const curve=(await request('/api/dash-curve',{json:true,auth:true})).body;
must(curve&&typeof curve==='object','Curva S não retornou objeto JSON.');
must(Array.isArray(curve.months)&&Array.isArray(curve.prev)&&Array.isArray(curve.real),'Curva S sem arrays months/prev/real.');
must(curve.months.length===curve.prev.length&&curve.months.length===curve.real.length,'Curva S com arrays de tamanhos divergentes.');
must(curve.byCompany&&typeof curve.byCompany==='object'&&!Array.isArray(curve.byCompany),'Curva S sem byCompany válido.');
for(let i=0;i<curve.months.length;i++){
  must(String(curve.months[i]??'').trim()!=='',`Curva S com mês vazio no índice ${i}.`);
  must(Number.isFinite(Number(curve.prev[i])),`Curva S planejada inválida no índice ${i}.`);
  must(curve.real[i]===null||Number.isFinite(Number(curve.real[i])),`Curva S realizada inválida no índice ${i}.`);
}
console.log(`OK Curva S: ${curve.months.length} período(s) consolidado(s); ausência de realizado é preservada como null.`);
console.log('OK: smoke runtime reforçado do Cockpit Executivo PMO em PRODUÇÃO concluído.');
