// Államo Work Import — importação em lote a partir de dados normalizados da UI.
const wmImportNorm=v=>String(v??'').trim();
const wmImportKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const wmImportHash=async text=>{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32)};
const wmImportDate=v=>{const s=wmImportNorm(v);if(!s)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);if(!m)return '__INVALID__';const d=String(m[1]).padStart(2,'0'),mo=String(m[2]).padStart(2,'0'),y=m[3];return `${y}-${mo}-${d}`};
const wmImportStatus=v=>{const k=wmImportKey(v);if(!k)return'BACKLOG';if(['backlog','fila','a priorizar'].includes(k))return'BACKLOG';if(['a fazer','fazer','to do','todo','pendente','nao iniciado','nao iniciada'].includes(k))return'A FAZER';if(['em andamento','andamento','desenvolvimento','doing','in progress'].includes(k))return'EM ANDAMENTO';if(['code review','review','revisao','revisao de codigo'].includes(k))return'CODE REVIEW';if(['qa','teste','testes'].includes(k))return'QA';if(['homologacao','homologar'].includes(k))return'HOMOLOGAÇÃO';if(['concluido','concluida','finalizado','finalizada','done'].includes(k))return'CONCLUÍDO';if(['cancelado','cancelada'].includes(k))return'CANCELADO';return'BACKLOG'};
const wmImportPriority=v=>{const k=wmImportKey(v);if(['critica','critico','urgente'].includes(k))return'Crítica';if(['alta','high'].includes(k))return'Alta';if(['baixa','low'].includes(k))return'Baixa';return'Média'};
const wmImportType=v=>{const raw=wmImportNorm(v).toUpperCase();if(wmTypes.includes(raw))return raw;const k=wmImportKey(v);if(['demanda','request'].includes(k))return'DEMANDA';if(['bug','erro','defeito'].includes(k))return'BUG';if(['melhoria','improvement'].includes(k))return'MELHORIA';if(['incidente','incident'].includes(k))return'INCIDENT';if(['acao','action'].includes(k))return'AÇÃO';if(['requisito','requirement'].includes(k))return'REQUISITO';if(['marco','milestone'].includes(k))return'MARCO';return'TASK'};
const wmImportNumber=v=>{const s=wmImportNorm(v).replace(',','.');if(!s)return null;const n=Number(s);return Number.isFinite(n)&&n>=0?n:'__INVALID__'};

