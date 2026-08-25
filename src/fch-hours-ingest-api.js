// FCH HOURS INGEST — endpoint técnico sem sessão de usuário.
// Segurança: somente token de ingestão configurado no Cloudflare.
if(path==='fch-hours-ingest'&&request.method==='POST'){
  const expected=String(env.HOURS_INGEST_TOKEN||'');
  const bearer=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const supplied=String(request.headers.get('x-hours-token')||bearer||'');
  if(!expected||!supplied||supplied!==expected)return json({error:'Ingestão FCH não autorizada'},401);

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
  await DB.prepare(`CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    last_run TEXT,
    detail TEXT
  )`).run();

  const body=await request.json().catch(()=>null);
  if(!body||!Array.isArray(body.entries))return json({error:'Payload FCH inválido'},400);
  if(body.entries.length>5000)return json({error:'Payload FCH excede 5000 alocações'},413);
  const sourceFileId=String(body.source_file_id||'').trim();
  if(!sourceFileId)return json({error:'source_file_id é obrigatório'},400);
  const fileName=String(body.source_file_name||'').slice(0,240);
  const modifiedAt=String(body.source_modified_at||'').slice(0,64);

  const clean=[];
  for(const raw of body.entries){
    if(!raw)continue;
    const target=String(raw.target_project||'').toUpperCase().trim();
    if(!['OPR','MADRI'].includes(target))continue;
    const hours=Number(raw.hours||0);
    if(!(hours>0&&hours<=24))continue;
    const date=String(raw.activity_date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const sheet=String(raw.source_sheet||'').slice(0,120);
    const row=Math.max(0,Number(raw.source_row||0)|0);
    const person=String(raw.person||'').slice(0,120);
    const sourceProject=String(raw.source_project||'').slice(0,240);
    const rule=String(raw.allocation_rule||'').slice(0,80);
    let hash=String(raw.source_entry_hash||'').trim();
    if(!hash)hash=await sha([sourceFileId,sheet,row,date,person,sourceProject,hours].join('|'));
    clean.push({target,hours,date,sheet,row,person,sourceProject,rule,hash});
  }
  if(!clean.length)return json({error:'Nenhuma alocação FCH válida recebida'},400);

  await DB.prepare('DELETE FROM fch_entries WHERE source_file_id=?').bind(sourceFileId).run();
  for(let i=0;i<clean.length;i+=40){
    const stmts=clean.slice(i,i+40).map(x=>DB.prepare(`INSERT INTO fch_entries
      (source_file_id,source_file_name,source_modified_at,source_sheet,source_row,person,activity_date,source_project,target_project,allocation_rule,source_entry_hash,hours,imported_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(source_entry_hash,target_project) DO UPDATE SET
        source_file_name=excluded.source_file_name,
        source_modified_at=excluded.source_modified_at,
        source_sheet=excluded.source_sheet,
        source_row=excluded.source_row,
        person=excluded.person,
        activity_date=excluded.activity_date,
        source_project=excluded.source_project,
        allocation_rule=excluded.allocation_rule,
        hours=excluded.hours,
        imported_at=datetime('now')`)
      .bind(sourceFileId,fileName,modifiedAt,x.sheet,x.row,x.person,x.date,x.sourceProject,x.target,x.rule,x.hash,x.hours));
    await DB.batch(stmts);
  }

  const sourceHours=clean.reduce((m,x)=>{const k=x.hash;if(!m.has(k))m.set(k,x.hours);return m},new Map());
  const totalCapacity=[...sourceHours.values()].reduce((a,b)=>a+b,0);
  const opr=clean.filter(x=>x.target==='OPR').reduce((a,b)=>a+b.hours,0);
  const madri=clean.filter(x=>x.target==='MADRI').reduce((a,b)=>a+b.hours,0);
  const detail=JSON.stringify({file:fileName,modified_at:modifiedAt,allocations:clean.length,source_entries:sourceHours.size,capacity_hours:+totalCapacity.toFixed(4),opr_hours:+opr.toFixed(4),madri_hours:+madri.toFixed(4)});
  await DB.prepare(`INSERT INTO sync_state(source,last_run,detail) VALUES('fch-drive',datetime('now'),?)
    ON CONFLICT(source) DO UPDATE SET last_run=datetime('now'),detail=excluded.detail`).bind(detail).run();
  return json({ok:true,allocations:clean.length,source_entries:sourceHours.size,capacity_hours:+totalCapacity.toFixed(4),opr_hours:+opr.toFixed(4),madri_hours:+madri.toFixed(4)});
}
