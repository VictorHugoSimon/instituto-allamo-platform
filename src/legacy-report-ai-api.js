// Államo Legacy Status Report — Copiloto PMO GPT + histórico persistente.
// Este bloco é injetado antes da rota legada `report` e intercepta somente POST para adicionar snapshot.
const lrWrite=['admin','pmo'].includes(user.role);
const lrScopeOk=id=>!scope||String(id)===String(scope);
const lrParse=s=>{try{return JSON.parse(s||'{}')}catch(e){return {}}};
const lrStr=v=>v==null?'':String(v);
const lrSafeText=(v,max=30000)=>lrStr(v).slice(0,max);
const lrNewRunId=()=>`RAI-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;

const lrEnsureSchema=async()=>{
  await DB.prepare("CREATE TABLE IF NOT EXISTS legacy_report_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, company_id TEXT, project_id INTEGER, version_no INTEGER NOT NULL, ref TEXT DEFAULT '', snapshot_json TEXT NOT NULL, change_note TEXT DEFAULT '', source TEXT NOT NULL DEFAULT 'MANUAL', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(scope_type,scope_id,version_no))").run();
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_legacy_report_versions_scope ON legacy_report_versions(scope_type,scope_id,version_no DESC)").run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS report_ai_runs (id TEXT PRIMARY KEY, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, company_id TEXT, project_id INTEGER, model TEXT NOT NULL, input_summary TEXT DEFAULT '', output_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'GENERATED', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), applied_at TEXT)").run();
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_report_ai_runs_scope ON report_ai_runs(scope_type,scope_id,created_at DESC)").run();
};

const lrResolve=async()=>{
  const pid=url.searchParams.get('project');
  if(pid&&!scope){
    const proj=await DB.prepare('SELECT * FROM projects WHERE id=?').bind(pid).first();
    if(!proj)return {error:'Projeto não encontrado',status:404};
    const co=proj.company_id?await DB.prepare('SELECT * FROM companies WHERE id=?').bind(proj.company_id).first():null;
    if(proj.company_id&&!lrScopeOk(proj.company_id))return {error:'Fora do escopo',status:403};
    const row=await DB.prepare('SELECT data_json,ref,updated_at,updated_by FROM project_reports_p WHERE project_id=?').bind(pid).first();
    let data=row?.data_json?lrParse(row.data_json):defaultReport(co);if(!row?.data_json){data.title='Governança da Implantação · '+proj.name;data.client=co?.name||''}
    return {scope_type:'PROJECT',scope_id:String(pid),project_id:Number(pid),company_id:proj.company_id||'',project:proj,company:co,data,row};
  }
  const cid=scope||url.searchParams.get('company');
  if(!cid||cid==='all')return {error:'Informe a empresa',status:400};
  if(!lrScopeOk(cid))return {error:'Fora do escopo',status:403};
  const co=await DB.prepare('SELECT * FROM companies WHERE id=?').bind(cid).first();
  if(!co)return {error:'Empresa não encontrada',status:404};
  const row=await DB.prepare('SELECT data_json,ref,updated_at,updated_by FROM project_reports WHERE company_id=?').bind(cid).first();
  const data=row?.data_json?lrParse(row.data_json):defaultReport(co);
  return {scope_type:'COMPANY',scope_id:String(cid),project_id:null,company_id:String(cid),project:null,company:co,data,row};
};

const lrSnapshot=async(ctx,data,note='Atualização',source='MANUAL')=>{
  await lrEnsureSchema();
  const n=await DB.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM legacy_report_versions WHERE scope_type=? AND scope_id=?').bind(ctx.scope_type,ctx.scope_id).first();
  const version=Number(n?.n||1),ref=(data&&data.ref)||ctx.row?.ref||'';
  await DB.prepare('INSERT INTO legacy_report_versions(scope_type,scope_id,company_id,project_id,version_no,ref,snapshot_json,change_note,source,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(ctx.scope_type,ctx.scope_id,ctx.company_id||'',ctx.project_id||null,version,ref,JSON.stringify(data||{}),lrSafeText(note,500),String(source||'MANUAL').toUpperCase(),user.name).run();
  return version;
};

const lrSave=async(ctx,data,note='Atualização',source='MANUAL')=>{
  if(!lrWrite)return {error:'Sem permissão',status:403};
  await lrEnsureSchema();
  const oldCount=await DB.prepare('SELECT COUNT(*) AS n FROM legacy_report_versions WHERE scope_type=? AND scope_id=?').bind(ctx.scope_type,ctx.scope_id).first();
  if(Number(oldCount?.n||0)===0&&ctx.row?.data_json){await lrSnapshot(ctx,ctx.data,'Baseline anterior importada antes do editor dinâmico','MIGRATED')}
  const ref=(data&&data.ref)||defaultReport(ctx.company).ref;
  if(ctx.scope_type==='PROJECT'){
    await DB.prepare("INSERT INTO project_reports_p (project_id,company_id,ref,data_json,updated_at,updated_by) VALUES (?,?,?,?,datetime('now'),?) ON CONFLICT(project_id) DO UPDATE SET ref=excluded.ref,data_json=excluded.data_json,updated_at=datetime('now'),updated_by=excluded.updated_by")
      .bind(ctx.project_id,ctx.company_id||'',ref,JSON.stringify(data||{}),user.name).run();
  }else{
    await DB.prepare("INSERT INTO project_reports (company_id,ref,data_json,updated_at,updated_by) VALUES (?,?,?,datetime('now'),?) ON CONFLICT(company_id) DO UPDATE SET ref=excluded.ref,data_json=excluded.data_json,updated_at=datetime('now'),updated_by=excluded.updated_by")
      .bind(ctx.company_id,ref,JSON.stringify(data||{}),user.name).run();
  }
  const version=await lrSnapshot(ctx,data,note,source);
  await logEvent(env,user,'report:editar',ctx.scope_type==='PROJECT'?'projeto '+(ctx.project?.name||ctx.scope_id):ctx.company_id,`${source} · versão ${version} · ${note}`);
  return {ok:true,version_no:version};
};

// Intercepta a gravação legada e garante histórico real sem quebrar o editor existente.
if(path==='report'&&request.method==='POST'){
  const ctx=await lrResolve();if(ctx.error)return json({error:ctx.error},ctx.status);
  const body=await request.json();const data=body&&body.data?body.data:body;
  const note=body?.change_note||data?._last_change_note||'Status Report atualizado';
  const source=body?.source||'MANUAL';
  const saved=await lrSave(ctx,data,note,source);if(saved.error)return json({error:saved.error},saved.status);return json(saved);
}

if(path==='report-history'&&request.method==='GET'){
  const ctx=await lrResolve();if(ctx.error)return json({error:ctx.error},ctx.status);await lrEnsureSchema();
  const version=url.searchParams.get('version');
  if(version){const row=await DB.prepare('SELECT * FROM legacy_report_versions WHERE scope_type=? AND scope_id=? AND version_no=?').bind(ctx.scope_type,ctx.scope_id,Number(version)).first();if(!row)return json({error:'Versão não encontrada'},404);return json({...row,snapshot:lrParse(row.snapshot_json)});}
  const rows=(await DB.prepare('SELECT id,version_no,ref,change_note,source,created_by,created_at FROM legacy_report_versions WHERE scope_type=? AND scope_id=? ORDER BY version_no DESC LIMIT 100').bind(ctx.scope_type,ctx.scope_id).all()).results||[];
  return json({scope_type:ctx.scope_type,scope_id:ctx.scope_id,versions:rows});
}

if(path==='report-ai/status'&&request.method==='GET'){
  return json({configured:!!env.OPENAI_API_KEY,model:env.OPENAI_REPORT_MODEL||'gpt-5.6-terra',provider:'OpenAI Responses API',approval_required:true});
}

const lrFlatFields=(data)=>{
  const out=[];const criticalRe=/(go.?live|baseline|escopo|custo|or[cç]amento|contrato|sponsor|patrocinador)/i;
  const walk=(v,path,label,depth)=>{
    if(out.length>=240||depth>5)return;
    if(v==null||['string','number','boolean'].includes(typeof v)){out.push({target:path,label:label||path,type:typeof v,value:v==null?'':v,critical:criticalRe.test(path+' '+label)});return;}
    if(Array.isArray(v)){v.slice(0,30).forEach((x,i)=>walk(x,`${path}[${i}]`,`${label||path} ${i+1}`,depth+1));return;}
    if(typeof v==='object')for(const [k,x] of Object.entries(v)){if(['ai_audit','_history'].includes(k))continue;walk(x,path?`${path}.${k}`:k,k,depth+1)};
  };
  walk(data,'','Report',0);
  return out.filter(x=>x.target);
};
const lrEvidenceText=(b)=>{
  const parts=[lrSafeText(b.meeting_summary,25000),lrSafeText(b.instructions,8000)];
  for(const s of (Array.isArray(b.sources)?b.sources:[]).slice(0,8))if(s&&s.text)parts.push(lrSafeText(s.text,30000));
  return parts.filter(Boolean).join('\n\n');
};
const lrNorm=s=>lrStr(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const lrQuantitative=(field)=>field.type==='number'||/(%|percent|spi|hora|custo|valor|saldo|meta|avan[cç]o|prazo|data|go.?live)/i.test(field.target+' '+field.label);
const lrOutputText=o=>(o?.output||[]).flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x.text||'').join('');

const lrSchema={type:'object',additionalProperties:false,required:['overall_status','executive_summary_suggestion','changes','risks','actions','decisions','roadmap_updates','warnings','quantitative_fields_without_evidence','sources_used'],properties:{
  overall_status:{type:'string',enum:['VERDE','AMARELO','VERMELHO','A_CONFIRMAR']},
  executive_summary_suggestion:{type:'string'},
  changes:{type:'array',items:{type:'object',additionalProperties:false,required:['target','label','old_value','suggested_value','reason','source_name','source_date','evidence_quote','confidence','critical','requires_manual_validation'],properties:{target:{type:'string'},label:{type:'string'},old_value:{type:'string'},suggested_value:{type:'string'},reason:{type:'string'},source_name:{type:'string'},source_date:{type:'string'},evidence_quote:{type:'string'},confidence:{type:'string',enum:['BAIXA','MEDIA','ALTA']},critical:{type:'boolean'},requires_manual_validation:{type:'boolean'}}}},
  risks:{type:'array',items:{type:'object',additionalProperties:false,required:['risk','probability','impact','mitigation','owner','source_name','confidence'],properties:{risk:{type:'string'},probability:{type:'string'},impact:{type:'string'},mitigation:{type:'string'},owner:{type:'string'},source_name:{type:'string'},confidence:{type:'string',enum:['BAIXA','MEDIA','ALTA']}}}},
  actions:{type:'array',items:{type:'object',additionalProperties:false,required:['title','description','responsible','due_date','responsible_party','source_name','confidence'],properties:{title:{type:'string'},description:{type:'string'},responsible:{type:'string'},due_date:{type:'string'},responsible_party:{type:'string',enum:['CLIENTE','DEV','TERCEIRO','PMO','A_CONFIRMAR']},source_name:{type:'string'},confidence:{type:'string',enum:['BAIXA','MEDIA','ALTA']}}}},
  decisions:{type:'array',items:{type:'object',additionalProperties:false,required:['decision','owner','date','impact','source_name','confidence'],properties:{decision:{type:'string'},owner:{type:'string'},date:{type:'string'},impact:{type:'string'},source_name:{type:'string'},confidence:{type:'string',enum:['BAIXA','MEDIA','ALTA']}}}},
  roadmap_updates:{type:'array',items:{type:'object',additionalProperties:false,required:['title','status','responsible_party','responsible','start_date','due_date','description','source_name','confidence'],properties:{title:{type:'string'},status:{type:'string',enum:['PLANEJADO','EM ANDAMENTO','BLOQUEADO','CONCLUÍDO','CANCELADO','A_CONFIRMAR']},responsible_party:{type:'string',enum:['CLIENTE','DEV','TERCEIRO','PMO','A_CONFIRMAR']},responsible:{type:'string'},start_date:{type:'string'},due_date:{type:'string'},description:{type:'string'},source_name:{type:'string'},confidence:{type:'string',enum:['BAIXA','MEDIA','ALTA']}}}},
  warnings:{type:'array',items:{type:'string'}},quantitative_fields_without_evidence:{type:'array',items:{type:'string'}},sources_used:{type:'array',items:{type:'string'}}
}};

if(path==='report-ai'&&request.method==='POST'){
  if(!lrWrite)return json({error:'Sem permissão para gerar Report com IA'},403);
  if(!env.OPENAI_API_KEY)return json({error:'OPENAI_API_KEY não configurada no ambiente. A funcionalidade está pronta, mas a credencial precisa ser habilitada.'},503);
  const ctx=await lrResolve();if(ctx.error)return json({error:ctx.error},ctx.status);await lrEnsureSchema();
  const b=await request.json();
  const meeting=lrSafeText(b.meeting_summary,25000),instructions=lrSafeText(b.instructions,8000),sources=(Array.isArray(b.sources)?b.sources:[]).slice(0,8);
  if(!meeting&&!sources.some(s=>s&&s.text||s&&s.file_data))return json({error:'Informe o resumo da reunião ou ao menos uma evidência.'},400);
  const fields=lrFlatFields(ctx.data),fieldMap=new Map(fields.map(x=>[x.target,x]));
  const sourceMeta=sources.map(s=>({name:lrSafeText(s?.name,200),type:lrSafeText(s?.type,50),date:lrSafeText(s?.date,30),has_file:!!s?.file_data,has_text:!!s?.text}));
  const prompt=[
    'PROJETO/ESCOPO: '+(ctx.project?.name||ctx.company?.name||ctx.scope_id),
    'ÚLTIMO STATUS REPORT APROVADO/GRAVADO (JSON): '+JSON.stringify(ctx.data).slice(0,70000),
    'CATÁLOGO DE CAMPOS EDITÁVEIS (target deve existir aqui): '+JSON.stringify(fields).slice(0,50000),
    'RESUMO/TRANSCRIÇÃO DA REUNIÃO:\n'+meeting,
    'INSTRUÇÕES ADICIONAIS:\n'+instructions,
    'FONTES TEXTUAIS:\n'+sources.filter(s=>s?.text).map(s=>`### ${lrSafeText(s.name,200)} ${lrSafeText(s.date,30)}\n${lrSafeText(s.text,30000)}`).join('\n\n'),
    'METADADOS DAS FONTES: '+JSON.stringify(sourceMeta),
    'Gere SOMENTE alterações suportadas pelas evidências. Use target exatamente do catálogo. Não crie target inexistente.'
  ].join('\n\n');
  const content=[{type:'input_text',text:prompt}];
  for(const s of sources){
    if(!s?.file_data)continue;
    const mime=lrStr(s.mime||'application/pdf').toLowerCase();const name=lrSafeText(s.name||'evidencia',200);
    if(mime==='application/pdf'&&lrStr(s.file_data).length<=7500000)content.push({type:'input_file',filename:name,file_data:s.file_data});
    else if(/^image\/(png|jpeg|jpg|webp)$/.test(mime)&&lrStr(s.file_data).length<=7500000)content.push({type:'input_image',image_url:s.file_data});
  }
  const system=[
    'Você é o Copiloto PMO do Portal PMO Instituto Államo.',
    'Responda em português do Brasil e trabalhe exclusivamente com as evidências fornecidas.',
    'Nunca invente percentuais, SPI, horas, custos, datas, Go-live, responsáveis, decisões ou marcos.',
    'Se não houver evidência objetiva para informação quantitativa, não proponha mudança e registre em quantitative_fields_without_evidence.',
    'Diferencie fato de inferência. Opinião não é decisão. Uma decisão só existe se estiver explicitamente registrada.',
    'Compare sempre o novo conteúdo com o Report atual.',
    'Mudanças em Go-live, baseline, escopo, custo/orçamento, contrato ou sponsor são críticas e exigem validação manual.',
    'Cada mudança deve citar source_name e uma evidence_quote curta. Sem fonte, marque requires_manual_validation=true.',
    'A IA apenas propõe. O PMO humano aprova antes de qualquer gravação.'
  ].join('\n');
  const model=env.OPENAI_REPORT_MODEL||'gpt-5.6-terra';
  let resp;
  try{
    resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model,store:false,instructions:system,input:[{role:'user',content}],max_output_tokens:6000,text:{format:{type:'json_schema',name:'allamo_pmo_report_update',strict:true,schema:lrSchema}}})});
  }catch(e){return json({error:'Falha de comunicação com o provedor de IA.'},502)}
  const raw=await resp.json().catch(()=>({}));if(!resp.ok)return json({error:'OpenAI Responses API retornou erro.',provider_status:resp.status,provider_code:raw?.error?.code||null},502);
  let result;try{result=JSON.parse(lrOutputText(raw))}catch(e){return json({error:'A IA respondeu fora do schema estruturado.'},502)}
  const evidence=lrNorm(lrEvidenceText(b));
  result.changes=(Array.isArray(result.changes)?result.changes:[]).filter(ch=>fieldMap.has(ch.target)).map(ch=>{
    const f=fieldMap.get(ch.target),quote=lrNorm(ch.evidence_quote),sourceKnown=sources.some(s=>lrNorm(s?.name)===lrNorm(ch.source_name))||(!sources.length&&!!meeting);
    const quoteVerified=quote&&evidence.includes(quote);
    const fileOnly=sources.some(s=>lrNorm(s?.name)===lrNorm(ch.source_name)&&s?.file_data&&!s?.text);
    const quantitative=lrQuantitative(f);
    const critical=!!ch.critical||!!f.critical;
    const manual=!!ch.requires_manual_validation||!sourceKnown||(quantitative&&(!quoteVerified||fileOnly))||critical;
    return {...ch,label:ch.label||f.label,old_value:lrStr(f.value),critical,requires_manual_validation:manual};
  });
  const runId=lrNewRunId();
  await DB.prepare('INSERT INTO report_ai_runs(id,scope_type,scope_id,company_id,project_id,model,input_summary,output_json,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(runId,ctx.scope_type,ctx.scope_id,ctx.company_id||'',ctx.project_id||null,model,lrSafeText(meeting||sources.map(s=>s?.name).join(', '),1000),JSON.stringify(result),'GENERATED',user.name).run();
  await logEvent(env,user,'report-ai:gerar',ctx.scope_type+' '+ctx.scope_id,`run ${runId} · ${model}`);
  return json({ok:true,run_id:runId,model,result,report_ref:ctx.data?.ref||'',approval_required:true});
}

if(path==='report-ai/mark-applied'&&request.method==='POST'){
  if(!lrWrite)return json({error:'Sem permissão'},403);await lrEnsureSchema();const b=await request.json();if(!b?.run_id)return json({error:'run_id obrigatório'},400);
  await DB.prepare("UPDATE report_ai_runs SET status='APPLIED',applied_at=datetime('now') WHERE id=?").bind(String(b.run_id)).run();return json({ok:true});
}