if(path==='work-items/import'&&request.method==='POST'){
  if(!wmWrite)return json({error:'Sem permissão'},403);
  const b=await request.json();
  const rows=Array.isArray(b.rows)?b.rows:[];
  if(!rows.length)return json({error:'Nenhuma linha para importar'},400);
  if(rows.length>500)return json({error:'Limite de 500 linhas por importação'},400);
  const sourceName=wmImportNorm(b.source_name).slice(0,120);
  if(!sourceName)return json({error:'Identifique a origem/arquivo da importação'},400);
  const companyId=wmImportNorm(b.company_id);
  const projectId=b.project_id==null||b.project_id===''?null:Number(b.project_id);
  const ctx=await wmValidateContext(companyId,projectId);if(ctx)return json({error:ctx},400);
  const projectObj=projectId!=null?await wmProject(projectId):null;
  const existingQuery=projectId==null
    ?await DB.prepare('SELECT id,labels FROM work_items WHERE company_id=? AND project_id IS NULL AND archived_at IS NULL').bind(companyId).all()
    :await DB.prepare('SELECT id,labels FROM work_items WHERE company_id=? AND project_id=? AND archived_at IS NULL').bind(companyId,projectId).all();
  const existingTokens=new Map();
  for(const item of existingQuery.results||[]){try{for(const label of JSON.parse(item.labels||'[]'))if(String(label).startsWith('excel-import:'))existingTokens.set(String(label),item.id)}catch{}}
  const seen=new Set(),preview=[];
  let errors=0,duplicates=0;
  for(let idx=0;idx<rows.length;idx++){
    const r=rows[idx]||{};
    const title=wmImportNorm(r.title).slice(0,500);
    const startDate=wmImportDate(r.start_date),dueDate=wmImportDate(r.due_date),hours=wmImportNumber(r.estimate_hours),points=wmImportNumber(r.story_points);
    let error='';
    if(!title)error='Título/demanda é obrigatório';
    else if(startDate==='__INVALID__')error='Data de entrada/início inválida';
    else if(dueDate==='__INVALID__')error='Data de saída/prazo inválida';
    else if(hours==='__INVALID__')error='Estimativa de horas inválida';
    else if(points==='__INVALID__')error='Story points inválido';
    const normalized={
      title,
      description:wmImportNorm(r.description).slice(0,8000),
      acceptance_criteria:wmImportNorm(r.acceptance_criteria).slice(0,4000),
      owner:wmImportNorm(r.owner).slice(0,250),
      reporter:wmImportNorm(r.reporter).slice(0,250),
      item_type:wmImportType(r.item_type),
      status:wmImportStatus(r.status),
      priority:wmImportPriority(r.priority),
      start_date:startDate==='__INVALID__'?null:startDate,
      due_date:dueDate==='__INVALID__'?null:dueDate,
      estimate_hours:hours==='__INVALID__'?null:hours,
      story_points:points==='__INVALID__'?null:points,
      blocked:Boolean(r.blocked),
      blocked_reason:wmImportNorm(r.blocked_reason).slice(0,1000)
    };
    const hash=await wmImportHash(JSON.stringify({source_name:sourceName,company_id:companyId,project_id:projectId,...normalized}));
    const token='excel-import:'+hash;
    const duplicateId=existingTokens.get(token)||null;
    const repeated=seen.has(token);seen.add(token);
    const duplicate=Boolean(duplicateId||repeated);
    if(error)errors++;else if(duplicate)duplicates++;
    preview.push({row_number:idx+2,error,duplicate,duplicate_id:duplicateId,import_token:token,...normalized});
  }
  const summary={total:rows.length,valid:rows.length-errors,errors,duplicates,to_import:rows.length-errors-duplicates};
  if(b.dry_run===true)return json({ok:errors===0,dry_run:true,summary,rows:preview});
  if(errors)return json({error:'A importação possui linhas inválidas. Corrija antes de importar.',summary,rows:preview},422);
  const imported=[],skipped=[];
  for(const p of preview){
    if(p.duplicate){skipped.push({row_number:p.row_number,title:p.title,id:p.duplicate_id||null,reason:'duplicate'});continue}
    const id='AWM-IMP-'+crypto.randomUUID().slice(0,8).toUpperCase();
    const labels=['excel-import','excel-source:'+sourceName.slice(0,80),p.import_token];
    await DB.prepare("INSERT INTO work_items(id,company_id,project_id,project,item_type,title,description,acceptance_criteria,status,priority,owner,reporter,start_date,due_date,story_points,estimate_hours,rank,labels,blocked,blocked_reason,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,companyId,projectId,projectObj?.name||'',p.item_type,p.title,p.description,p.acceptance_criteria,p.status,p.priority,p.owner,p.reporter||user.name,p.start_date,p.due_date,p.story_points,p.estimate_hours,Date.now()+p.row_number,JSON.stringify(labels),p.blocked?1:0,p.blocked_reason,user.name,user.name).run();
    const item=await wmItem(id);await wmEvent(item,'imported',{source_name:sourceName,row_number:p.row_number,import_token:p.import_token});
    imported.push({row_number:p.row_number,id,title:p.title});
  }
  await logEvent(env,user,'work-items:importar',sourceName,`importados=${imported.length}; duplicados=${skipped.length}; total=${rows.length}`);
  return json({ok:true,source_name:sourceName,summary:{...summary,imported:imported.length,skipped:skipped.length},imported,skipped},201);
}
