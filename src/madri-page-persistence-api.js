// MADRI Page Persistence — POP e Mapa Mestre persistidos no D1 com histórico imutável.
// Este bloco é executado depois da Governance API e reutiliza mgCtx/mgNeedWrite.
const mpagAllowed=new Set(['pop','map']);
const mpagTitle={pop:'POP-001 · Governança e Execução do Projeto MADRI × NUCCI',map:'Mapa Mestre da Implantação MADRI × NUCCI'};
const mpagJson=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch{return null}};
const mpagRead=async(ctx,page)=>DB.prepare(`SELECT * FROM madri_page_documents WHERE company_id=? AND project_id=? AND page_key=?`).bind(ctx.company_id,ctx.project_id,page).first();
const mpagHistory=async(ctx,page,limit=100)=>((await DB.prepare(`SELECT id,company_id,project_id,page_key,version,event_type,reason,actor,title,created_at FROM madri_page_document_history WHERE company_id=? AND project_id=? AND page_key=? ORDER BY id DESC LIMIT ?`).bind(ctx.company_id,ctx.project_id,page,limit).all()).results||[]);
const mpagSave=async(ctx,page,body,eventType='SAVE')=>{
  const content=mpagJson(body?.content);
  if(!content||typeof content!=='object'||Array.isArray(content))throw new Error('Conteúdo da página deve ser um objeto JSON');
  const payload=JSON.stringify(content);
  if(payload.length>750000)throw new Error('Conteúdo da página excede o limite permitido');
  const old=await mpagRead(ctx,page),version=Number(old?.version||0)+1,title=String(body?.title||old?.title||mpagTitle[page]||page).trim(),actor=user.name||'',reason=String(body?.reason||'Atualização da página').trim();
  await DB.prepare(`INSERT INTO madri_page_documents(company_id,project_id,page_key,title,content_json,version,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(project_id,page_key) DO UPDATE SET company_id=excluded.company_id,title=excluded.title,content_json=excluded.content_json,version=excluded.version,updated_by=excluded.updated_by,updated_at=datetime('now')`).bind(ctx.company_id,ctx.project_id,page,title,payload,version,actor).run();
  await DB.prepare(`INSERT INTO madri_page_document_history(company_id,project_id,page_key,version,event_type,reason,actor,title,content_json) VALUES(?,?,?,?,?,?,?,?,?)`).bind(ctx.company_id,ctx.project_id,page,version,eventType,reason,actor,title,payload).run();
  return mpagRead(ctx,page);
};

const mpagCurrent=path.match(/^madri-platform\/pages\/(pop|map)$/);
if(mpagCurrent){
  const page=mpagCurrent[1],ctx=await mgCtx();if(!ctx)return json({error:'Contexto MADRI indisponível'},409);
  if(request.method==='GET'){const current=await mpagRead(ctx,page);return json({page,current,history:await mpagHistory(ctx,page,25)})}
  if(request.method==='PUT'||request.method==='PATCH'){
    const denied=mgNeedWrite();if(denied)return denied;
    try{return json({ok:true,current:await mpagSave(ctx,page,await request.json(),'SAVE')})}catch(e){return json({error:e.message},400)}
  }
}

const mpagHistoryRoute=path.match(/^madri-platform\/pages\/(pop|map)\/history$/);
if(mpagHistoryRoute&&request.method==='GET'){
  const page=mpagHistoryRoute[1],ctx=await mgCtx();if(!ctx)return json({error:'Contexto MADRI indisponível'},409);
  return json({page,history:await mpagHistory(ctx,page,250)});
}

const mpagSnapshot=path.match(/^madri-platform\/pages\/(pop|map)\/history\/(\d+)$/);
if(mpagSnapshot&&request.method==='GET'){
  const page=mpagSnapshot[1],ctx=await mgCtx();if(!ctx)return json({error:'Contexto MADRI indisponível'},409);
  const row=await DB.prepare(`SELECT * FROM madri_page_document_history WHERE id=? AND company_id=? AND project_id=? AND page_key=?`).bind(Number(mpagSnapshot[2]),ctx.company_id,ctx.project_id,page).first();
  if(!row)return json({error:'Versão não encontrada'},404);return json(row);
}

const mpagRestore=path.match(/^madri-platform\/pages\/(pop|map)\/history\/(\d+)\/restore$/);
if(mpagRestore&&request.method==='POST'){
  const denied=mgNeedWrite();if(denied)return denied;const page=mpagRestore[1],ctx=await mgCtx();if(!ctx)return json({error:'Contexto MADRI indisponível'},409);
  const snap=await DB.prepare(`SELECT * FROM madri_page_document_history WHERE id=? AND company_id=? AND project_id=? AND page_key=?`).bind(Number(mpagRestore[2]),ctx.company_id,ctx.project_id,page).first();
  if(!snap)return json({error:'Versão não encontrada'},404);
  try{return json({ok:true,current:await mpagSave(ctx,page,{title:snap.title,content:JSON.parse(snap.content_json||'{}'),reason:`Restauração da versão ${snap.version}`},'RESTORE')})}catch(e){return json({error:e.message},400)}
}
