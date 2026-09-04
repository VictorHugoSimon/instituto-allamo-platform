const arg=name=>{const p=process.argv.find(a=>a.startsWith(`--${name}=`));return p?p.slice(name.length+3):''};
const base=(arg('base')||'').replace(/\/$/,'');
const environment=arg('env')||'unknown';
if(!base){console.error('Uso: node scripts/smoke-stage-data-integrity.mjs --base=https://... --env=stage');process.exit(2)}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const must=(condition,message)=>{if(!condition)throw new Error(message)};

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
    if(i<11)await sleep(3000);
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
      if(r.status===403&&data.code==='authenticated_session_required')return {http:r.status,code:data.code,attempts:i};
      last=`HTTP ${r.status} / ${data.code||text.slice(0,120)}`;
    }catch(e){last=String(e?.message||e)}
    if(i<12)await sleep(3000);
  }
  throw new Error(`Proteção destrutiva sem login inválida após 12 tentativas: ${last}`);
}

const companies=await get('/api/companies');
must(Array.isArray(companies),'/api/companies não retornou array.');
const companyIds=companies.map(c=>String(c?.id??'').trim());
must(companyIds.every(Boolean),'Empresa sem id canônico.');
must(new Set(companyIds).size===companyIds.length,'Há IDs de empresa duplicados.');

const projects=await get('/api/projects');
must(Array.isArray(projects),'/api/projects não retornou array.');
const projectIds=projects.map(p=>String(p?.id??'').trim());
must(projectIds.every(Boolean),'Projeto sem id canônico.');
must(new Set(projectIds).size===projectIds.length,'Há IDs de projeto duplicados.');

const companyIdSet=new Set(companyIds);
const orphanProjects=projects.filter(p=>String(p?.company_id??'').trim()&&!companyIdSet.has(String(p.company_id)));
must(orphanProjects.length===0,`Projetos com company_id sem empresa: ${orphanProjects.slice(0,8).map(p=>`${p.id}:${p.company_id}`).join(', ')}`);

if(companies.length===0)must(projects.length===0,'Estado zero inválido: existem projetos sem nenhuma empresa cadastrada.');

const destructiveGuard=await assertNoLoginDeleteBlocked();
console.log(JSON.stringify({
  ok:true,
  environment,
  base,
  company_count:companies.length,
  project_count:projects.length,
  empty_state_valid:companies.length===0&&projects.length===0,
  destructive_guard:destructiveGuard
},null,2));
console.log('OK: integridade do STAGE válida sem exigir empresas ou projetos pré-cadastrados.');
