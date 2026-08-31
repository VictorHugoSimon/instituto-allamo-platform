import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const config=process.env.ALLAMO_STAGE_WRANGLER_CONFIG||'wrangler.stage.toml';
const dir=process.env.OPR_MEETING_ACTIONS_DIR||'data/opr/meeting-actions';
const fail=m=>{throw new Error('[OPR MEETING SYNC] '+m)};
const sqlq=v=>"'"+String(v??'').replace(/'/g,"''")+"'";
let sessionToken='';

function parseD1(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean)}catch{}
  const starts=[];
  for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);
  for(const a of starts){
    for(let b=clean.length-1;b>a;b--){
      if(clean[b]!==']'&&clean[b]!=='}') continue;
      try{return JSON.parse(clean.slice(a,b+1))}catch{}
    }
  }
  fail('Resposta D1 não é JSON reconhecível.');
}

function rowsDeep(node){
  const found=[];
  const walk=v=>{
    if(Array.isArray(v)){
      if(v.every(x=>x&&typeof x==='object'&&!Array.isArray(x))) found.push(v);
      for(const x of v) walk(x);
    }else if(v&&typeof v==='object'){
      if(Array.isArray(v.results)) found.unshift(v.results);
      for(const x of Object.values(v)) walk(x);
    }
  };
  walk(node);
  return found[0]||[];
}

function d1(sql,{json=true}={}){
  const args=['--yes','wrangler@4.124.0','d1','execute','DB','--remote','--config',config,'--command',sql];
  if(json) args.push('--json');
  const r=spawnSync('npx',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false});
  if(r.error) throw r.error;
  if(r.status!==0){process.stderr.write(String(r.stderr||''));fail('Wrangler D1 falhou ('+r.status+').')}
  return json?rowsDeep(parseD1(String(r.stdout||'')+String(r.stderr||''))):[];
}

async function req(p,opt={}){
  const headers={'content-type':'application/json',...(opt.headers||{})};
  if(sessionToken) headers.authorization='Bearer '+sessionToken;
  const r=await fetch(base+p,{...opt,headers,cache:'no-store'});
  const text=await r.text();
  let d;try{d=JSON.parse(text)}catch{d=text}
  if(!r.ok) fail(`${opt.method||'GET'} ${p} -> ${r.status} ${typeof d==='string'?d:JSON.stringify(d)}`);
  return d;
}

function norm(v){return v===null||v===undefined?'':String(v)}
function equalField(key,current,wanted){
  if(key==='critical_path') return Boolean(Number(current)||current===true)===Boolean(wanted);
  return norm(current)===norm(wanted);
}

function actionPatch(current,wanted){
  const out={};
  const fields=['action','description','priority','responsible','start_date','due_date','front','dependency','impact','critical_path','next_step','evidence','source','status'];
  for(const key of fields){
    if(Object.prototype.hasOwnProperty.call(wanted,key)&&!equalField(key,current[key],wanted[key])) out[key]=wanted[key];
  }
  return out;
}

async function ensureSession(){
  const company=d1("SELECT id FROM companies WHERE UPPER(name) LIKE '%OPR%' ORDER BY id LIMIT 1;")[0];
  if(!company?.id) fail('Empresa OPR não encontrada.');
  const user=d1(`SELECT id FROM users WHERE role IN ('admin','pmo','gestor','techlead') AND COALESCE(status,'Ativo')<>'Bloqueado' AND (company_id IS NULL OR company_id=${sqlq(company.id)}) ORDER BY CASE WHEN company_id IS NULL THEN 0 ELSE 1 END,id LIMIT 1;`)[0];
  if(!user?.id) fail('Usuário técnico elegível não encontrado.');
  sessionToken='opr-meeting-sync-'+randomUUID();
  d1(`INSERT INTO sessions(token,user_id,expires_at) VALUES(${sqlq(sessionToken)},${sqlq(user.id)},datetime('now','+30 minutes'));`,{json:false});
}

async function cleanup(){
  try{if(sessionToken)d1(`DELETE FROM sessions WHERE token=${sqlq(sessionToken)};`,{json:false})}
  catch(e){console.error('[OPR MEETING SYNC] limpeza de sessão falhou:',e.message)}
}

