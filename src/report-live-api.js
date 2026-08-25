// Report vivo — criação de nova edição preservando tenant, conteúdo e roadmap.
const lrWrite=['admin','pmo','techlead'].includes(user.role);
const lrId=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,5).toUpperCase();
const lrParse=s=>{try{return JSON.parse(s||'{}')}catch(_){return {}}};
const lrScoped=id=>!scope||String(id)===String(scope);
const lrReport=async id=>DB.prepare("SELECT * FROM report_records WHERE id=? AND archived_at IS NULL").bind(id).first();
const lrSnapshot=async(reportId,note)=>{
  const r=await lrReport(reportId);if(!r)return;
  const road=(await DB.prepare("SELECT * FROM report_roadmap_items WHERE report_id=? AND archived_at IS NULL ORDER BY rank ASC,created_at ASC").bind(reportId).all()).results||[];
  const n=await DB.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM report_versions WHERE report_id=?').bind(reportId).first();
  await DB.prepare('INSERT INTO report_versions(report_id,company_id,project_id,version_no,snapshot_json,change_note,created_by) VALUES(?,?,?,?,?,?,?)')
    .bind(reportId,r.company_id,r.project_id||null,Number(n?.n||1),JSON.stringify({report:{...r,data:lrParse(r.data_json)},roadmap:road}),note||'Atualização',user.name).run();
};

if(path.match(/^report-records\/[^/]+\/duplicate$/)&&request.method==='POST'){
  if(!lrWrite)return json({error:'Sem permissão para criar nova edição'},403);
  const sourceId=decodeURIComponent(path.split('/')[1]),src=await lrReport(sourceId);
  if(!src)return json({error:'Report de origem não encontrado'},404);
  if(!lrScoped(src.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json().catch(()=>({}));
  if(src.project_id){const p=await DB.prepare('SELECT id,company_id FROM projects WHERE id=?').bind(src.project_id).first();if(!p||String(p.company_id)!==String(src.company_id))return json({error:'Contexto empresa/projeto inválido'},409)}
  const id=lrId('RPT');
  const data=lrParse(src.data_json);data._edition={...(data._edition||{}),previous_report_id:sourceId,created_from:'duplicate',created_at:new Date().toISOString()};
  if(data._series&&typeof data._series==='object')data._series={...data._series,previous_report_id:sourceId,cycle_no:null};
  const title=String(b.title||src.title||'Status Report').trim();
  const reference=Object.prototype.hasOwnProperty.call(b,'reference')?String(b.reference||''):String(src.reference||'');
  const summary=Object.prototype.hasOwnProperty.call(b,'executive_summary')?String(b.executive_summary||''):String(src.executive_summary||'');
  await DB.prepare('INSERT INTO report_records(id,company_id,project_id,title,reference,status,executive_summary,data_json,created_by,updated_by,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)')
    .bind(id,src.company_id,src.project_id||null,title,reference,'RASCUNHO',summary,JSON.stringify(data),user.name,user.name).run();
  const road=(await DB.prepare("SELECT * FROM report_roadmap_items WHERE report_id=? AND archived_at IS NULL ORDER BY rank ASC,created_at ASC").bind(sourceId).all()).results||[];
  for(const x of road){
    const rid=lrId('RDM');
    await DB.prepare('INSERT INTO report_roadmap_items(id,report_id,company_id,project_id,title,description,responsible_party,responsible_name,external_party,status,start_date,due_date,progress,work_item_id,rank,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(rid,id,src.company_id,src.project_id||null,x.title||'',x.description||'',x.responsible_party||'DEV',x.responsible_name||'',x.external_party||'',x.status||'PLANEJADO',x.start_date||null,x.due_date||null,Math.max(0,Math.min(100,Number(x.progress||0))),x.work_item_id||null,x.rank??Date.now(),user.name,user.name).run();
  }
  await lrSnapshot(id,'Nova edição criada a partir de '+sourceId);
  await logEvent(env,user,'report-nativo:duplicar',id,'Origem '+sourceId);
  return json({ok:true,id,previous_report_id:sourceId,status:'RASCUNHO'},201);
}
