import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const BASE=String(process.env.ALLAMO_SMOKE_BASE||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const TOKEN=String(process.env.ALLAMO_SMOKE_TOKEN||'').trim();
const CONFIG='wrangler.stage.toml';
const WRANGLER='wrangler@4.124.0';
const cleanupOnly=process.argv.includes('--cleanup-only');
const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^0-9A-Za-z]/g,'').slice(-18);
const suffix=(runId||'smoke')+String(process.env.GITHUB_RUN_ATTEMPT||'1');
const companyId=('smokeonb'+suffix).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,30);
const companyName=`Smoke Onboarding ${suffix}`;
const projectName=`Smoke Projeto ${suffix}`;
const companyRequestId=`smoke.company.${suffix}`;
const projectRequestId=`smoke.project.${suffix}`;
const noAuthRequestId=`smoke.noauth.${suffix}`;

const abort=(m)=>{throw new Error(m)};
if(String(process.env.GITHUB_ACTIONS||'').toLowerCase()!=='true') abort('Smoke recusado fora do GitHub Actions.');
if(!fs.existsSync(CONFIG)) abort('Config exclusiva de Stage ausente.');
const cfg=fs.readFileSync(CONFIG,'utf8');
if(!/name\s*=\s*"allamo-pmo-stage"/.test(cfg)||/database_name\s*=\s*"allamo-pmo"\s*$/m.test(cfg)) abort('Config não pertence exclusivamente ao Stage.');
if(BASE!=='https://allamo-pmo-stage.pages.dev') abort('Smoke recusado fora do host canônico de Stage.');

