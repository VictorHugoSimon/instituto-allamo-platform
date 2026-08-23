const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
let companies=String(process.env.ALLAMO_SMOKE_COMPANIES||'').split(',').map(x=>x.trim()).filter(Boolean);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=async p=>{const r=await fetch(base+p,{headers:{'cache-control':'no-store'}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${p}: HTTP ${r.status} ${d.error||''}`);return d};
async function waitHealth(){let last;for(let i=1;i<=12;i++){try{const h=await get('/api/stage-health');if(h.ok===true&&h.environment==='stage')return h;last=new Error('Stage health inválido.')}catch(e){last=e}console.log(`Aguardando propagação do Stage (${i}/12)…`);await sleep(10000)}throw last||new Error('Stage indisponível')}
const health=await waitHealth();
console.log(`OK health: ${health.build||'stage'}`);
if(!companies.length){
 try{
  const discovered=await get('/api/companies');
  if(Array.isArray(discovered))companies=discovered.map(x=>String(x?.id||'').trim()).filter(Boolean).slice(0,25);
  console.log(`Descoberta automática: ${companies.length} tenant(s) no Stage.`);
 }catch(e){console.warn('Não foi possível descobrir tenants automaticamente:',e.message)}
}
if(!companies.length){console.log('SKIP tenants: health validado, mas não há tenants disponíveis para smoke público.');process.exit(0)}
for(const token of companies){
 const c=await get('/api/public-client-projects?company='+encodeURIComponent(token));
 if(c.context_locked!==true||!c.company?.id)throw new Error(`Contexto público inválido para ${token}`);
 console.log(`OK empresa: ${c.company.name} (${c.company.id}) · ${c.projects?.length||0} projeto(s)`);
 for(const p of (c.projects||[]).slice(0,10)){
  const g=await get('/api/public-governance?company='+encodeURIComponent(token)+'&project='+encodeURIComponent(p.id));
  if(g.context_locked!==true||String(g.company?.id)!==String(c.company.id)||String(g.project?.id)!==String(p.id))throw new Error(`Vazamento de contexto em ${token}/${p.id}`);
  console.log(`  OK projeto ${p.name}: ${g.events?.length||0} evento(s) de governança`);
 }
}
console.log('OK: smoke Stage multitenant de governança concluído.');
