// OPR Status Report permanente — visão executiva derivada da base operacional.
const oprrNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const oprrCanScope=companyId=>!scope||String(scope)===String(companyId);
const oprrProject=async projectId=>{
  if(!projectId&&projectId!==0)return {error:'Projeto OPR é obrigatório'};
  const r=await DB.prepare(`SELECT p.id project_id,p.name project_name,p.company_id,c.name company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id=?`).bind(projectId).first();
  if(!r)return {error:'Projeto não encontrado'};
  if(!oprrCanScope(r.company_id))return {error:'Projeto fora do escopo do usuário'};
  if(!oprrNorm(r.company_name).includes('opr'))return {error:'Endpoint exclusivo da OPR'};
  return r;
};
const oprrCount=async(sql,...args)=>Number((await DB.prepare(sql).bind(...args).first())?.n||0);

if(path==='opr-platform/status-report'&&request.method==='GET'){
  const ctx=await oprrProject(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);
  const a=await DB.prepare(`SELECT COUNT(*) total,
    SUM(CASE WHEN m.plan_status='Planejado' THEN 1 ELSE 0 END) planned,
    SUM(CASE WHEN m.plan_status='Em andamento' THEN 1 ELSE 0 END) running,
    SUM(CASE WHEN m.plan_status='Atrasado' OR (m.plan_status<>'Concluído' AND w.due_date IS NOT NULL AND w.due_date<>'' AND w.due_date<date('now')) THEN 1 ELSE 0 END) late,
    SUM(CASE WHEN m.plan_status='Concluído' THEN 1 ELSE 0 END) done,
    SUM(CASE WHEN m.critical_path=1 AND m.plan_status<>'Concluído' THEN 1 ELSE 0 END) critical,
    SUM(CASE WHEN UPPER(COALESCE(w.owner,'')) LIKE '%PENDENTE%VALIDA%' OR COALESCE(m.evidence,'')='' OR UPPER(COALESCE(m.evidence,'')) LIKE '%SEM EVID%SUFICIENTE%' THEN 1 ELSE 0 END) pending_data
    FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id
    WHERE w.project_id=? AND w.company_id=? AND w.archived_at IS NULL`).bind(ctx.project_id,ctx.company_id).first()||{};
  const total=Number(a.total||0),done=Number(a.done||0),operational=total?Math.round(done*100/total):null;
  const reqTotal=await oprrCount(`SELECT COUNT(*) n FROM opr_requirements WHERE project_id=? AND company_id=? AND archived_at IS NULL`,ctx.project_id,ctx.company_id);
  const reqGaps=await oprrCount(`SELECT COUNT(*) n FROM opr_requirements WHERE project_id=? AND company_id=? AND archived_at IS NULL AND (coverage_status='Gap' OR classification IN ('DEV','INT'))`,ctx.project_id,ctx.company_id);
  const riskOpen=await oprrCount(`SELECT COUNT(*) n FROM opr_risks WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status<>'Encerrado'`,ctx.project_id,ctx.company_id);
  const riskCritical=await oprrCount(`SELECT COUNT(*) n FROM opr_risks WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status<>'Encerrado' AND UPPER(severity) IN ('CRÍTICO','CRITICO','ALTO','ALTA','SEV1')`,ctx.project_id,ctx.company_id);
  const intTotal=await oprrCount(`SELECT COUNT(*) n FROM opr_integrations WHERE project_id=? AND company_id=? AND archived_at IS NULL`,ctx.project_id,ctx.company_id);
  const intBlocked=await oprrCount(`SELECT COUNT(*) n FROM opr_integrations WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status='Bloqueado'`,ctx.project_id,ctx.company_id);
  const testTotal=await oprrCount(`SELECT COUNT(*) n FROM opr_tests WHERE project_id=? AND company_id=? AND archived_at IS NULL`,ctx.project_id,ctx.company_id);
  const testApproved=await oprrCount(`SELECT COUNT(*) n FROM opr_tests WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status='Aprovado'`,ctx.project_id,ctx.company_id);
  const p1=await oprrCount(`SELECT COUNT(*) n FROM opr_tests WHERE project_id=? AND company_id=? AND archived_at IS NULL AND priority='P1' AND status IN ('Reprovado','Bloqueado')`,ctx.project_id,ctx.company_id);
  const defects=await oprrCount(`SELECT COUNT(*) n FROM opr_test_defects WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status NOT IN ('Fechado','Cancelado')`,ctx.project_id,ctx.company_id);
  const readyBlock=await oprrCount(`SELECT COUNT(*) n FROM opr_readiness WHERE project_id=? AND company_id=? AND archived_at IS NULL AND blocking=1 AND status NOT IN ('Atendido','Aceito com risco')`,ctx.project_id,ctx.company_id);
  const pendingDec=await oprrCount(`SELECT COUNT(*) n FROM opr_decisions WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status='Pendente'`,ctx.project_id,ctx.company_id);
  const criticalActions=(await DB.prepare(`SELECT w.id,m.display_id,w.title action,w.owner responsible,w.due_date,m.plan_status status,m.impact,m.next_step,m.evidence
    FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id
    WHERE w.project_id=? AND w.company_id=? AND w.archived_at IS NULL AND m.plan_status<>'Concluído'
      AND (m.critical_path=1 OR m.plan_status='Atrasado' OR (w.due_date IS NOT NULL AND w.due_date<>'' AND w.due_date<date('now')))
    ORDER BY CASE WHEN m.plan_status='Atrasado' THEN 0 WHEN m.critical_path=1 THEN 1 ELSE 2 END,CASE WHEN w.due_date IS NULL THEN 1 ELSE 0 END,w.due_date LIMIT 15`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const decisions=(await DB.prepare(`SELECT display_id,decision,owner,due_date,status,evidence,action_id FROM opr_decisions WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status='Pendente' ORDER BY due_date,created_at LIMIT 15`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const risks=(await DB.prepare(`SELECT display_id,description,severity,owner,mitigation,status,action_id FROM opr_risks WHERE project_id=? AND company_id=? AND archived_at IS NULL AND status<>'Encerrado' ORDER BY CASE UPPER(severity) WHEN 'CRÍTICO' THEN 0 WHEN 'CRITICO' THEN 0 WHEN 'ALTO' THEN 1 WHEN 'ALTA' THEN 1 ELSE 2 END,created_at DESC LIMIT 15`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const integrations=(await DB.prepare(`SELECT display_id,name,source_system,target_system,status,source_owner,target_owner,last_test,evidence FROM opr_integrations WHERE project_id=? AND company_id=? AND archived_at IS NULL ORDER BY CASE status WHEN 'Bloqueado' THEN 0 WHEN 'Pronto para teste' THEN 1 WHEN 'Em desenvolvimento' THEN 2 ELSE 3 END,created_at DESC LIMIT 15`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const tests=(await DB.prepare(`SELECT display_id,test_type,scenario,priority,status,owner,evidence,block_reason,action_id FROM opr_tests WHERE project_id=? AND company_id=? AND archived_at IS NULL ORDER BY CASE priority WHEN 'P1' THEN 0 WHEN 'P2' THEN 1 ELSE 2 END,created_at DESC LIMIT 20`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const readiness=(await DB.prepare(`SELECT display_id,category,condition_text,owner,status,evidence,blocking,action_id FROM opr_readiness WHERE project_id=? AND company_id=? AND archived_at IS NULL ORDER BY blocking DESC,display_id LIMIT 20`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const phases=(await DB.prepare(`SELECT display_id,phase_order,name,input_text,owner,status,gate,dependencies,evidence FROM opr_implementation_phases WHERE project_id=? AND company_id=? AND archived_at IS NULL ORDER BY phase_order`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const cadence=(await DB.prepare(`SELECT period,agenda,objective,status,result_next_step,participants,source FROM opr_cadence WHERE project_id=? AND company_id=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 15`).bind(ctx.project_id,ctx.company_id).all()).results||[];
  const overall=(p1||readyBlock)?'VERMELHO':(Number(a.late||0)||riskCritical||intBlocked||pendingDec?'AMARELO':'VERDE');
  const goNoGo=(p1||readyBlock)?'NO-GO':(testTotal===0?'PENDENTE DE TESTES':'EM AVALIAÇÃO');
  const summary={project:{id:ctx.project_id,name:ctx.project_name,company:ctx.company_name},actions:{total,planned:Number(a.planned||0),running:Number(a.running||0),late:Number(a.late||0),done,critical:Number(a.critical||0),pending_data:Number(a.pending_data||0),operational_completion_pct:operational},requirements:{total:reqTotal,gaps:reqGaps},risks:{open:riskOpen,critical:riskCritical},integrations:{total:intTotal,blocked:intBlocked},tests:{total:testTotal,approved:testApproved,p1_blockers:p1,open_defects:defects},readiness:{blockers:readyBlock},decisions:{pending:pendingDec},overall_status:overall,go_no_go:goNoGo};
  return json({summary,critical_actions:criticalActions,decisions,risks,integrations,tests,readiness,phases:phases.map(x=>({...x,period:'A confirmar',next_step:x.gate||'A confirmar'})),cadence,generated_at:new Date().toISOString(),rules:{progress:'O percentual exibido representa somente ações concluídas / total de ações e não é avanço real do projeto.',go_live:'NO-GO quando existir teste P1 bloqueador ou item de readiness bloqueador sem atendimento/aceite formal.'},source_of_truth:'opr_action_meta + work_items; demais módulos somente complementam contexto rastreável da OPR'});
}
