// MADRI PMO — endpoint público somente leitura para o Status Report Executivo.
// Não expõe comentários, histórico de usuário, credenciais, horas ou dados de outros tenants.
if(path==='public-madri-pmo-report'&&request.method==='GET'){
  const mpPubNorm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const companies=(await DB.prepare('SELECT id,name FROM companies').all()).results||[];
  const matches=companies.filter(r=>['madrid','madri'].includes(mpPubNorm(r.id))||['madrid','madri'].includes(mpPubNorm(r.name)));
  if(matches.length!==1)return json({error:'Contexto MADRI indisponível ou ambíguo'},409);
  const company=matches[0];
  const projects=(await DB.prepare('SELECT id,name FROM projects WHERE company_id=? ORDER BY id').bind(company.id).all()).results||[];
  const project=projects.find(p=>/nucci/i.test(String(p.name||'')))||projects.find(p=>/madri|madrid/i.test(String(p.name||'')))||projects[0]||null;
  const actions=(await DB.prepare("SELECT id,front,title,owner,start_date,due_date,CASE WHEN due_date IS NOT NULL AND due_date<>'' AND date(due_date)<date('now') AND status<>'Concluído' THEN 'Atrasado' ELSE status END AS status,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,item_type,version,updated_at FROM work_items WHERE company_id=? AND pmo_scope='MADRI_NUCCI' AND archived_at IS NULL ORDER BY critical_path DESC,COALESCE(due_date,'9999-12-31'),rank,id").bind(company.id).all()).results||[];
  let cadence=[];try{cadence=(await DB.prepare('SELECT id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref,updated_at FROM madri_pmo_cadence WHERE company_id=? AND archived_at IS NULL ORDER BY period,id').bind(company.id).all()).results||[]}catch(e){cadence=[]}
  let roles=[];try{roles=(await DB.prepare('SELECT front,role_type,person_name,evidence,status FROM madri_pmo_roles WHERE company_id=? AND archived_at IS NULL ORDER BY front,role_type').bind(company.id).all()).results||[]}catch(e){roles=[]}
  const statuses=['Planejado','Em andamento','Atrasado','Concluído'];
  const counts=Object.fromEntries(statuses.map(s=>[s,actions.filter(a=>a.status===s).length]));
  const critical=actions.filter(a=>Number(a.critical_path)===1&&a.status!=='Concluído');
  const attentions=[];
  for(const a of actions){
    if(a.status==='Atrasado')attentions.push({theme:a.front||'Plano Mestre',situation:'Atrasado',impact:a.impact_text||'Não informado',responsible:a.owner||'PENDENTE DE VALIDAÇÃO',due:a.due_date||'A confirmar',next_action:a.next_step||'A confirmar',action_id:a.id});
    if(!a.owner||a.owner==='PENDENTE DE VALIDAÇÃO')attentions.push({theme:a.front||'Plano Mestre',situation:'Responsável pendente',impact:a.impact_text||'Não informado',responsible:'PENDENTE DE VALIDAÇÃO',due:a.due_date||'A confirmar',next_action:a.next_step||'A confirmar',action_id:a.id});
    if(!a.due_date&&a.status!=='Concluído')attentions.push({theme:a.front||'Plano Mestre',situation:'Prazo pendente',impact:a.impact_text||'Não informado',responsible:a.owner||'PENDENTE DE VALIDAÇÃO',due:'A confirmar',next_action:a.next_step||'A confirmar',action_id:a.id});
  }
  cadence.filter(c=>c.status==='A confirmar').forEach(c=>attentions.push({theme:'Cadência',situation:`${c.agenda}: A confirmar`,impact:'Sem evidência suficiente',responsible:'PENDENTE DE VALIDAÇÃO',due:c.period||'A confirmar',next_action:c.result_next_step||'A confirmar',action_id:c.action_id||''}));
  return json({
    project:{company_id:String(company.id),company_name:company.name,project_id:project?.id||null,project_name:project?.name||'Implantação NUCCI ERP'},
    status_general:'ATENÇÃO',
    baseline:{progress:'PENDENTE DE VALIDAÇÃO',go_live:'A confirmar'},
    counts,total:actions.length,actions,critical,attentions:attentions.slice(0,40),cadence,roles,
    source_of_truth:'Plano Mestre MADRI / work_items[pmo_scope=MADRI_NUCCI]',
    generated_at:new Date().toISOString()
  });
}
