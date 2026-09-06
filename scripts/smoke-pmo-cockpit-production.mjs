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

const page=await request('/pmo-cockpit/');
must(/text\/html/i.test(page.response.headers.get('content-type')||''),'Cockpit não retornou HTML.');
for(const marker of ['Cockpit Executivo 2.0','/api/pmo-cockpit','/api/dash-curve','sem KPI fictício']){
  must(page.body.includes(marker),`Página publicada sem marcador obrigatório: ${marker}`);
}
console.log('OK página PROD: /pmo-cockpit/ publicada com contratos PMO esperados.');

const cockpit=(await request('/api/pmo-cockpit',{json:true,auth:true})).body;
must(cockpit&&typeof cockpit==='object','API do Cockpit não retornou objeto JSON.');
must(cockpit.source==='D1','API do Cockpit não declara D1 como fonte real.');
must(Number.isFinite(Date.parse(cockpit.generated_at)),'generated_at inválido.');
must(cockpit.portfolio&&typeof cockpit.portfolio==='object','portfolio ausente.');
must(cockpit.health&&typeof cockpit.health==='object','health ausente.');
must(Array.isArray(cockpit.projects),'projects precisa ser array.');

const portfolioKeys=['companies','projects','active','in_progress','backlog','completed','cancelled','delayed','at_risk'];
for(const key of portfolioKeys)must(Number.isInteger(cockpit.portfolio[key])&&cockpit.portfolio[key]>=0,`portfolio.${key} inválido.`);
const healthKeys=['green','yellow','red','stale','not_applicable'];
for(const key of healthKeys)must(Number.isInteger(cockpit.health[key])&&cockpit.health[key]>=0,`health.${key} inválido.`);

must(cockpit.portfolio.companies===0,`Produção deveria estar com 0 empresas; retornou ${cockpit.portfolio.companies}.`);
must(cockpit.portfolio.projects===0,`Produção deveria estar com 0 projetos; retornou ${cockpit.portfolio.projects}.`);
must(cockpit.projects.length===0,'Drill-down retornou projetos no estado zero.');
for(const key of ['active','in_progress','backlog','completed','cancelled','delayed','at_risk'])must(cockpit.portfolio[key]===0,`Estado zero inconsistente em portfolio.${key}.`);
must(healthKeys.every(key=>cockpit.health[key]===0),'Estado zero inconsistente na saúde.');
console.log('OK API PROD: Cockpit confirmou 0 empresas / 0 projetos e nenhum KPI fictício.');

const curve=(await request('/api/dash-curve',{json:true,auth:true})).body;
must(curve&&typeof curve==='object','Curva S não retornou objeto JSON.');
must(Array.isArray(curve.months)&&Array.isArray(curve.prev)&&Array.isArray(curve.real),'Curva S sem arrays months/prev/real.');
must(curve.months.length===curve.prev.length&&curve.months.length===curve.real.length,'Curva S com arrays divergentes.');
must(curve.byCompany&&typeof curve.byCompany==='object'&&!Array.isArray(curve.byCompany),'Curva S sem byCompany válido.');
for(let i=0;i<curve.months.length;i++){
  must(String(curve.months[i]??'').trim()!=='',`Curva S com mês vazio no índice ${i}.`);
  must(Number.isFinite(Number(curve.prev[i])),`Curva S planejada inválida no índice ${i}.`);
  must(curve.real[i]===null||Number.isFinite(Number(curve.real[i])),`Curva S realizada inválida no índice ${i}.`);
}
console.log(`OK Curva S PROD: ${curve.months.length} período(s) com contrato válido.`);
console.log('OK: smoke final do Cockpit Executivo PMO em PRODUÇÃO concluído.');
