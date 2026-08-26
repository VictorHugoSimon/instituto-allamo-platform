// FCH HOURS API — leitura interna para PMO e Curva S automática.
if(['fch-hours-status','fch-hours','fch-curve'].includes(path)){
  if(!['admin','pmo'].includes(user.role))return json({error:'Sem permissão para visualizar horas FCH'},403);
  await DB.prepare(`CREATE TABLE IF NOT EXISTS fch_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_id TEXT NOT NULL,
    source_file_name TEXT NOT NULL DEFAULT '',
    source_modified_at TEXT NOT NULL DEFAULT '',
    source_sheet TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    person TEXT NOT NULL DEFAULT '',
    activity_date TEXT NOT NULL,
    source_project TEXT NOT NULL,
    target_project TEXT NOT NULL,
    allocation_rule TEXT NOT NULL DEFAULT '',
    source_entry_hash TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 0,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_entry_hash,target_project)
  )`).run();

  if(path==='fch-hours-status'){
    const state=await DB.prepare("SELECT last_run,detail FROM sync_state WHERE source='fch-drive'").first();
    let detail={};try{detail=JSON.parse(state?.detail||'{}')}catch(e){detail={raw:state?.detail||''}}
    const totals=(await DB.prepare("SELECT target_project,SUM(hours) AS hours,COUNT(*) AS allocations FROM fch_entries GROUP BY target_project ORDER BY target_project").all()).results||[];
    const cap=await DB.prepare("SELECT SUM(hours) AS hours,COUNT(*) AS entries FROM (SELECT source_entry_hash,MAX(hours) AS hours FROM fch_entries GROUP BY source_entry_hash)").first();
    return json({last_run:state?.last_run||null,detail,totals,capacity_hours:+Number(cap?.hours||0).toFixed(4),source_entries:Number(cap?.entries||0)});
  }

  let target=String(url.searchParams.get('target')||'').toUpperCase().trim();
  const companyId=url.searchParams.get('company')||'';
  const projectId=url.searchParams.get('project')||'';
  let company=null,project=null;
  if(companyId)company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(companyId).first();
  if(projectId)project=await DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(projectId).first();
  if(!target){
    const key=norm((company&&company.name)||'')+' '+norm((project&&project.name)||'');
    if(key.includes('madri')||key.includes('madrid'))target='MADRI';
    else if(key.includes('opr'))target='OPR';
  }
  if(!['OPR','MADRI'].includes(target))return json({error:'Não foi possível identificar OPR ou MADRI'},400);

  const from=url.searchParams.get('from')||'';
  const to=url.searchParams.get('to')||'';
  const where=['target_project=?'],args=[target];
  if(/^\d{4}-\d{2}-\d{2}$/.test(from)){where.push('activity_date>=?');args.push(from)}
  if(/^\d{4}-\d{2}-\d{2}$/.test(to)){where.push('activity_date<=?');args.push(to)}

  if(path==='fch-hours'){
    const daily=(await DB.prepare(`SELECT activity_date,SUM(hours) AS hours FROM fch_entries WHERE ${where.join(' AND ')} GROUP BY activity_date ORDER BY activity_date`).bind(...args).all()).results||[];
    const people=(await DB.prepare(`SELECT person,SUM(hours) AS hours FROM fch_entries WHERE ${where.join(' AND ')} GROUP BY person ORDER BY hours DESC`).bind(...args).all()).results||[];
    const sources=(await DB.prepare(`SELECT source_project,allocation_rule,SUM(hours) AS hours FROM fch_entries WHERE ${where.join(' AND ')} GROUP BY source_project,allocation_rule ORDER BY hours DESC`).bind(...args).all()).results||[];
    return json({target,daily,people,sources,total_hours:+daily.reduce((a,x)=>a+Number(x.hours||0),0).toFixed(4)});
  }

  // Curva S: Realizado = FCH; Planejado = horas_prev do plano, distribuídas linearmente em dias úteis.
  const actualRows=(await DB.prepare(`SELECT activity_date,SUM(hours) AS hours FROM fch_entries WHERE ${where.join(' AND ')} GROUP BY activity_date ORDER BY activity_date`).bind(...args).all()).results||[];
  const actualBy=new Map(actualRows.map(r=>[String(r.activity_date),Number(r.hours||0)]));
  let planRows=[];
  if(projectId){planRows=(await DB.prepare('SELECT horas_prev,inicio,fim FROM plan_items WHERE project_id=? ORDER BY ordem,id').bind(projectId).all()).results||[]}
  else if(companyId){planRows=(await DB.prepare('SELECT horas_prev,inicio,fim FROM plan_items WHERE company_id=? ORDER BY ordem,id').bind(companyId).all()).results||[]}

  const isoOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
  const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const dayOf=s=>new Date(s+'T12:00:00Z').getUTCDay();
  const businessDays=(a,b)=>{const out=[];if(!isoOk(a)||!isoOk(b)||a>b)return out;for(let d=a;d<=b;d=addDays(d,1)){const w=dayOf(d);if(w!==0&&w!==6)out.push(d)}return out};
  const plannedBy=new Map();
  let unplannedHours=0;
  for(const row of planRows){
    const h=Number(row.horas_prev||0);if(!(h>0))continue;
    const ini=isoOk(row.inicio)?row.inicio:'',fim=isoOk(row.fim)?row.fim:'';
    if(ini&&fim&&ini<=fim){const days=businessDays(ini,fim);const use=days.length?days:[fim];const per=h/use.length;for(const d of use)plannedBy.set(d,(plannedBy.get(d)||0)+per)}
    else if(fim)plannedBy.set(fim,(plannedBy.get(fim)||0)+h);
    else if(ini)plannedBy.set(ini,(plannedBy.get(ini)||0)+h);
    else unplannedHours+=h;
  }

  const allKeys=[...actualBy.keys(),...plannedBy.keys()].sort();
  if(!allKeys.length){
    const state=await DB.prepare("SELECT last_run,detail FROM sync_state WHERE source='fch-drive'").first();
    return json({target,company,project,dates:[],actual:[],planned:[],actual_total:0,planned_total:planRows.reduce((a,r)=>a+Number(r.horas_prev||0),0),variance_hours:null,last_sync:state?.last_run||null,note:'Sem horas realizadas importadas e/ou plano temporal para o período.'});
  }
  let first=allKeys[0],last=allKeys[allKeys.length-1];
  if(isoOk(from)&&from<first)first=from;if(isoOk(to)&&to>last)last=to;
  const dates=[];for(let d=first;d<=last;d=addDays(d,1))dates.push(d);
  let ca=0,cp=0;const actual=[],planned=[];
  for(const d of dates){ca+=actualBy.get(d)||0;cp+=plannedBy.get(d)||0;actual.push(+ca.toFixed(4));planned.push(+cp.toFixed(4))}
  const actualTotal=+ca.toFixed(4),plannedTotal=+(cp+unplannedHours).toFixed(4);
  const variance=planned.length?+(actualTotal-cp).toFixed(4):null;
  const variancePct=cp>0?+((actualTotal-cp)/cp*100).toFixed(2):null;
  const state=await DB.prepare("SELECT last_run,detail FROM sync_state WHERE source='fch-drive'").first();
  let syncDetail={};try{syncDetail=JSON.parse(state?.detail||'{}')}catch(e){}
  const monthMap={};
  for(const r of actualRows){const m=String(r.activity_date).slice(0,7);if(!monthMap[m])monthMap[m]={month:m,actual_hours:0,planned_hours:0};monthMap[m].actual_hours+=Number(r.hours||0)}
  for(const [d,h] of plannedBy){const m=d.slice(0,7);if(!monthMap[m])monthMap[m]={month:m,actual_hours:0,planned_hours:0};monthMap[m].planned_hours+=h}
  const monthly=Object.values(monthMap).sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({...x,actual_hours:+x.actual_hours.toFixed(4),planned_hours:+x.planned_hours.toFixed(4)}));
  return json({target,company,project,dates,actual,planned,actual_total:actualTotal,planned_total:plannedTotal,planned_timed_total:+cp.toFixed(4),unplanned_plan_hours:+unplannedHours.toFixed(4),variance_hours:variance,variance_pct:variancePct,monthly,last_sync:state?.last_run||null,source:syncDetail.file||'',source_modified_at:syncDetail.modified_at||'',rule:'OPR_Madri é duplicado analiticamente para OPR e MADRI; capacidade interna preserva a entrada única.',planning_assumption:'Horas planejadas são distribuídas linearmente em dias úteis entre início e fim de cada item do plano.'});
}
