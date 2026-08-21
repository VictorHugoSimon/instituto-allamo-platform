// Séries recorrentes de Status Reports: projeto -> ciclos -> snapshots publicados.
const srWrite=['admin','pmo','techlead'].includes(user.role);
const srCadences=['WEEKLY','BIWEEKLY','MONTHLY'];
const srNew=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,5).toUpperCase();
const srParse=s=>{try{return JSON.parse(s||'{}')}catch(_){return {}}};
const srScopeOk=id=>!scope||String(id)===String(scope);
const srLabel=c=>({WEEKLY:'Semanal',BIWEEKLY:'Quinzenal',MONTHLY:'Mensal'}[c]||c);
const srSeries=async id=>DB.prepare('SELECT * FROM report_series WHERE id=?').bind(id).first();
const srContext=async s=>{
  if(!s)return {error:'Série não encontrada',status:404};
  if(!srScopeOk(s.company_id))return {error:'Fora do escopo',status:403};
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(s.company_id).first();
  if(!company)return {error:'Empresa não encontrada',status:404};
  let project=null;if(s.project_id!=null&&s.project_id!==''){project=await DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(s.project_id).first();if(!project||String(project.company_id)!==String(s.company_id))return {error:'Projeto inválido para a empresa',status:400}}
  return {series:s,company,project};
};

if(path==='report-series'&&request.method==='GET'){
  const where=['1=1'],args=[];if(scope){where.push('s.company_id=?');args.push(scope)}
  const company=url.searchParams.get('company'),project=url.searchParams.get('project');if(company){where.push('s.company_id=?');args.push(company)}if(project){where.push('s.project_id=?');args.push(project)}
  const sql=`SELECT s.*,c.name AS company_name,p.name AS project_name,
    (SELECT COUNT(*) FROM report_series_cycles x WHERE x.series_id=s.id) AS cycle_count,
    (SELECT COUNT(*) FROM report_series_meetings m WHERE m.series_id=s.id AND m.used_cycle_id IS NULL) AS pending_meetings,
    (SELECT x.report_id FROM report_series_cycles x WHERE x.series_id=s.id ORDER BY x.cycle_no DESC LIMIT 1) AS latest_report_id,
    (SELECT x.presentation_date FROM report_series_cycles x WHERE x.series_id=s.id ORDER BY x.cycle_no DESC LIMIT 1) AS latest_presentation_date
    FROM report_series s LEFT JOIN companies c ON c.id=s.company_id LEFT JOIN projects p ON p.id=s.project_id WHERE ${where.join(' AND ')} ORDER BY s.updated_at DESC`;
  return json((await DB.prepare(sql).bind(...args).all()).results||[]);
}

if(path==='report-series'&&request.method==='POST'){
  if(!srWrite)return json({error:'Sem permissão para configurar recorrência'},403);const b=await request.json();
  if(!b.company_id)return json({error:'Empresa é obrigatória'},400);if(!srScopeOk(b.company_id))return json({error:'Fora do escopo'},403);
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(b.company_id).first();if(!company)return json({error:'Empresa não encontrada'},404);
  let project=null;if(b.project_id){project=await DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(b.project_id).first();if(!project||String(project.company_id)!==String(b.company_id))return json({error:'Projeto não pertence à empresa'},400)}
  const cadence=String(b.cadence||'WEEKLY').toUpperCase();if(!srCadences.includes(cadence))return json({error:'Recorrência inválida'},400);
  const existing=await DB.prepare('SELECT id FROM report_series WHERE company_id=? AND COALESCE(project_id,0)=COALESCE(?,0) AND active=1').bind(b.company_id,b.project_id||null).first();if(existing)return json({error:'Este projeto já possui uma série ativa',id:existing.id},409);
  const id=srNew('RPS');const name=String(b.name||`${project?.name||company.name} · Reports ${srLabel(cadence)}`).trim();
  await DB.prepare('INSERT INTO report_series(id,company_id,project_id,name,cadence,presentation_day,active,created_by) VALUES(?,?,?,?,?,?,1,?)').bind(id,b.company_id,b.project_id||null,name,cadence,b.presentation_day??null,user.name).run();
  await logEvent(env,user,'report-serie:criar',id,`${name} · ${cadence}`);return json({ok:true,id},201);
}

