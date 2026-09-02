// OPR Governance Platform v2 — módulos persistentes e isolados por empresa + projeto.
// Executa no mesmo escopo do Worker canônico. Não armazena segredos.
const opxWrite=['admin','pmo','gestor','techlead'].includes(user.role);
const opxNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const opxCanScope=companyId=>!scope||String(scope)===String(companyId);
const opxInternalId=tag=>`OPR-${tag}-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
const opxToday=()=>new Date().toISOString().slice(0,10);
const opxBlankEvidence=v=>!String(v||'').trim()||['sem evidência suficiente','sem evidencia suficiente','a confirmar'].includes(opxNorm(v));
const opxProjectContext=async projectId=>{
  if(!projectId&&projectId!==0)return {error:'Projeto OPR é obrigatório'};
  const row=await DB.prepare(`SELECT p.id project_id,p.name project_name,p.company_id,c.name company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id=?`).bind(projectId).first();
  if(!row)return {error:'Projeto não encontrado'};
  if(!opxCanScope(row.company_id))return {error:'Projeto fora do escopo do usuário'};
  if(!(opxNorm(row.company_name)==='opr'||opxNorm(row.company_name).includes('opr')))return {error:'Endpoint exclusivo do projeto OPR'};
  return row;
};
const opxEntities={
  requirements:{table:'opr_requirements',tag:'REQ',prefix:'REQ',required:'requirement',fields:['origin','area','subarea','requirement','priority','criticality','eliminatory','source_document','target_document','section','coverage_status','gap','classification','owner','action_id','test_id','evidence','acceptance'],bool:['eliminatory']},
  risks:{table:'opr_risks',tag:'RSK',prefix:'RSK',required:'description',fields:['description','category','probability','impact','severity','owner','mitigation','contingency','action_id','status','review_date','evidence']},
  integrations:{table:'opr_integrations',tag:'INT',prefix:'INT',required:'name',fields:['name','source_system','target_system','process','integration_type','layout','layout_version','frequency','source_owner','target_owner','environment','credential_ref','status','last_test','sla','contingency','log_reference','test_id','evidence']},
  tests:{table:'opr_tests',tag:'TST',prefix:'TST',required:'scenario',fields:['test_type','front','process','scenario','priority','owner','precondition','steps','expected_result','actual_result','expected_met','status','evidence','defect_id','origin','requirement_id','action_id','block_reason','executed_at','executor','approver'],bool:['expected_met']},
  defects:{table:'opr_test_defects',tag:'BUG',prefix:'BUG',required:'description',fields:['test_id','description','severity','impact','owner','status','evidence','correction','retest_status']},
  documents:{table:'opr_documents',tag:'DOC',prefix:'DOC',required:'document_name',fields:['document_name','document_type','version_label','owner','document_date','origin','status','url','hash_reference','current_version']},
  phases:{table:'opr_implementation_phases',tag:'FAS',prefix:'FAS',pad:2,required:'name',fields:['phase_order','name','objective','input_text','activities','owner','participants','output_text','acceptance_criteria','dependencies','status','evidence','gate']},
  readiness:{table:'opr_readiness',tag:'RDY',prefix:'RDY',required:'category',fields:['category','condition_text','owner','status','evidence','blocking','action_id'],bool:['blocking']},
  decisions:{table:'opr_decisions',tag:'DEC',prefix:'DEC',required:'decision',fields:['decision','context','owner','due_date','status','evidence','action_id','meeting_ref']}
};
const opxEnums={
  requirementClass:['','STD','CFG','DEV','INT'],coverage:['Coberto','Coberto parcialmente','Não localizado','Gap','Novo requisito'],
  testType:['SIT','UAT','E2E'],testStatus:['Planejado','Pronto para teste','Em execução','Aprovado','Reprovado','Bloqueado'],testPriority:['P1','P2','P3'],
  defectSeverity:['Sev1','Sev2','Sev3','Sev4'],defectStatus:['Aberto','Em correção','Pronto para reteste','Fechado','Cancelado'],
  integrationStatus:['Planejado','Em análise','Em desenvolvimento','Pronto para teste','Homologado','Produção','Bloqueado'],
  riskStatus:['Aberto','Mitigando','Monitorando','Aceito','Encerrado'],
  phaseStatus:['A confirmar','Não iniciado','Em andamento','Em atenção','Concluído','Bloqueado'],
  readinessStatus:['Pendente','Em andamento','Atendido','Bloqueado','Aceito com risco'],
  decisionStatus:['Pendente','Tomada','Cancelada'],documentStatus:['Rascunho','Em revisão','Aprovado','Obsoleto']
};
const opxTakeNumber=async(ctx,entity,prefix,pad=3)=>{
  await DB.prepare(`INSERT OR IGNORE INTO opr_platform_sequence(project_id,company_id,entity,next_value,updated_at) VALUES(?,?,?,1,datetime('now'))`).bind(ctx.project_id,ctx.company_id,entity).run();
  const r=await DB.prepare(`UPDATE opr_platform_sequence SET next_value=next_value+1,updated_at=datetime('now') WHERE project_id=? AND entity=? RETURNING next_value-1 AS n`).bind(ctx.project_id,entity).first();
  const n=Number(r?.n||0);if(!n)throw new Error('Falha ao reservar identificador sequencial');
  return `${prefix}-${String(n).padStart(pad,'0')}`;
};
const opxResolve=async(cfg,ref,includeArchived=false)=>{
  const raw=String(ref||'').trim();if(!raw)return null;
  return DB.prepare(`SELECT * FROM ${cfg.table} WHERE (id=? OR UPPER(display_id)=UPPER(?)) ${includeArchived?'':'AND archived_at IS NULL'}`).bind(raw,raw).first();
};
const opxAudit=async(entity,row,event)=>{if(!row)return;await DB.prepare(`INSERT INTO opr_platform_audit(company_id,project_id,entity_type,entity_id,action_type,actor,snapshot_json) VALUES(?,?,?,?,?,?,?)`).bind(row.company_id,row.project_id,entity,row.id,event,user.name||'',JSON.stringify(row)).run()};
const opxValidate=(entity,b,old={})=>{
  const merged={...old,...b};
  if(entity==='requirements'){
    if(merged.classification&&!opxEnums.requirementClass.includes(String(merged.classification)))throw new Error('Classificação de requisito inválida');
    if(merged.coverage_status&&!opxEnums.coverage.includes(String(merged.coverage_status)))throw new Error('Status de cobertura inválido');
  }
  if(entity==='tests'){
    if(merged.test_type&&!opxEnums.testType.includes(String(merged.test_type)))throw new Error('Tipo de teste inválido');
    if(merged.status&&!opxEnums.testStatus.includes(String(merged.status)))throw new Error('Status de teste inválido');
    if(merged.priority&&!opxEnums.testPriority.includes(String(merged.priority)))throw new Error('Prioridade de teste inválida');
    if(String(merged.status)==='Aprovado'&&(!(Number(merged.expected_met)===1||merged.expected_met===true)||opxBlankEvidence(merged.evidence)))throw new Error('Teste só pode ser Aprovado quando o resultado esperado estiver atendido e houver evidência');
  }
  if(entity==='defects'){
    if(merged.severity&&!opxEnums.defectSeverity.includes(String(merged.severity)))throw new Error('Severidade inválida');
    if(merged.status&&!opxEnums.defectStatus.includes(String(merged.status)))throw new Error('Status de defeito inválido');
  }
  if(entity==='integrations'){
    if(merged.status&&!opxEnums.integrationStatus.includes(String(merged.status)))throw new Error('Status de integração inválido');
    const c=String(merged.credential_ref||'');if(/(^sk-|bearer\s|api[_ -]?key\s*[:=]|token\s*[:=])/i.test(c))throw new Error('Não armazene segredo. Informe apenas o nome/referência do secret do Cloudflare.');
  }
  if(entity==='risks'&&merged.status&&!opxEnums.riskStatus.includes(String(merged.status)))throw new Error('Status de risco inválido');
  if(entity==='phases'&&merged.status&&!opxEnums.phaseStatus.includes(String(merged.status)))throw new Error('Status de fase inválido');
  if(entity==='readiness'&&merged.status&&!opxEnums.readinessStatus.includes(String(merged.status)))throw new Error('Status de readiness inválido');
  if(entity==='decisions'&&merged.status&&!opxEnums.decisionStatus.includes(String(merged.status)))throw new Error('Status de decisão inválido');
  if(entity==='documents'&&merged.status&&!opxEnums.documentStatus.includes(String(merged.status)))throw new Error('Status documental inválido');
};
const opxCreate=async(entity,cfg,ctx,b)=>{
  const required=String(b[cfg.required]||'').trim();if(!required)throw new Error(`${cfg.required} é obrigatório`);opxValidate(entity,b);
  const id=opxInternalId(cfg.tag),display=await opxTakeNumber(ctx,entity,cfg.prefix,cfg.pad||3),cols=['id','display_id','company_id','project_id'],vals=[id,display,ctx.company_id,ctx.project_id];
  for(const f of cfg.fields)if(Object.prototype.hasOwnProperty.call(b,f)){cols.push(f);vals.push((cfg.bool||[]).includes(f)?(b[f]?1:0):b[f])}
  cols.push('created_by','updated_by');vals.push(user.name||'',user.name||'');
  const q=`INSERT INTO ${cfg.table}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`;await DB.prepare(q).bind(...vals).run();const row=await opxResolve(cfg,id);await opxAudit(entity,row,'INSERT');
  if(entity==='documents')await opxAddDocumentVersion(ctx,row,{version_label:row.version_label||'v0.1',reason:'Criação do documento',url:row.url||'',hash_reference:row.hash_reference||'',content_reference:row.document_name||''});
  return row;
};
const opxPatch=async(entity,cfg,old,b)=>{
  opxValidate(entity,b,old);const sets=[],args=[];for(const f of cfg.fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(`${f}=?`);args.push((cfg.bool||[]).includes(f)?(b[f]?1:0):b[f])}
  if(!sets.length)return old;sets.push('version=version+1',"updated_at=datetime('now')",'updated_by=?');args.push(user.name||'',old.id);await DB.prepare(`UPDATE ${cfg.table} SET ${sets.join(',')} WHERE id=?`).bind(...args).run();const row=await opxResolve(cfg,old.id);await opxAudit(entity,row,'UPDATE');return row;
};
const opxAddDocumentVersion=async(ctx,doc,b)=>{
  const id=opxInternalId('DOCV');await DB.prepare(`UPDATE opr_document_versions SET is_current=0 WHERE project_id=? AND document_id=?`).bind(ctx.project_id,doc.id).run();
  await DB.prepare(`INSERT INTO opr_document_versions(id,company_id,project_id,document_id,version_label,version_date,actor,reason,content_reference,url,hash_reference,is_current) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`).bind(id,ctx.company_id,ctx.project_id,doc.id,b.version_label||doc.version_label||'v0.1',b.version_date||opxToday(),user.name||'',b.reason||'',b.content_reference||'',b.url||doc.url||'',b.hash_reference||doc.hash_reference||'').run();
  const n=await DB.prepare(`SELECT COUNT(*) n FROM opr_document_versions WHERE project_id=? AND document_id=?`).bind(ctx.project_id,doc.id).first();await DB.prepare(`UPDATE opr_documents SET version_label=?,current_version=?,url=?,hash_reference=?,version=version+1,updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(b.version_label||doc.version_label||'v0.1',Number(n?.n||1),b.url||doc.url||'',b.hash_reference||doc.hash_reference||'',user.name||'',doc.id).run();return id;
};
const opxList=async(entity,cfg,ctx,trash)=>{return (await DB.prepare(`SELECT * FROM ${cfg.table} WHERE project_id=? AND ${trash?'archived_at IS NOT NULL':'archived_at IS NULL'} ORDER BY created_at DESC`).bind(ctx.project_id).all()).results||[]};
const opxCount=async(sql,...args)=>{const r=await DB.prepare(sql).bind(...args).first();return Number(r?.n||0)};
const opxSummary=async ctx=>{
  const a=await DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN m.plan_status='Planejado' THEN 1 ELSE 0 END) planned,SUM(CASE WHEN m.plan_status='Em andamento' THEN 1 ELSE 0 END) running,SUM(CASE WHEN m.plan_status='Atrasado' OR (m.plan_status<>'Concluído' AND w.due_date IS NOT NULL AND w.due_date<>'' AND w.due_date<date('now')) THEN 1 ELSE 0 END) late,SUM(CASE WHEN m.plan_status='Concluído' THEN 1 ELSE 0 END) done,SUM(CASE WHEN m.critical_path=1 AND m.plan_status<>'Concluído' THEN 1 ELSE 0 END) critical,SUM(CASE WHEN UPPER(COALESCE(w.owner,'')) LIKE '%PENDENTE%VALIDA%' OR COALESCE(m.evidence,'')='' OR UPPER(COALESCE(m.evidence,'')) LIKE '%SEM EVID%SUFICIENTE%' THEN 1 ELSE 0 END) pending_data FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL`).bind(ctx.project_id).first()||{};
  const req=await opxCount(`SELECT COUNT(*) n FROM opr_requirements WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);
  const gaps=await opxCount(`SELECT COUNT(*) n FROM opr_requirements WHERE project_id=? AND archived_at IS NULL AND (coverage_status='Gap' OR classification IN ('DEV','INT'))`,ctx.project_id);
  const risks=await opxCount(`SELECT COUNT(*) n FROM opr_risks WHERE project_id=? AND archived_at IS NULL AND status<>'Encerrado'`,ctx.project_id);
  const criticalRisks=await opxCount(`SELECT COUNT(*) n FROM opr_risks WHERE project_id=? AND archived_at IS NULL AND status<>'Encerrado' AND UPPER(severity) IN ('CRÍTICO','CRITICO','ALTO','ALTA','SEV1')`,ctx.project_id);
  const ints=await opxCount(`SELECT COUNT(*) n FROM opr_integrations WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);
  const blockedInts=await opxCount(`SELECT COUNT(*) n FROM opr_integrations WHERE project_id=? AND archived_at IS NULL AND status='Bloqueado'`,ctx.project_id);
  const tests=await opxCount(`SELECT COUNT(*) n FROM opr_tests WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);
  const approvedTests=await opxCount(`SELECT COUNT(*) n FROM opr_tests WHERE project_id=? AND archived_at IS NULL AND status='Aprovado'`,ctx.project_id);
  const p1Blockers=await opxCount(`SELECT COUNT(*) n FROM opr_tests WHERE project_id=? AND archived_at IS NULL AND priority='P1' AND status IN ('Reprovado','Bloqueado')`,ctx.project_id);
  const defectsOpen=await opxCount(`SELECT COUNT(*) n FROM opr_test_defects WHERE project_id=? AND archived_at IS NULL AND status NOT IN ('Fechado','Cancelado')`,ctx.project_id);
  const readinessBlockers=await opxCount(`SELECT COUNT(*) n FROM opr_readiness WHERE project_id=? AND archived_at IS NULL AND blocking=1 AND status NOT IN ('Atendido','Aceito com risco')`,ctx.project_id);
  const pendingDecisions=await opxCount(`SELECT COUNT(*) n FROM opr_decisions WHERE project_id=? AND archived_at IS NULL AND status='Pendente'`,ctx.project_id);
  const documents=await opxCount(`SELECT COUNT(*) n FROM opr_documents WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);
  const phases=await opxCount(`SELECT COUNT(*) n FROM opr_implementation_phases WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);
  const total=Number(a.total||0),done=Number(a.done||0);const operationalCompletion=total?Math.round((done/total)*100):null;
  const overall=(p1Blockers||readinessBlockers)?'VERMELHO':(Number(a.late||0)||criticalRisks||blockedInts||pendingDecisions?'AMARELO':'VERDE');
  const goNoGo=p1Blockers?'NO-GO':(readinessBlockers?'NO-GO':(tests===0?'PENDENTE DE TESTES':'EM AVALIAÇÃO'));
  return {project:{id:ctx.project_id,name:ctx.project_name,company:ctx.company_name},actions:{total,planned:Number(a.planned||0),running:Number(a.running||0),late:Number(a.late||0),done,critical:Number(a.critical||0),pending_data:Number(a.pending_data||0),operational_completion_pct:operationalCompletion},requirements:{total:req,gaps},risks:{open:risks,critical:criticalRisks},integrations:{total:ints,blocked:blockedInts},tests:{total:tests,approved:approvedTests,p1_blockers:p1Blockers,open_defects:defectsOpen},readiness:{blockers:readinessBlockers},decisions:{pending:pendingDecisions},documents:{total:documents},phases:{total:phases},overall_status:overall,go_no_go:goNoGo};
};
const opxStatusReport=async ctx=>{
  const summary=await opxSummary(ctx);
  const criticalActions=(await DB.prepare(`SELECT w.id,m.display_id,w.title action,w.owner responsible,w.due_date,m.plan_status status,m.impact,m.next_step,m.evidence FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL AND m.critical_path=1 AND m.plan_status<>'Concluído' ORDER BY CASE WHEN w.due_date IS NULL THEN 1 ELSE 0 END,w.due_date LIMIT 15`).bind(ctx.project_id).all()).results||[];
  const risks=(await DB.prepare(`SELECT display_id,description,severity,owner,mitigation,status FROM opr_risks WHERE project_id=? AND archived_at IS NULL AND status<>'Encerrado' ORDER BY CASE UPPER(severity) WHEN 'CRÍTICO' THEN 0 WHEN 'CRITICO' THEN 0 WHEN 'ALTO' THEN 1 WHEN 'ALTA' THEN 1 ELSE 2 END,created_at DESC LIMIT 15`).bind(ctx.project_id).all()).results||[];
  const integrations=(await DB.prepare(`SELECT display_id,name,source_system,target_system,status,source_owner,target_owner,last_test,evidence FROM opr_integrations WHERE project_id=? AND archived_at IS NULL ORDER BY CASE status WHEN 'Bloqueado' THEN 0 WHEN 'Pronto para teste' THEN 1 WHEN 'Em desenvolvimento' THEN 2 ELSE 3 END,created_at DESC LIMIT 20`).bind(ctx.project_id).all()).results||[];
  const tests=(await DB.prepare(`SELECT display_id,test_type,scenario,priority,status,owner,evidence,block_reason FROM opr_tests WHERE project_id=? AND archived_at IS NULL ORDER BY CASE priority WHEN 'P1' THEN 0 WHEN 'P2' THEN 1 ELSE 2 END,created_at DESC LIMIT 20`).bind(ctx.project_id).all()).results||[];
  const readiness=(await DB.prepare(`SELECT display_id,category,condition_text,owner,status,evidence,blocking FROM opr_readiness WHERE project_id=? AND archived_at IS NULL ORDER BY blocking DESC,display_id`).bind(ctx.project_id).all()).results||[];
  const phases=(await DB.prepare(`SELECT display_id,phase_order,name,owner,status,gate,evidence FROM opr_implementation_phases WHERE project_id=? AND archived_at IS NULL ORDER BY phase_order`).bind(ctx.project_id).all()).results||[];
  const decisions=(await DB.prepare(`SELECT display_id,decision,owner,due_date,status,evidence FROM opr_decisions WHERE project_id=? AND archived_at IS NULL AND status='Pendente' ORDER BY due_date,created_at`).bind(ctx.project_id).all()).results||[];
  const cadence=(await DB.prepare(`SELECT period,agenda,status,result_next_step,participants,source FROM opr_cadence WHERE project_id=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 10`).bind(ctx.project_id).all()).results||[];
  return {summary,critical_actions:criticalActions,risks,integrations,tests,readiness,phases,decisions,cadence,generated_at:new Date().toISOString(),rules:{progress:'operational_completion_pct representa somente ações concluídas / total de ações; não é avanço real do projeto',go_live:'NO-GO quando existir P1 bloqueador ou item de readiness bloqueador sem atendimento/aceite formal'}};
};
const opxPhaseSeed=[
  ['Diagnóstico / levantamento','Entender contexto, objetivos, dores, restrições e operação atual'],['Requisitos','Formalizar requisitos rastreáveis e critérios'],['AS IS','Documentar processos atuais por área/cliente/operação'],['TO BE','Desenhar processo futuro validado'],['Fechamento de gaps','Classificar STD/CFG/DEV/INT e definir tratamento'],['Configuração','Parametrizar solução conforme baseline aprovada'],['Customizações','Desenvolver somente itens aprovados e rastreáveis'],['Integrações','Construir e homologar interfaces e contingências'],['Dados / Migração','Preparar, sanear, carregar e reconciliar dados'],['SIT','Validar configuração e integrações tecnicamente'],['UAT','Validar aderência funcional com usuários-chave'],['Treinamento','Preparar usuários, materiais e operação assistida'],['Cutover','Executar checklist de virada e reconciliações'],['Go/No-Go','Decidir entrada em produção com evidências'],['Go-live','Colocar operação em produção de forma controlada'],['Hypercare','Acompanhar estabilização, incidentes e ajustes'],['Encerramento','Formalizar aceite, transição e lições aprendidas']
];
const opxReadySeed=['Blueprint/processos','Requisitos','Gaps','Configurações','Customizações','Integrações','Dados','SIT','UAT','E2E','Treinamento','Defeitos','Riscos','Cutover','Contingência','Suporte','Documentação'];
const opxBootstrap=async ctx=>{
  let phases=await opxCount(`SELECT COUNT(*) n FROM opr_implementation_phases WHERE project_id=?`,ctx.project_id),ready=await opxCount(`SELECT COUNT(*) n FROM opr_readiness WHERE project_id=?`,ctx.project_id),createdPhases=0,createdReady=0;
  if(!phases){for(let i=0;i<opxPhaseSeed.length;i++){const [name,objective]=opxPhaseSeed[i];await opxCreate('phases',opxEntities.phases,ctx,{phase_order:i+1,name,objective,owner:'PENDENTE DE VALIDAÇÃO',status:'A confirmar',acceptance_criteria:'A confirmar',evidence:'Sem evidência suficiente',gate:`Gate ${String(i+1).padStart(2,'0')}`});createdPhases++}}
  if(!ready){for(const category of opxReadySeed){await opxCreate('readiness',opxEntities.readiness,ctx,{category,condition_text:'A confirmar conforme baseline e critérios de aceite do projeto',owner:'PENDENTE DE VALIDAÇÃO',status:'Pendente',evidence:'Sem evidência suficiente',blocking:0});createdReady++}}
  return {created_phases:createdPhases,created_readiness:createdReady};
};

