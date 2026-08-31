import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const config=process.env.ALLAMO_STAGE_WRANGLER_CONFIG||'wrangler.stage.toml';
const marker='SMOKE OPR '+Date.now();
const fail=m=>{throw new Error('[OPR PMO SMOKE] '+m)};
const sqlq=v=>"'"+String(v??'').replace(/'/g,"''")+"'";
let sessionToken='',projectId=null;

function parseD1(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean)}catch{}
  const starts=[];for(let i=0;i<clean.length;i++)if(clean[i]==='['||clean[i]==='{')starts.push(i);
  for(const a of starts){for(let b=clean.length-1;b>a;b--){if(clean[b]!==']'&&clean[b]!=='}')continue;try{return JSON.parse(clean.slice(a,b+1))}catch{}}}
  fail('Resposta D1 não é JSON reconhecível.');
}
function rowsDeep(node){
  const found=[];const walk=v=>{if(Array.isArray(v)){if(v.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))found.push(v);for(const x of v)walk(x)}else if(v&&typeof v==='object'){if(Array.isArray(v.results))found.unshift(v.results);for(const x of Object.values(v))walk(x)}};walk(node);return found[0]||[];
}
function d1(sql,{json=true}={}){
  const args=['--yes','wrangler@4.124.0','d1','execute','DB','--remote','--config',config,'--command',sql];if(json)args.push('--json');
  const r=spawnSync('npx',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false});
  if(r.error)throw r.error;if(r.status!==0){process.stderr.write(String(r.stderr||''));fail('Wrangler D1 falhou ('+r.status+').')}
  return json?rowsDeep(parseD1(String(r.stdout||'')+String(r.stderr||''))):[];
}
async function req(path,opt={}){
  const headers={'content-type':'application/json',...(opt.headers||{})};if(sessionToken)headers.authorization='Bearer '+sessionToken;
  const r=await fetch(base+path,{...opt,headers,cache:'no-store'});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d=text}
  if(!r.ok)fail(`${opt.method||'GET'} ${path} -> ${r.status} ${typeof d==='string'?d:JSON.stringify(d)}`);return d;
}
async function cleanup(){
  try{
    if(projectId){
      const work=d1(`SELECT w.id FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=${Number(projectId)} AND w.title LIKE ${sqlq(marker+'%')};`);
      for(const r of work){
        const id=String(r.id||'');if(!id)continue;
        d1(`DELETE FROM opr_action_history WHERE work_item_id=${sqlq(id)};`,{json:false});
        d1(`DELETE FROM opr_action_meta WHERE work_item_id=${sqlq(id)};`,{json:false});
        d1(`DELETE FROM work_items WHERE id=${sqlq(id)};`,{json:false});
      }
      d1(`DELETE FROM opr_intake WHERE project_id=${Number(projectId)} AND demand LIKE ${sqlq(marker+'%')};`,{json:false});
      d1(`DELETE FROM opr_customizations WHERE project_id=${Number(projectId)} AND subject LIKE ${sqlq(marker+'%')};`,{json:false});
      d1(`DELETE FROM opr_cadence WHERE project_id=${Number(projectId)} AND agenda LIKE ${sqlq(marker+'%')};`,{json:false});
      d1(`DELETE FROM opr_role_assignments WHERE project_id=${Number(projectId)} AND scope_ref LIKE ${sqlq(marker+'%')};`,{json:false});
      d1(`DELETE FROM opr_completeness_audit WHERE project_id=${Number(projectId)} AND item_summary LIKE ${sqlq(marker+'%')};`,{json:false});
    }
    if(sessionToken)d1(`DELETE FROM sessions WHERE token=${sqlq(sessionToken)};`,{json:false});
  }catch(e){console.error('[OPR PMO SMOKE] limpeza técnica de artefatos de teste falhou:',e.message)}
}