if(path.match(/^report-series\/[^/]+$/)&&request.method==='PATCH'){
  if(!srWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),s=await srSeries(id),ctx=await srContext(s);if(ctx.error)return json({error:ctx.error},ctx.status);const b=await request.json();const sets=[],args=[];
  if(b.name!=null){sets.push('name=?');args.push(String(b.name).trim())}if(b.cadence!=null){const c=String(b.cadence).toUpperCase();if(!srCadences.includes(c))return json({error:'Recorrência inválida'},400);sets.push('cadence=?');args.push(c)}if(b.presentation_day!=null){sets.push('presentation_day=?');args.push(b.presentation_day)}if(b.active!=null){sets.push('active=?');args.push(b.active?1:0)}
  if(sets.length){sets.push("updated_at=datetime('now')");args.push(id);await DB.prepare('UPDATE report_series SET '+sets.join(',')+' WHERE id=?').bind(...args).run()}return json({ok:true,id});
}

if(path.match(/^report-series\/[^/]+$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),s=await srSeries(id),ctx=await srContext(s);if(ctx.error)return json({error:ctx.error},ctx.status);
  const cycles=(await DB.prepare("SELECT x.*,r.title,r.reference,r.status AS report_status,r.published_at AS report_published_at FROM report_series_cycles x LEFT JOIN report_records r ON r.id=x.report_id WHERE x.series_id=? ORDER BY x.cycle_no DESC").bind(id).all()).results||[];
  const meetings=(await DB.prepare('SELECT * FROM report_series_meetings WHERE series_id=? ORDER BY meeting_date DESC,created_at DESC LIMIT 200').bind(id).all()).results||[];
  return json({...s,company:ctx.company,project:ctx.project,cycles,meetings});
}

if(path.match(/^report-series\/[^/]+\/meetings$/)&&request.method==='POST'){
  if(!srWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),s=await srSeries(id),ctx=await srContext(s);if(ctx.error)return json({error:ctx.error},ctx.status);const b=await request.json();if(!String(b.content||'').trim())return json({error:'Informe o resumo/transcrição da reunião'},400);
  const mid=srNew('RPM');await DB.prepare('INSERT INTO report_series_meetings(id,series_id,meeting_date,title,content,source,created_by) VALUES(?,?,?,?,?,?,?)').bind(mid,id,b.meeting_date||'',String(b.title||'Reunião').trim(),String(b.content).slice(0,50000),b.source||'REUNIAO',user.name).run();
  await logEvent(env,user,'report-serie:reuniao',id,String(b.title||'Reunião'));return json({ok:true,id:mid},201);
}

if(path.match(/^report-series\/[^/]+\/context$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),s=await srSeries(id),ctx=await srContext(s);if(ctx.error)return json({error:ctx.error},ctx.status);
  const rows=(await DB.prepare('SELECT id,meeting_date,title,content,source FROM report_series_meetings WHERE series_id=? AND used_cycle_id IS NULL ORDER BY meeting_date ASC,created_at ASC').bind(id).all()).results||[];
  const text=rows.map((m,i)=>`### Reunião ${i+1} · ${m.meeting_date||'data não informada'} · ${m.title}\n${m.content}`).join('\n\n');return json({series_id:id,count:rows.length,meetings:rows,text});
}