if(path==='opr-platform/bootstrap'&&request.method==='POST'){
  if(!opxWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await opxProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);try{return json({ok:true,...await opxBootstrap(ctx)})}catch(e){return json({error:e.message||'Falha no bootstrap'},400)}
}
if(path==='opr-platform/summary'&&request.method==='GET'){const ctx=await opxProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json(await opxSummary(ctx))}
if(path==='opr-platform/status-report'&&request.method==='GET'){const ctx=await opxProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json(await opxStatusReport(ctx))}
if(path==='opr-platform/audit'&&request.method==='GET'){const ctx=await opxProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);const entity=url.searchParams.get('entity')||'',id=url.searchParams.get('id')||'';let sql='SELECT * FROM opr_platform_audit WHERE project_id=?',args=[ctx.project_id];if(entity){sql+=' AND entity_type=?';args.push(entity)}if(id){sql+=' AND entity_id=?';args.push(id)}sql+=' ORDER BY id DESC LIMIT 500';return json((await DB.prepare(sql).bind(...args).all()).results||[])}

const opxDocVerMatch=path.match(/^opr-platform\/documents\/([^/]+)\/versions$/);
if(opxDocVerMatch&&request.method==='GET'){const doc=await opxResolve(opxEntities.documents,decodeURIComponent(opxDocVerMatch[1]),true);if(!doc)return json({error:'Documento não encontrado'},404);const ctx=await opxProjectContext(doc.project_id);if(ctx.error)return json({error:ctx.error},403);return json((await DB.prepare(`SELECT * FROM opr_document_versions WHERE project_id=? AND document_id=? ORDER BY created_at DESC`).bind(ctx.project_id,doc.id).all()).results||[])}
if(opxDocVerMatch&&request.method==='POST'){if(!opxWrite)return json({error:'Sem permissão'},403);const doc=await opxResolve(opxEntities.documents,decodeURIComponent(opxDocVerMatch[1]));if(!doc)return json({error:'Documento não encontrado'},404);const ctx=await opxProjectContext(doc.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));if(!String(b.version_label||'').trim())return json({error:'Versão é obrigatória'},400);const id=await opxAddDocumentVersion(ctx,doc,b);const row=await opxResolve(opxEntities.documents,doc.id);await opxAudit('documents',row,'VERSION');return json({ok:true,id,document:row},201)}

