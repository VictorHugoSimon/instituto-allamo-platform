const arg=name=>{const p=process.argv.find(a=>a.startsWith(`--${name}=`));return p?p.slice(name.length+3):''};
const base=(arg('base')||'').replace(/\/$/,'');
const environment=arg('env')||'unknown';
if(!base){console.error('Uso: node scripts/smoke-governance-environment.mjs --base=https://... --env=stage');process.exit(2)}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){
  let last='';
  for(let i=1;i<=12;i++){
    try{
      const r=await fetch(base+path,{headers:{'cache-control':'no-cache','pragma':'no-cache'},cache:'no-store'});
      const text=await r.text();
      if(r.ok){try{return JSON.parse(text)}catch{last=`JSON inválido: ${text.slice(0,220)}`}}
      else last=`HTTP ${r.status}: ${text.slice(0,220)}`;
    }catch(e){last=String(e?.message||e)}
    console.log(`Aguardando propagação ${environment} (${i}/12)…`);
    await sleep(5000);
  }
  throw new Error(`${path} falhou: ${last}`);
}

const companies=await get('/api/companies');
if(!Array.isArray(companies)||!companies.length)throw new Error('Nenhuma empresa disponível para smoke de governança.');
let projectCount=0,eventCount=0;
for(const company of companies.slice(0,25)){
  const cid=String(company?.id||'').trim();
  if(!cid)throw new Error('Empresa sem id no retorno de /api/companies.');
  const portfolio=await get('/api/public-client-projects?company='+encodeURIComponent(cid));
  if(portfolio.context_locked!==true||String(portfolio.company?.id)!==cid)throw new Error(`Contexto público inválido para ${cid}`);
  for(const project of (portfolio.projects||[]).slice(0,10)){
    const pid=String(project?.id||'').trim();
    const gov=await get('/api/public-governance?company='+encodeURIComponent(cid)+'&project='+encodeURIComponent(pid));
    if(gov.context_locked!==true||String(gov.company?.id)!==cid||String(gov.project?.id)!==pid)throw new Error(`Cruzamento de tenant/projeto em ${cid}/${pid}`);
    projectCount++;
    eventCount+=(gov.events||[]).length;
  }
}
console.log(JSON.stringify({ok:true,environment,base,companies_checked:Math.min(companies.length,25),projects_checked:projectCount,governance_events_seen:eventCount},null,2));
