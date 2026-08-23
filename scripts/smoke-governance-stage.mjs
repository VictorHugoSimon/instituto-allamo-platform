const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const companies=String(process.env.ALLAMO_SMOKE_COMPANIES||'').split(',').map(x=>x.trim()).filter(Boolean);
const get=async p=>{const r=await fetch(base+p,{headers:{'cache-control':'no-store'}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${p}: HTTP ${r.status} ${d.error||''}`);return d};
const health=await get('/api/stage-health');if(health.ok!==true||health.environment!=='stage')throw new Error('Stage health inválido.');
console.log(`OK health: ${health.build||'stage'}`);
if(!companies.length){console.log('SKIP tenants: defina ALLAMO_SMOKE_COMPANIES=slug1,slug2,slug3 para smoke multitenant completo.');process.exit(0)}
for(const token of companies){
 const c=await get('/api/public-client-projects?company='+encodeURIComponent(token));
 if(c.context_locked!==true||!c.company?.id)throw new Error(`Contexto público inválido para ${token}`);
 console.log(`OK empresa: ${c.company.name} (${c.company.id}) · ${c.projects?.length||0} projeto(s)`);
 for(const p of (c.projects||[]).slice(0,5)){
  const g=await get('/api/public-governance?company='+encodeURIComponent(token)+'&project='+encodeURIComponent(p.id));
  if(g.context_locked!==true||String(g.company?.id)!==String(c.company.id)||String(g.project?.id)!==String(p.id))throw new Error(`Vazamento de contexto em ${token}/${p.id}`);
  console.log(`  OK projeto ${p.name}: ${g.events?.length||0} evento(s) de governança`);
 }
}
console.log('OK: smoke Stage multitenant de governança concluído.');