async function main(){
  if(!fs.existsSync(dir)){console.log('[OPR MEETING SYNC] diretório inexistente; nada a aplicar.');return}
  const files=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort();
  if(!files.length){console.log('[OPR MEETING SYNC] nenhum manifesto; nada a aplicar.');return}

  let created=0,updated=0,skipped=0,cadenceCreated=0,cadenceUpdated=0;
  await ensureSession();
  const projects=await req('/api/opr-projects');
  if(!Array.isArray(projects)||!projects.length) fail('Projeto OPR não encontrado.');

  for(const file of files){
    const manifest=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
    const project=projects.find(p=>String(p.id)===String(manifest.project_id))
      ||projects.find(p=>String(p.name||'').toLowerCase().includes(String(manifest.project_name_contains||'').toLowerCase()))
      ||projects[0];
    if(!project) fail('Projeto do manifesto '+file+' não localizado.');
    const projectId=project.id;
    let actions=await req('/api/opr-actions?project='+encodeURIComponent(projectId));

    for(const a of manifest.actions||[]){
      const payload={
        project_id:projectId,
        action:a.action,
        description:a.description||'',
        priority:a.priority||'Média',
        responsible:a.responsible||'PENDENTE DE VALIDAÇÃO',
        start_date:a.start_date||null,
        due_date:a.due_date||null,
        status:a.status||'Planejado',
        front:a.front||'',
        dependency:a.dependency||'',
        impact:a.impact||'',
        critical_path:!!a.critical_path,
        next_step:a.next_step||'',
        evidence:a.evidence||'',
        source:a.source
      };
      const current=actions.find(x=>x.source===a.source)||actions.find(x=>String(x.action||'').trim()===String(a.action||'').trim());
      if(!current){
        const res=await req('/api/opr-actions',{method:'POST',body:JSON.stringify(payload)});
        created++;
        console.log(`[CRIADO] ${a.source} -> ${res.id}`);
        actions=await req('/api/opr-actions?project='+encodeURIComponent(projectId));
      }else{
        const patch=actionPatch(current,payload);
        if(Object.keys(patch).length){
          await req('/api/opr-actions/'+encodeURIComponent(current.id),{method:'PATCH',body:JSON.stringify(patch)});
          updated++;
          console.log(`[ATUALIZADO] ${a.source} -> ${current.id}`);
        }else{
          skipped++;
          console.log(`[SEM ALTERAÇÃO] ${a.source} -> ${current.id}`);
        }
      }
    }

    if(manifest.cadence){
      const list=await req('/api/opr-cadence?project='+encodeURIComponent(projectId));
      const c=manifest.cadence;
      const current=list.find(x=>x.source===c.source);
      const payload={project_id:projectId,period:c.period||'',agenda:c.agenda,objective:c.objective||'',participants:c.participants||'',status:c.status||'Realizada',result_next_step:c.result_next_step||'',action_id:c.action_id||null,source:c.source};
      if(!current){
        await req('/api/opr-cadence',{method:'POST',body:JSON.stringify(payload)});
        cadenceCreated++;
        console.log(`[CADÊNCIA CRIADA] ${c.source}`);
      }else{
        const patch={};
        for(const key of ['period','agenda','objective','participants','status','result_next_step','action_id','source']) if(norm(current[key])!==norm(payload[key])) patch[key]=payload[key];
        if(Object.keys(patch).length){
          await req('/api/opr-cadence/'+encodeURIComponent(current.id),{method:'PATCH',body:JSON.stringify(patch)});
          cadenceUpdated++;
          console.log(`[CADÊNCIA ATUALIZADA] ${c.source}`);
        }
      }
    }
  }

  console.log(`[OK] OPR Meeting Sync: ações criadas=${created}, atualizadas=${updated}, sem alteração=${skipped}, cadências criadas=${cadenceCreated}, atualizadas=${cadenceUpdated}.`);
}

main().catch(e=>{console.error(e);process.exitCode=1}).finally(cleanup);