const esc=s=>String(s).replace(/'/g,"''");
function wrangler(sql){
  const r=spawnSync('npx',['--yes',WRANGLER,'d1','execute','DB','--remote','--config',CONFIG,'--command',sql,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(r.error||r.status!==0) throw new Error('Falha ao executar cleanup controlado no D1 Stage.');
}
async function api(path,{method='GET',body,token=TOKEN,key}={}){
  const headers={accept:'application/json'};
  if(body!==undefined) headers['content-type']='application/json';
  if(token) headers.authorization=`Bearer ${token}`;
  if(key) headers['idempotency-key']=key;
  const res=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await res.text();
  let data=null;
  try{data=text?JSON.parse(text):null}catch{data={raw:text.slice(0,300)}}
  return {status:res.status,data};
}
function expect(cond,msg){if(!cond) throw new Error(msg)}
async function list(path){
  const r=await api(path,{token:''});
  expect(r.status===200,`${path} deveria responder 200, recebeu ${r.status}`);
  expect(Array.isArray(r.data),`${path} não retornou array.`);
  return r.data;
}
function companySnapshot(items){
  return JSON.stringify(items.map(x=>({id:String(x?.id??''),name:String(x?.name??'')})).sort((a,b)=>(a.id+'|'+a.name).localeCompare(b.id+'|'+b.name)));
}
function projectSnapshot(items){
  return JSON.stringify(items.map(x=>({id:String(x?.id??''),name:String(x?.name??''),company_id:String(x?.company_id??'')})).sort((a,b)=>(a.id+'|'+a.company_id+'|'+a.name).localeCompare(b.id+'|'+b.company_id+'|'+b.name)));
}
function cleanup(){
  // Somente registros com identificadores exclusivos deste run podem ser removidos.
  wrangler(`DELETE FROM projects WHERE company_id='${esc(companyId)}' AND name='${esc(projectName)}';`);
  wrangler(`DELETE FROM companies WHERE id='${esc(companyId)}' AND name='${esc(companyName)}';`);
  wrangler(`DELETE FROM onboarding_requests WHERE request_id IN ('${esc(companyRequestId)}','${esc(projectRequestId)}','${esc(noAuthRequestId)}') OR company_id='${esc(companyId)}';`);
  wrangler(`DELETE FROM audit_log WHERE (action='empresa:criar' AND target='${esc(companyName)}') OR (action='projeto:criar' AND target='${esc(projectName)}');`);
}

if(cleanupOnly){
  cleanup();
  console.log('[OK] Cleanup redundante do smoke de onboarding executado somente no D1 Stage.');
  process.exit(0);
}
if(!TOKEN) abort('ALLAMO_SMOKE_TOKEN ausente; sessão humana/técnica efêmera é obrigatória.');

let primaryError=null;
let baselineCompanies=[];
let baselineProjects=[];
let baselineCompaniesSnapshot='';
let baselineProjectsSnapshot='';
try{
  baselineCompanies=await list('/api/companies');
  baselineProjects=await list('/api/projects');
  baselineCompaniesSnapshot=companySnapshot(baselineCompanies);
  baselineProjectsSnapshot=projectSnapshot(baselineProjects);
  console.log(`[INFO] Baseline preservado do Stage: companies=${baselineCompanies.length}, projects=${baselineProjects.length}. Nenhum registro preexistente será removido.`);
  if(baselineCompanies.length>0) console.log('[INFO] Empresas preexistentes:',baselineCompanies.map(x=>`${x?.id??''}:${x?.name??''}`).join(' | '));
  if(baselineProjects.length>0) console.log('[INFO] Projetos preexistentes:',baselineProjects.map(x=>`${x?.id??''}:${x?.company_id??''}:${x?.name??''}`).join(' | '));

  expect(!baselineCompanies.some(x=>String(x?.id)===companyId||String(x?.name)===companyName),'Identificador temporário do smoke colide com empresa preexistente.');
  expect(!baselineProjects.some(x=>String(x?.name)===projectName&&String(x?.company_id)===companyId),'Identificador temporário do smoke colide com projeto preexistente.');

  const companyBody={id:companyId,name:companyName,system:'PMO Smoke',status_text:'Homologação temporária'};

  const synthetic=await api('/api/companies',{method:'POST',body:companyBody,token:'',key:noAuthRequestId});
  expect(synthetic.status===403&&synthetic.data?.code==='authenticated_onboarding_required',`Onboarding sem sessão deveria retornar 403/authenticated_onboarding_required; recebeu ${synthetic.status}/${synthetic.data?.code||'sem-code'}`);

  const c1=await api('/api/companies',{method:'POST',body:companyBody,key:companyRequestId});
  expect(c1.status===200&&c1.data?.ok===true&&String(c1.data?.id)===companyId,`Criação de empresa falhou: HTTP ${c1.status}`);
  expect(c1.data?.replayed!==true,'Primeira criação de empresa não pode ser replay.');

  const cReplay=await api('/api/companies',{method:'POST',body:companyBody,key:companyRequestId});
  expect(cReplay.status===200&&cReplay.data?.replayed===true&&String(cReplay.data?.id)===companyId,`Replay de empresa não foi idempotente: HTTP ${cReplay.status}`);

  const cConflict=await api('/api/companies',{method:'POST',body:{...companyBody,name:companyName+' Alterada'},key:companyRequestId});
  expect(cConflict.status===409&&cConflict.data?.code==='idempotency_conflict',`Conflito de request_id de empresa deveria ser 409/idempotency_conflict; recebeu ${cConflict.status}/${cConflict.data?.code||'sem-code'}`);

  const afterCompany=await list('/api/companies');
  const ownCompanies=afterCompany.filter(x=>String(x?.id)===companyId&&String(x?.name)===companyName);
  expect(afterCompany.length===baselineCompanies.length+1&&ownCompanies.length===1,'Empresa temporária deveria acrescentar exatamente um registro ao baseline, sem alterar os existentes.');
  const withoutOwnCompany=afterCompany.filter(x=>String(x?.id)!==companyId);
  expect(companySnapshot(withoutOwnCompany)===baselineCompaniesSnapshot,'Baseline de empresas foi alterado durante o smoke; abortando sem tocar nos registros preexistentes.');

  const projectBody={name:projectName,company_id:companyId,status:'Backlog',summary:'Homologação idempotente temporária'};
  const p1=await api('/api/projects',{method:'POST',body:projectBody,key:projectRequestId});
  expect(p1.status===200&&p1.data?.ok===true&&p1.data?.id!=null,`Criação de projeto falhou: HTTP ${p1.status}`);
  const projectId=String(p1.data.id);

  const pReplay=await api('/api/projects',{method:'POST',body:projectBody,key:projectRequestId});
  expect(pReplay.status===200&&pReplay.data?.replayed===true&&String(pReplay.data?.id)===projectId,`Replay de projeto não foi idempotente: HTTP ${pReplay.status}`);

  const pConflict=await api('/api/projects',{method:'POST',body:{...projectBody,summary:'Payload diferente'},key:projectRequestId});
  expect(pConflict.status===409&&pConflict.data?.code==='idempotency_conflict',`Conflito de request_id de projeto deveria ser 409/idempotency_conflict; recebeu ${pConflict.status}/${pConflict.data?.code||'sem-code'}`);

  const afterProject=await list('/api/projects');
  const ownProjects=afterProject.filter(p=>String(p.company_id)===companyId&&String(p.name)===projectName);
  expect(afterProject.length===baselineProjects.length+1&&ownProjects.length===1&&String(ownProjects[0]?.id)===projectId,'Projeto temporário deveria acrescentar exatamente um registro ao baseline, sem duplicação.');
  const withoutOwnProject=afterProject.filter(p=>String(p.id)!==projectId);
  expect(projectSnapshot(withoutOwnProject)===baselineProjectsSnapshot,'Baseline de projetos foi alterado durante o smoke; abortando sem tocar nos registros preexistentes.');

  console.log('[OK] Smoke funcional: sessão obrigatória, criação empresa→projeto, replay e conflitos idempotentes comprovados no Stage.');
}catch(e){
  primaryError=e;
  console.error('[ERRO] Smoke funcional falhou:',e.message||String(e));
}finally{
  try{cleanup();console.log('[OK] Cleanup primário do smoke concluído.');}
  catch(e){console.error('[ERRO] Cleanup primário falhou:',e.message||String(e));if(!primaryError)primaryError=e;}
}

try{
  const finalCompanies=await list('/api/companies');
  const finalProjects=await list('/api/projects');
  if(baselineCompaniesSnapshot||baselineProjectsSnapshot){
    expect(companySnapshot(finalCompanies)===baselineCompaniesSnapshot,`Empresas do Stage não retornaram exatamente ao baseline preservado; atual=${finalCompanies.length}, baseline=${baselineCompanies.length}`);
    expect(projectSnapshot(finalProjects)===baselineProjectsSnapshot,`Projetos do Stage não retornaram exatamente ao baseline preservado; atual=${finalProjects.length}, baseline=${baselineProjects.length}`);
    console.log(`[OK] Stage retornou exatamente ao baseline preservado: companies=${baselineCompanies.length}, projects=${baselineProjects.length}.`);
  }
}catch(e){
  console.error('[ERRO] Verificação final de baseline falhou:',e.message||String(e));
  if(!primaryError)primaryError=e;
}

if(primaryError) process.exit(1);
