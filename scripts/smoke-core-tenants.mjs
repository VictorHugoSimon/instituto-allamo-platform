const arg=(name)=>{const p=process.argv.find(a=>a.startsWith(`--${name}=`));return p?p.slice(name.length+3):''};
const base=(arg('base')||'').replace(/\/$/,'');
const environment=arg('env')||'unknown';
if(!base){console.error('Uso: node scripts/smoke-core-tenants.mjs --base=https://... --env=stage');process.exit(2)}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){
  let last='';
  for(let i=0;i<12;i++){
    try{
      const r=await fetch(base+path,{headers:{'cache-control':'no-cache','pragma':'no-cache'},cache:'no-store'});
      const text=await r.text();
      if(r.ok){
        try{return JSON.parse(text)}catch{last=`JSON inválido: ${text.slice(0,220)}`}
      }else last=`HTTP ${r.status}: ${text.slice(0,220)}`;
    }catch(e){last=String(e?.message||e)}
    await sleep(3000);
  }
  throw new Error(`${path} falhou: ${last}`);
}

async function assertNoLoginDeleteBlocked(){
  const path='/api/companies/__allamo_smoke_never_exists__';
  let last='';
  for(let i=1;i<=12;i++){
    try{
      const r=await fetch(base+path,{method:'DELETE',headers:{'cache-control':'no-cache','pragma':'no-cache'},cache:'no-store'});
      const text=await r.text();
      let data={};try{data=JSON.parse(text)}catch{}
      if(r.status===403&&data.code==='authenticated_session_required'){
        return {http:r.status,code:data.code,attempts:i};
      }
      last=`HTTP ${r.status} / ${data.code||text.slice(0,120)}`;
    }catch(e){
      last=String(e?.message||e);
    }
    if(i<12){
      console.log(`Aguardando propagação da proteção destrutiva (${i}/12): ${last}`);
      await sleep(3000);
    }
  }
  throw new Error(`Proteção destrutiva sem login inválida após 12 tentativas: ${last}`);
}

const required=[['dualclima','Dual Clima'],['madrid','Madrid'],['opr','OPR']];
const companies=await get('/api/companies');
if(!Array.isArray(companies)) throw new Error('/api/companies não retornou array.');
for(const [,name] of required){
  if(!companies.some(c=>String(c.name)===name)) throw new Error(`Empresa obrigatória ausente: ${name}`);
}

const projects=await get('/api/projects');
if(!Array.isArray(projects)) throw new Error('/api/projects não retornou array.');
const companyIds=new Set(companies.map(c=>String(c.id)));
const orphanProjects=projects.filter(p=>p.company_id&&!companyIds.has(String(p.company_id)));
if(orphanProjects.length){
  throw new Error(`Projetos com company_id sem empresa: ${orphanProjects.slice(0,8).map(p=>`${p.id}:${p.company_id}`).join(', ')}`);
}

const publicResults=[];
for(const [token,name] of required){
  const data=await get('/api/public-client-projects?company='+encodeURIComponent(token));
  if(!data?.company||String(data.company.name)!==name){
    throw new Error(`Link público ${token} não resolveu para ${name}.`);
  }
  const cid=String(data.company.id);
  const crossed=(data.projects||[]).filter(p=>String(p.company_id)!==cid);
  if(crossed.length) throw new Error(`Cruzamento de tenant detectado em ${name}.`);
  publicResults.push({token,name,id:cid,projects:(data.projects||[]).length});
}

const destructiveGuard=await assertNoLoginDeleteBlocked();

console.log(JSON.stringify({
  ok:true,
  environment,
  base,
  companies:required.map(([,name])=>name),
  company_count:companies.length,
  project_count:projects.length,
  public_contexts:publicResults,
  destructive_guard:destructiveGuard
},null,2));
