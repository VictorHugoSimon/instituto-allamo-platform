// PMO Cockpit Executivo 2.0 — endpoint consolidado, somente leitura.
// Este arquivo é injetado no Worker pelo hardening dedicado do PMO.
const pcNorm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const pcDone=s=>['completo','concluido','done','completed'].includes(pcNorm(s));
const pcCancelled=s=>['cancelado','cancelled'].includes(pcNorm(s));
const pcBacklog=s=>['backlog','planejado','planned'].includes(pcNorm(s));
const pcRunning=s=>['em andamento','in progress','doing','started'].includes(pcNorm(s));
const pcClosed=s=>['completo','concluido','done','completed','cancelado','cancelled','fechado','closed'].includes(pcNorm(s));
const pcCritical=v=>/critico|vermelho|critical|red/.test(pcNorm(v));
const pcAttention=v=>/atencao|amarelo|attention|yellow/.test(pcNorm(v));
const pcHealthy=v=>/verde|saudavel|estavel|no ritmo|green|healthy|stable|ok/.test(pcNorm(v));
const pcDate=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):'';
const pcMetric=(available,value,reason='')=>({available:!!available,value:available?value:null,reason:available?'':reason||'Fonte não disponível neste ambiente.'});
const pcSafeAll=async(sql,args=[])=>{try{const stmt=DB.prepare(sql);const r=args.length?await stmt.bind(...args).all():await stmt.all();return{available:true,rows:r.results||[]}}catch{return{available:false,rows:[]}}};
const pcSafeFirst=async(sql,args=[])=>{try{const stmt=DB.prepare(sql);const r=args.length?await stmt.bind(...args).first():await stmt.first();return{available:true,row:r||null}}catch{return{available:false,row:null}}};

