const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
async function get(path){const r=await fetch(base+path,{redirect:'follow'});const text=await r.text();return {r,text}}
const page=await get('/governanca-sprint/');
assert(page.r.ok,'Painel Governança de Sprint HTTP '+page.r.status);
assert(page.text.includes('Governança de Sprint'),'Painel não contém identidade do módulo');
assert(page.text.includes('Definition of Ready')&&page.text.includes('Definition of Done'),'Templates DoR/DoD ausentes no painel');
const api=await get('/api/sprint-documents');
assert(api.r.ok,'API sprint-documents HTTP '+api.r.status+' · '+api.text.slice(0,180));
let rows;try{rows=JSON.parse(api.text)}catch{throw new Error('API sprint-documents não retornou JSON')}
assert(Array.isArray(rows),'API sprint-documents não retornou lista');
console.log('SPRINT_GOVERNANCE_SMOKE_OK',JSON.stringify({base,documents:rows.length}));
