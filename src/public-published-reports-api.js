// Reports nativos publicados no link público do cliente (sem login).
const publicSanitizeReportData=data=>{
  const d=data&&typeof data==='object'?JSON.parse(JSON.stringify(data)):{};
  if(Array.isArray(d.custom_sections))d.custom_sections=d.custom_sections.filter(s=>s?.client_visible!==false).map(s=>({...s,fields:Array.isArray(s.fields)?s.fields.filter(f=>f?.client_visible!==false):[]}));
  if(Array.isArray(d.sections))d.sections=d.sections.filter(s=>s?.client_visible!==false).map(s=>({...s,fields:Array.isArray(s.fields)?s.fields.filter(f=>f?.client_visible!==false&&f?.visible!==false):[]}));
  if(d._milestone_evidence&&typeof d._milestone_evidence==='object')d._milestone_evidence={...d._milestone_evidence,assets:Array.isArray(d._milestone_evidence.assets)?d._milestone_evidence.assets.filter(a=>Number(a?.client_visible??1)!==0):[]};
  if(d.live_task_board&&typeof d.live_task_board==='object'){const b=d.live_task_board;b.lanes=Array.isArray(b.lanes)?b.lanes.filter(l=>l?.client_visible!==false).map(l=>({...l,tasks:Array.isArray(l.tasks)?l.tasks.filter(t=>t?.client_visible!==false):[]})):[]}
  if(d.executive_report&&typeof d.executive_report==='object')for(const k of Object.keys(d.executive_report))if(Array.isArray(d.executive_report[k]))d.executive_report[k]=d.executive_report[k].filter(x=>x?.client_visible!==false);
  delete d.ai_audit;delete d._history;return d;
};
if(path==='public-published-reports'&&request.method==='GET'){
  const cid=url.searchParams.get('company'),pid=url.searchParams.get('project');
  if(!cid)return json({error:'Informe a empresa'},400);
  const co=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(cid).first();if(!co)return json({error:'Empresa não encontrada'},404);
  const cond=['r.company_id=?',"r.status='PUBLICADO'",'r.archived_at IS NULL'],args=[cid];if(pid){const p=await DB.prepare('SELECT id,company_id FROM projects WHERE id=?').bind(pid).first();if(!p||String(p.company_id)!==String(cid))return json({error:'Projeto não pertence à empresa'},404);cond.push('r.project_id=?');args.push(pid)}
  const rows=(await DB.prepare("SELECT r.id,r.company_id,r.project_id,r.title,r.reference,r.status,r.executive_summary,r.published_at,r.updated_at,p.name AS project_name,x.series_id,x.cycle_no,x.period_start,x.period_end,x.presentation_date FROM report_records r LEFT JOIN projects p ON p.id=r.project_id AND p.company_id=r.company_id LEFT JOIN report_series_cycles x ON x.report_id=r.id WHERE "+cond.join(' AND ')+" ORDER BY COALESCE(x.cycle_no,0) DESC,COALESCE(r.published_at,r.updated_at) DESC").bind(...args).all()).results||[];
  return json(rows);
}
if(path.match(/^public-published-reports\/[^/]+$/)&&request.method==='GET'){
  const cid=url.searchParams.get('company'),pid=url.searchParams.get('project');if(!cid)return json({error:'Informe a empresa'},400);
  const id=decodeURIComponent(path.split('/')[1]);
  const r=await DB.prepare("SELECT * FROM report_records WHERE id=? AND company_id=? AND status='PUBLICADO' AND archived_at IS NULL").bind(id,cid).first();if(!r)return json({error:'Report publicado não encontrado'},404);
  if(pid&&String(r.project_id||'')!==String(pid))return json({error:'Report não pertence ao projeto selecionado'},404);
  let data={};try{data=publicSanitizeReportData(JSON.parse(r.data_json||'{}'))}catch(_){}
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(cid).first();if(!company)return json({error:'Empresa não encontrada'},404);
  const project=r.project_id?await DB.prepare('SELECT id,name,company_id FROM projects WHERE id=? AND company_id=?').bind(r.project_id,cid).first():null;if(r.project_id&&!project)return json({error:'Contexto do projeto inválido'},403);
  data.client=company.name;if(data.tap&&typeof data.tap==='object')data.tap.cliente=company.name;
  const cycle=await DB.prepare('SELECT series_id,cycle_no,period_start,period_end,presentation_date,previous_cycle_id,status FROM report_series_cycles WHERE report_id=? LIMIT 1').bind(id).first();
  if(cycle)data._series={...(data._series||{}),...cycle};
  const roadmap=(await DB.prepare("SELECT id,title,description,responsible_party,responsible_name,external_party,status,start_date,due_date,progress FROM report_roadmap_items WHERE report_id=? AND company_id=? AND archived_at IS NULL ORDER BY rank ASC,created_at ASC").bind(id,cid).all()).results||[];
  return json({...r,data,company,project,roadmap,cycle});
}