const opxRestoreMatch=path.match(/^opr-platform\/([^/]+)\/([^/]+)\/restore$/);
if(opxRestoreMatch&&request.method==='POST'){
  if(!opxWrite)return json({error:'Sem permissão'},403);const entity=opxRestoreMatch[1],cfg=opxEntities[entity];if(!cfg)return json({error:'Módulo inválido'},404);const old=await opxResolve(cfg,decodeURIComponent(opxRestoreMatch[2]),true);if(!old)return json({error:'Registro não encontrado'},404);const ctx=await opxProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);await DB.prepare(`UPDATE ${cfg.table} SET archived_at=NULL,version=version+1,updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(user.name||'',old.id).run();const row=await opxResolve(cfg,old.id);await opxAudit(entity,row,'RESTORE');return json({ok:true,id:row.display_id})
}
const opxHistoryMatch=path.match(/^opr-platform\/([^/]+)\/([^/]+)\/history$/);
if(opxHistoryMatch&&request.method==='GET'){
  const entity=opxHistoryMatch[1],cfg=opxEntities[entity];if(!cfg)return json({error:'Módulo inválido'},404);const row=await opxResolve(cfg,decodeURIComponent(opxHistoryMatch[2]),true);if(!row)return json({error:'Registro não encontrado'},404);const ctx=await opxProjectContext(row.project_id);if(ctx.error)return json({error:ctx.error},403);return json((await DB.prepare(`SELECT * FROM opr_platform_audit WHERE project_id=? AND entity_type=? AND entity_id=? ORDER BY id DESC`).bind(ctx.project_id,entity,row.id).all()).results||[])
}
const opxItemMatch=path.match(/^opr-platform\/([^/]+)\/([^/]+)$/);
if(opxItemMatch&&(request.method==='PATCH'||request.method==='PUT'||request.method==='DELETE')){
  if(!opxWrite)return json({error:'Sem permissão'},403);const entity=opxItemMatch[1],cfg=opxEntities[entity];if(!cfg)return json({error:'Módulo inválido'},404);const old=await opxResolve(cfg,decodeURIComponent(opxItemMatch[2]));if(!old)return json({error:'Registro não encontrado'},404);const ctx=await opxProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);
  try{if(request.method==='DELETE'){await DB.prepare(`UPDATE ${cfg.table} SET archived_at=datetime('now'),version=version+1,updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(user.name||'',old.id).run();const archived=await opxResolve(cfg,old.id,true);await opxAudit(entity,archived,'SOFT_DELETE');return json({ok:true,id:old.display_id})}const b=await request.json().catch(()=>({}));const row=await opxPatch(entity,cfg,old,b);return json({ok:true,item:row})}catch(e){return json({error:e.message||'Falha ao atualizar registro'},400)}
}
const opxCollectionMatch=path.match(/^opr-platform\/([^/]+)$/);
if(opxCollectionMatch){
  const entity=opxCollectionMatch[1],cfg=opxEntities[entity];if(cfg&&request.method==='GET'){const ctx=await opxProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json(await opxList(entity,cfg,ctx,url.searchParams.get('trash')==='1'))}
  if(cfg&&request.method==='POST'){if(!opxWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await opxProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);try{const row=await opxCreate(entity,cfg,ctx,b);return json({ok:true,item:row},201)}catch(e){return json({error:e.message||'Falha ao criar registro'},400)}}
}