if(path.match(/^report-series\/[^/]+\/snapshot$/)&&request.method==='POST'){
  if(!srWrite)return json({error:'Sem permissão para fechar ciclo'},403);const id=decodeURIComponent(path.split('/')[1]),s=await srSeries(id),ctx=await srContext(s);if(ctx.error)return json({error:ctx.error},ctx.status);const b=await request.json();
  let row;if(s.project_id)row=await DB.prepare('SELECT data_json,ref FROM project_reports_p WHERE project_id=?').bind(s.project_id).first();else row=await DB.prepare('SELECT data_json,ref FROM project_reports WHERE company_id=?').bind(s.company_id).first();
  let data=row?.data_json?srParse(row.data_json):defaultReport(ctx.company);if(!data||typeof data!=='object')data=defaultReport(ctx.company);data.client=ctx.company.name;if(data.tap&&typeof data.tap==='object')data.tap.cliente=ctx.company.name;
  const last=await DB.prepare('SELECT * FROM report_series_cycles WHERE series_id=? ORDER BY cycle_no DESC LIMIT 1').bind(id).first();const no=Number(last?.cycle_no||0)+1;const rid=srNew('RPT'),cid=srNew('RPC');const publish=b.publish!==false,status=publish?'PUBLICADO':'RASCUNHO';
  const pstart=b.period_start||'',pend=b.period_end||'',presentation=b.presentation_date||'';const reference=String(b.reference||`${srLabel(s.cadence)}${pstart||pend?' · '+pstart+' a '+pend:''}`).trim();const title=String(b.title||`Status Report #${String(no).padStart(2,'0')} · ${ctx.project?.name||ctx.company.name}`).trim();
  const pending=(await DB.prepare('SELECT COUNT(*) AS n FROM report_series_meetings WHERE series_id=? AND used_cycle_id IS NULL').bind(id).first())?.n||0;
  data._series={series_id:id,series_name:s.name,cadence:s.cadence,cycle_no:no,period_start:pstart,period_end:pend,presentation_date:presentation,previous_report_id:last?.report_id||null};
  const summary=String(b.executive_summary||data.executive_summary||`Report recorrente ${srLabel(s.cadence).toLowerCase()} do projeto ${ctx.project?.name||ctx.company.name}.`).slice(0,12000);
  await DB.prepare('INSERT INTO report_records(id,company_id,project_id,title,reference,status,executive_summary,data_json,created_by,updated_by,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(rid,s.company_id,s.project_id||null,title,reference,status,summary,JSON.stringify(data),user.name,user.name,publish?new Date().toISOString():null).run();
  const snap={report:{id:rid,company_id:s.company_id,project_id:s.project_id||null,title,reference,status,executive_summary:summary,data},roadmap:[]};await DB.prepare('INSERT INTO report_versions(report_id,company_id,project_id,version_no,snapshot_json,change_note,created_by) VALUES(?,?,?,?,?,?,?)').bind(rid,s.company_id,s.project_id||null,1,JSON.stringify(snap),'Ciclo recorrente criado',user.name).run();
  await DB.prepare('INSERT INTO report_series_cycles(id,series_id,cycle_no,report_id,period_start,period_end,presentation_date,previous_cycle_id,source_count,status,created_by,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid,id,no,rid,pstart,pend,presentation,last?.id||null,Number(pending),status,user.name,publish?new Date().toISOString():null).run();
  await DB.prepare('UPDATE report_series_meetings SET used_cycle_id=? WHERE series_id=? AND used_cycle_id IS NULL').bind(cid,id).run();await DB.prepare("UPDATE report_series SET updated_at=datetime('now') WHERE id=?").bind(id).run();
  if(publish)try{await DB.prepare("INSERT INTO notifications(company_id,project,type,title,message,created_at) VALUES(?,?,?,?,?,datetime('now'))").bind(s.company_id,s.project_id?String(s.project_id):'','report-publicado',title,`Novo ${srLabel(s.cadence).toLowerCase()} publicado: ${reference}`).run()}catch(_){}
  await logEvent(env,user,'report-serie:fechar-ciclo',rid,`${s.name} · ciclo ${no} · ${status} · ${pending} reunião(ões)`);return json({ok:true,report_id:rid,cycle_id:cid,cycle_no:no,status,source_count:Number(pending)},201);
}
