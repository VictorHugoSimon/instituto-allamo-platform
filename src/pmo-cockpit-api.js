// PMO Cockpit Executivo 2.0 — endpoint consolidado, somente leitura.
// Este arquivo é injetado no Worker pelo hardening dedicado do PMO.
const pcNorm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const pcDone=s=>['completo','concluido','done','completed'].includes(pcNorm(s));
const pcCancelled=s=>['cancelado','cancelled'].includes(pcNorm(s));
const pcBacklog=s=>['backlog','planejado','planned'].includes(pcNorm(s));
const pcRunning=s=>['em andamento','in progress','doing','started'].includes(pcNorm(s));
const pcCritical=v=>/critico|vermelho|critical|red/.test(pcNorm(v));
const pcAttention=v=>/atencao|amarelo|attention|yellow/.test(pcNorm(v));
const pcHealthy=v=>/verde|saudavel|estavel|no ritmo|green|healthy|stable|ok/.test(pcNorm(v));
const pcDate=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):'';

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

  return json({
    generated_at:new Date().toISOString(),
    source:'D1',
    portfolio,
    health,
    projects:details
  });
}