try{
  console.log('[1/15] rota dedicada + modelo visual...');
  const plan=await (await fetch(base+'/opr-plano-de-acao/',{cache:'no-store'})).text();
  for(const x of ['Plano Mestre','Customizações / Desenvolvimentos','Responsáveis por Papel','Pendências','Entrada de Demandas','Cadência Completa','Histórico','Lixeira'])if(!plan.includes(x))fail('Plano dedicado não contém '+x);
  if((plan.match(/class="navbtn(?: on)?" data-tab=/g)||[]).length!==6)fail('Menu dedicado não possui exatamente 6 itens.');

  console.log('[2/15] criar sessão técnica temporária sem expor credencial...');
  const company=d1("SELECT id FROM companies WHERE UPPER(name) LIKE '%OPR%' ORDER BY id LIMIT 1;")[0];if(!company?.id)fail('Empresa OPR não encontrada no Stage.');
  const user=d1(`SELECT id FROM users WHERE role IN ('admin','pmo','gestor','techlead') AND COALESCE(status,'Ativo')<>'Bloqueado' AND (company_id IS NULL OR company_id=${sqlq(company.id)}) ORDER BY CASE WHEN company_id IS NULL THEN 0 ELSE 1 END,id LIMIT 1;`)[0];if(!user?.id)fail('Usuário técnico elegível para sessão de smoke não encontrado.');
  sessionToken='opr-smoke-'+randomUUID();d1(`INSERT INTO sessions(token,user_id,expires_at) VALUES(${sqlq(sessionToken)},${sqlq(user.id)},datetime('now','+20 minutes'));`,{json:false});

  console.log('[3/15] localizar projeto OPR...');
  const projects=await req('/api/opr-projects');if(!Array.isArray(projects)||!projects.length)fail('Nenhum projeto OPR retornado.');projectId=projects[0].id;

  console.log('[4/15] criar ação com ID PA sequencial...');
  const created=await req('/api/opr-actions',{method:'POST',body:JSON.stringify({project_id:projectId,front:'Smoke Test',action:marker+' · ação CRUD',responsible:'PMO Smoke',status:'Planejado',dependency:'Teste automatizado',impact:'Somente homologação',critical_path:false,next_step:'Transicionar status',evidence:'Smoke automatizado Stage',source:'GitHub Actions'})});
  if(!/^PA-\d+$/.test(String(created.id||'')))fail('ID público não segue PA-xxx: '+String(created.id));const pa=created.id;

  console.log('[5/15] status inline/API Planejado → Em andamento...');
  await req('/api/opr-actions/'+encodeURIComponent(pa),{method:'PATCH',body:JSON.stringify({status:'Em andamento'})});
  console.log('[6/15] editar campos + persistência após recarga...');
  await req('/api/opr-actions/'+encodeURIComponent(pa),{method:'PATCH',body:JSON.stringify({responsible:'PMO Smoke Editado',impact:'Impacto editado e persistido',next_step:'Concluir smoke',evidence:'Evidência atualizada pelo smoke'})});
  await req('/api/opr-actions/'+encodeURIComponent(pa),{method:'PATCH',body:JSON.stringify({status:'Concluído'})});
  let actions=await req('/api/opr-actions?project='+encodeURIComponent(projectId));let row=actions.find(x=>x.id===pa);if(!row||row.status!=='Concluído'||row.impact!=='Impacto editado e persistido')fail('Persistência de ação/status falhou após recarga.');

  console.log('[7/15] histórico INSERT/UPDATE...');
  let hist=await req('/api/opr-actions/'+encodeURIComponent(pa)+'/history');if(!hist.some(x=>x.action_type==='INSERT')||!hist.some(x=>x.action_type==='UPDATE'))fail('Histórico INSERT/UPDATE incompleto.');

  console.log('[8/15] lixeira + restauração + histórico...');
  await req('/api/opr-actions/'+encodeURIComponent(pa),{method:'DELETE'});let trash=await req('/api/opr-actions?project='+encodeURIComponent(projectId)+'&trash=1');if(!trash.some(x=>x.id===pa))fail('SOFT_DELETE não apareceu na lixeira.');await req('/api/opr-actions/'+encodeURIComponent(pa)+'/restore',{method:'POST'});actions=await req('/api/opr-actions?project='+encodeURIComponent(projectId));if(!actions.some(x=>x.id===pa))fail('RESTORE não devolveu ação ao plano.');hist=await req('/api/opr-actions/'+encodeURIComponent(pa)+'/history');if(!hist.some(x=>x.action_type==='SOFT_DELETE')||!hist.some(x=>x.action_type==='RESTORE'))fail('Histórico de lixeira/restauração incompleto.');

  console.log('[9/15] entrada de demanda → PA relacionado...');
  const intake=await req('/api/opr-intake',{method:'POST',body:JSON.stringify({project_id:projectId,intake_date:new Date().toISOString().slice(0,10),origin:'Smoke Test',demand:marker+' · demanda de triagem',front:'Smoke Test',owner:'PMO Smoke',triage_status:'Em triagem',evidence:'Smoke Stage'})});
  const approved=await req('/api/opr-intake/'+encodeURIComponent(intake.id)+'/approve',{method:'POST'});if(!/^PA-\d+$/.test(String(approved.action_id||'')))fail('Aprovação de demanda não gerou PA sequencial.');

  console.log('[10/15] customização completa CRUD lógico...');
  const custom=await req('/api/opr-customizations',{method:'POST',body:JSON.stringify({project_id:projectId,subject:marker+' · customização',situation:'Análise',approval:'PENDENTE DE VALIDAÇÃO',validation_owner:'PMO Smoke',key_user:'PMO Smoke',functional_owner:'PMO Smoke',technical_owner:'PMO Smoke Técnico',development_owner:'PMO Smoke DEV',pmo:'PMO Smoke',related_action_id:pa,next_step:'Revisar',evidence:'Smoke Stage'})});
  await req('/api/opr-customizations/'+encodeURIComponent(custom.id),{method:'PATCH',body:JSON.stringify({situation:'Revisão',next_step:'Próximo passo editado'})});const customs=await req('/api/opr-customizations?project='+encodeURIComponent(projectId));const cr=customs.find(x=>x.id===custom.id);if(!cr||cr.situation!=='Revisão'||cr.next_step!=='Próximo passo editado'||cr.related_action_id!==pa)fail('Customização não persistiu corretamente.');

  console.log('[11/15] responsáveis por papel...');
  const roleScope=marker+' · Papel';await req('/api/opr-roles',{method:'POST',body:JSON.stringify({project_id:projectId,scope_ref:roleScope,client_approver:'PENDENTE DE VALIDAÇÃO',key_user:'PMO Smoke',operational_owner:'PMO Smoke',functional_owner:'PMO Smoke',technical_owner:'PMO Smoke Técnico',development_owner:'PMO Smoke DEV',supplier:'PMO Smoke Fornecedor',pmo:'PMO Smoke'})});const roles=await req('/api/opr-roles?project='+encodeURIComponent(projectId));const rr=roles.find(x=>x.scope_ref===roleScope);if(!rr||rr.development_owner!=='PMO Smoke DEV'||rr.supplier!=='PMO Smoke Fornecedor')fail('Responsáveis por papel não persistiram.');

  console.log('[12/15] cadência criar/editar/relacionar...');
  const cad=await req('/api/opr-cadence',{method:'POST',body:JSON.stringify({project_id:projectId,period:new Date().toISOString().slice(0,10),agenda:marker+' · checkpoint',objective:'Validar governança mestre',participants:'PMO Smoke',status:'Planejada',result_next_step:'Executar smoke',action_id:pa,source:'GitHub Actions'})});await req('/api/opr-cadence/'+encodeURIComponent(cad.id),{method:'PATCH',body:JSON.stringify({status:'Realizada',result_next_step:'Smoke validado'})});const cadence=await req('/api/opr-cadence?project='+encodeURIComponent(projectId));const cg=cadence.find(x=>x.id===cad.id);if(!cg||cg.status!=='Realizada'||cg.action_id!==pa)fail('Cadência não persistiu/relacionou PA.');

  console.log('[13/15] auditoria de completude...');
  const aud=await req('/api/opr-audit',{method:'POST',body:JSON.stringify({project_id:projectId,audit_date:new Date().toISOString().slice(0,10),source_type:'DOCUMENTO',source_ref:'Smoke Stage',item_summary:marker+' · item auditado',classification:'COBERTO',related_action_id:pa,notes:'Validação automatizada'})});const audits=await req('/api/opr-audit?project='+encodeURIComponent(projectId));if(!audits.some(x=>x.id===aud.id&&x.related_action_id===pa&&x.classification==='COBERTO'))fail('Auditoria de completude não persistiu.');

  console.log('[14/15] report executivo derivado e quatro abas...');
  const reportData=await req('/api/opr-report-data?project='+encodeURIComponent(projectId));if(!reportData.actions.some(x=>x.id===created.work_item_id||x.action===marker+' · ação CRUD'))fail('Report-data não deriva da mesma ação do Plano Mestre.');const published=await req('/api/opr-report-publish',{method:'POST',body:JSON.stringify({project_id:projectId})});if(!published.public_url)fail('Publicação não retornou link público.');const publicHtml=await (await fetch(published.public_url,{cache:'no-store'})).text();for(const tab of ['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança'])if(!publicHtml.includes(tab))fail('Report público sem aba '+tab);if(/fch_entries|horas_import|fch-hours|capacity_hours|actual_hours|planned_hours/i.test(publicHtml))fail('Report público expôs informação interna de horas.');

  console.log('[15/15] isolamento + limpeza técnica dos artefatos de teste...');
  if(/Dual Clima|MADRI · Implantação|NUCCI ERP/i.test(plan))fail('Plano OPR contém conteúdo operacional de outro projeto.');
  console.log('[OK] OPR: CRUD real, PA sequencial, status, histórico, lixeira/restauração, intake, customização, papéis, cadência, auditoria e report derivado validados em Stage.');
}finally{await cleanup()}