if(path==='pmo-cockpit'&&request.method==='GET'){
  if(!['admin','pmo'].includes(user.role))return json({error:'Sem permissão'},403);

  const today=new Date().toISOString().slice(0,10);
  const projectWhere=scope?' WHERE p.company_id=?':'';
  const projectArgs=scope?[String(scope)]:[];
  const companyWhere=scope?' WHERE id=?':'';
  const companyArgs=scope?[String(scope)]:[];
  const reportWhere=scope?' WHERE p.company_id=?':'';
  const reportArgs=scope?[String(scope)]:[];

  const [companiesResult,projectsResult,reportsResult]=await Promise.all([
    DB.prepare('SELECT id,name,status_text,progress FROM companies'+companyWhere).bind(...companyArgs).all(),
    DB.prepare('SELECT p.id,p.name,p.company_id,c.name AS company_name,p.status,p.badge,p.urgency,p.meta_date,p.pmo_read,p.lead FROM projects p LEFT JOIN companies c ON c.id=p.company_id'+projectWhere+' ORDER BY c.name,p.name,p.id').bind(...projectArgs).all(),
    DB.prepare('SELECT r.project_id,r.updated_at,r.updated_by,r.ref FROM project_reports_p r JOIN projects p ON p.id=r.project_id'+reportWhere).bind(...reportArgs).all()
  ]);

  const companies=companiesResult.results||[];
  const projects=projectsResult.results||[];
  const reports=reportsResult.results||[];
  const reportByProject=new Map(reports.map(r=>[String(r.project_id),r]));

  const portfolio={companies:companies.length,projects:projects.length,active:0,in_progress:0,backlog:0,completed:0,cancelled:0,delayed:0,at_risk:0};
  const health={green:0,yellow:0,red:0,stale:0,not_applicable:0};
  const details=[];

  for(const p of projects){
    const status=pcNorm(p.status||p.badge);
    const done=pcDone(status),cancelled=pcCancelled(status),backlog=pcBacklog(status),running=pcRunning(status)||pcNorm(p.badge)==='started';
    const meta=pcDate(p.meta_date);
    const delayed=!!meta&&meta<today&&!done&&!cancelled;
    const report=reportByProject.get(String(p.id))||null;
    const critical=pcCritical(p.pmo_read);
    const attention=pcAttention(p.pmo_read);

    if(!done&&!cancelled)portfolio.active++;
    if(running)portfolio.in_progress++;
    if(backlog)portfolio.backlog++;
    if(done)portfolio.completed++;
    if(cancelled)portfolio.cancelled++;
    if(delayed)portfolio.delayed++;
    if(critical||attention)portfolio.at_risk++;

    let h='not_applicable';
    if(!done&&!cancelled&&!backlog){
      if(delayed||critical)h='red';
      else if(attention)h='yellow';
      else if(!report)h='stale';
      else if(pcHealthy(p.pmo_read))h='green';
      else h='stale';
    }
    health[h]++;

    details.push({
      id:p.id,name:p.name,company_id:p.company_id,company_name:p.company_name||'',status:p.status||'',pmo_read:p.pmo_read||'',meta_date:p.meta_date||'',lead:p.lead||'',
      delayed,health:h,last_report_at:report?.updated_at||null,last_report_by:report?.updated_by||null,report_ref:report?.ref||null
    });
  }

  const scopeJoin=scope?' AND p.company_id=?':'';
  const scopeArgs=scope?[String(scope)]:[];
  const [workSource,sprintSource,linkSource,decisionSource,eventSource,sprintDocSource,workEventSource,fchStateSource]=await Promise.all([
    pcSafeAll(`SELECT w.id,w.project_id,w.item_type,w.title,w.status,w.priority,w.owner,w.due_date,w.blocked,w.blocked_reason,w.estimate_hours FROM work_items w JOIN projects p ON p.id=w.project_id WHERE w.archived_at IS NULL${scopeJoin}`,scopeArgs),
    pcSafeAll(`SELECT s.id,s.project_id,s.name,s.status,s.capacity_hours,s.start_date,s.end_date FROM work_sprints s JOIN projects p ON p.id=s.project_id WHERE 1=1${scopeJoin}`,scopeArgs),
    pcSafeAll(`SELECT l.source_item_id,l.target_item_id,l.link_type FROM work_links l JOIN work_items w ON w.id=l.source_item_id JOIN projects p ON p.id=w.project_id WHERE w.archived_at IS NULL${scopeJoin}`,scopeArgs),
    pcSafeAll(`SELECT d.id,d.project_id,d.title,d.owner_name,d.due_date,d.status FROM governance_event_decisions d JOIN projects p ON p.id=d.project_id WHERE d.archived_at IS NULL${scopeJoin}`,scopeArgs),
    pcSafeAll(`SELECT g.id,g.project_id,g.event_type,g.title,g.start_at,g.status FROM governance_events g JOIN projects p ON p.id=g.project_id WHERE g.archived_at IS NULL AND g.start_at IS NOT NULL AND substr(g.start_at,1,10)>=?${scopeJoin} ORDER BY g.start_at ASC LIMIT 10`,[today,...scopeArgs]),
    pcSafeAll(`SELECT s.id,s.project_id,s.document_type,s.status,s.score,s.critical_pending,s.decision,s.updated_at FROM sprint_documents s JOIN projects p ON CAST(p.id AS TEXT)=CAST(s.project_id AS TEXT) WHERE s.archived_at IS NULL${scopeJoin}`,scopeArgs),
    pcSafeFirst(`SELECT COUNT(*) AS total,MAX(e.created_at) AS last_event_at FROM work_events e JOIN projects p ON p.id=e.project_id WHERE 1=1${scopeJoin}`,scopeArgs),
    pcSafeFirst("SELECT last_run,detail FROM sync_state WHERE source='fch-drive'")
  ]);

  const workItems=workSource.rows||[];
  const openWork=workItems.filter(w=>!pcClosed(w.status));
  const blockedItems=openWork.filter(w=>Number(w.blocked||0)===1);
  const overdueActions=openWork.filter(w=>{const due=pcDate(w.due_date);return !!due&&due<today});
  const dependencies=(linkSource.rows||[]).filter(l=>/depend/.test(pcNorm(l.link_type)));
  const openDecisions=(decisionSource.rows||[]).filter(d=>!pcClosed(d.status));
  const criticalProjects=details.filter(p=>pcCritical(p.pmo_read));

  const management={
    blocked_items:pcMetric(workSource.available,blockedItems.length),
    overdue_actions:pcMetric(workSource.available,overdueActions.length),
    dependencies:pcMetric(linkSource.available,dependencies.length),
    open_decisions:pcMetric(decisionSource.available,openDecisions.length),
    critical_projects:pcMetric(true,criticalProjects.length),
    structured_critical_risks:pcMetric(false,null,'Registro genérico estruturado de riscos críticos ainda não está disponível no domínio PMO; não será inferido de texto livre.')
  };

  const plannedHours=workItems.reduce((sum,w)=>sum+(Number.isFinite(Number(w.estimate_hours))?Number(w.estimate_hours):0),0);
  const activeSprints=(sprintSource.rows||[]).filter(s=>!pcClosed(s.status));
  const sprintCapacityHours=activeSprints.reduce((sum,s)=>sum+(Number.isFinite(Number(s.capacity_hours))?Number(s.capacity_hours):0),0);

  let fchMap={};
  let fchLastRun=null;
  if(fchStateSource.available&&fchStateSource.row){
    fchLastRun=fchStateSource.row.last_run||null;
    try{const detail=JSON.parse(fchStateSource.row.detail||'{}');fchMap=detail?.target_project_map&&typeof detail.target_project_map==='object'?detail.target_project_map:{}}catch{fchMap={}}
  }
  const projectIds=new Set(details.map(p=>String(p.id)));
  const validTargets=Object.entries(fchMap).filter(([,pid])=>projectIds.has(String(pid)));
  let actualHoursMetric;
  let peopleActualMetric;
  let actualByProject=[];
  if(projects.length===0){
    actualHoursMetric=pcMetric(true,0);
    peopleActualMetric=pcMetric(true,0);
  }else if(!fchStateSource.available||!fchStateSource.row||!validTargets.length){
    actualHoursMetric=pcMetric(false,null,'FCH sem sincronização/mapeamento válido para os projetos atuais.');
    peopleActualMetric=pcMetric(false,null,'FCH sem sincronização/mapeamento válido para os projetos atuais.');
  }else{
    const targetNames=validTargets.map(([target])=>target);
    const placeholders=targetNames.map(()=>'?').join(',');
    const fchRowsSource=await pcSafeAll(`SELECT source_entry_hash,target_project,person,hours FROM fch_entries WHERE target_project IN (${placeholders})`,targetNames);
    if(!fchRowsSource.available){
      actualHoursMetric=pcMetric(false,null,'Tabela FCH indisponível neste ambiente.');
      peopleActualMetric=pcMetric(false,null,'Tabela FCH indisponível neste ambiente.');
    }else{
      const rows=fchRowsSource.rows||[];
      const uniqueHours=new Map();
      const people=new Set();
      const perProject=new Map();
      const targetToProject=new Map(validTargets.map(([target,pid])=>[target,String(pid)]));
      for(const row of rows){
        const hours=Number(row.hours)||0;
        const hash=String(row.source_entry_hash||'');
        if(hash)uniqueHours.set(hash,Math.max(uniqueHours.get(hash)||0,hours));
        if(String(row.person||'').trim())people.add(String(row.person).trim());
        const pid=targetToProject.get(String(row.target_project||''));
        if(pid)perProject.set(pid,(perProject.get(pid)||0)+hours);
      }
      const total=[...uniqueHours.values()].reduce((a,b)=>a+b,0);
      actualHoursMetric=pcMetric(true,+total.toFixed(2));
      peopleActualMetric=pcMetric(true,people.size);
      actualByProject=[...perProject.entries()].map(([project_id,hours])=>({project_id,hours:+hours.toFixed(2)}));
    }
  }

  const capacity={
    planned_hours:pcMetric(workSource.available,+plannedHours.toFixed(2)),
    sprint_capacity_hours:pcMetric(sprintSource.available,+sprintCapacityHours.toFixed(2)),
    actual_hours:actualHoursMetric,
    people_with_actual_hours:peopleActualMetric,
    utilization:pcMetric(false,null,'Não existe capacidade individual contratada/disponível por profissional para calcular utilização sem inventar denominador.'),
    actual_by_project:actualByProject,
    fch_last_run:fchLastRun,
    no_double_count_rule:'Horas realizadas consolidadas são deduplicadas por source_entry_hash; alocações por projeto permanecem analíticas.'
  };

  const sprintDocs=sprintDocSource.rows||[];
  const dorDocs=sprintDocs.filter(d=>String(d.document_type)==='DOR');
  const dodDocs=sprintDocs.filter(d=>String(d.document_type)==='DOD');
  const criticalPending=sprintDocs.reduce((sum,d)=>sum+(Number(d.critical_pending)||0),0);
  const latestReportAt=reports.map(r=>r.updated_at).filter(Boolean).sort().at(-1)||null;
  const nextRites=(eventSource.rows||[]).filter(e=>!pcClosed(e.status)).slice(0,5).map(e=>({id:e.id,project_id:e.project_id,event_type:e.event_type,title:e.title,start_at:e.start_at,status:e.status}));
  const governance={
    latest_report_at:pcMetric(!!latestReportAt,latestReportAt,'Nenhum Status Report disponível para o portfólio atual.'),
    projects_without_report:pcMetric(true,details.filter(p=>!p.last_report_at).length),
    report_freshness_policy:pcMetric(false,null,'Não há SLA/limiar de atualização de Status Report configurado; não será criado um prazo arbitrário.'),
    dor_documents:pcMetric(sprintDocSource.available,dorDocs.length),
    dod_documents:pcMetric(sprintDocSource.available,dodDocs.length),
    critical_pending:pcMetric(sprintDocSource.available,criticalPending),
    next_rites:{available:eventSource.available,items:eventSource.available?nextRites:[],reason:eventSource.available?'':'Agenda de governança não disponível neste ambiente.'}
  };

  const workEventTotal=Number(workEventSource.row?.total||0);
  const adoption={
    heatmap:pcMetric(false,null,'Telemetria global de uso ainda não está integrada; mapa de calor permanece preparado, sem eventos fictícios.'),
    work_management_events:pcMetric(workEventSource.available,workEventTotal),
    last_work_management_event_at:pcMetric(workEventSource.available&&!!workEventSource.row?.last_event_at,workEventSource.row?.last_event_at||null,'Nenhum evento operacional de Work Management disponível.'),
    scope_note:'Eventos de Work Management são operacionais e não equivalem à telemetria global de adoção.'
  };

  return json({
    generated_at:new Date().toISOString(),
    source:'D1',
    portfolio,
    health,
    management,
    capacity,
    governance,
    adoption,
    projects:details,
    sources:{
      work_management:workSource.available,
      work_sprints:sprintSource.available,
      dependencies:linkSource.available,
      governance_decisions:decisionSource.available,
      governance_events:eventSource.available,
      sprint_governance:sprintDocSource.available,
      work_events:workEventSource.available,
      fch_state:fchStateSource.available
    }
  });
}
