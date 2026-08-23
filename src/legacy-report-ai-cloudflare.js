// Államo Status Report — fallback gratuito via Cloudflare Workers AI.
// Executa antes do provedor OpenAI e só intercepta quando OPENAI_API_KEY não está configurada.
const cfReportWrite=['admin','pmo'].includes(user.role);
const cfReportStr=v=>v==null?'':String(v);
const cfReportSafe=(v,max=30000)=>cfReportStr(v).slice(0,max);
const cfReportParse=s=>{try{return JSON.parse(s||'{}')}catch(e){return {}}};
const cfReportNorm=s=>cfReportStr(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const cfReportRunId=()=>`RAI-CF-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
const cfReportModel=()=>env.CLOUDFLARE_REPORT_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const cfReportScopeOk=id=>!scope||String(id)===String(scope);

const cfReportEnsureSchema=async()=>{
  await DB.prepare("CREATE TABLE IF NOT EXISTS legacy_report_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, company_id TEXT, project_id INTEGER, version_no INTEGER NOT NULL, ref TEXT DEFAULT '', snapshot_json TEXT NOT NULL, change_note TEXT DEFAULT '', source TEXT NOT NULL DEFAULT 'MANUAL', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(scope_type,scope_id,version_no))").run();
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_legacy_report_versions_scope ON legacy_report_versions(scope_type,scope_id,version_no DESC)").run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS report_ai_runs (id TEXT PRIMARY KEY, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, company_id TEXT, project_id INTEGER, model TEXT NOT NULL, input_summary TEXT DEFAULT '', output_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'GENERATED', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), applied_at TEXT)").run();
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_report_ai_runs_scope ON report_ai_runs(scope_type,scope_id,created_at DESC)").run();
};

const cfReportResolve=async()=>{
  const pid=url.searchParams.get('project');
  if(pid&&!scope){
    const project=await DB.prepare('SELECT * FROM projects WHERE id=?').bind(pid).first();
    if(!project)return {error:'Projeto não encontrado',status:404};
    if(project.company_id&&!cfReportScopeOk(project.company_id))return {error:'Fora do escopo',status:403};
    const company=project.company_id?await DB.prepare('SELECT * FROM companies WHERE id=?').bind(project.company_id).first():null;
    const row=await DB.prepare('SELECT data_json,ref,updated_at,updated_by FROM project_reports_p WHERE project_id=?').bind(pid).first();
    let data=row?.data_json?cfReportParse(row.data_json):defaultReport(company);
    if(!row?.data_json){data.title='Governança da Implantação · '+project.name;data.client=company?.name||''}
    return {scope_type:'PROJECT',scope_id:String(pid),project_id:Number(pid),company_id:project.company_id||'',project,company,data,row};
  }
  const cid=scope||url.searchParams.get('company');
  if(!cid||cid==='all')return {error:'Informe a empresa',status:400};
  if(!cfReportScopeOk(cid))return {error:'Fora do escopo',status:403};
  const company=await DB.prepare('SELECT * FROM companies WHERE id=?').bind(cid).first();
  if(!company)return {error:'Empresa não encontrada',status:404};
  const row=await DB.prepare('SELECT data_json,ref,updated_at,updated_by FROM project_reports WHERE company_id=?').bind(cid).first();
  const data=row?.data_json?cfReportParse(row.data_json):defaultReport(company);
  return {scope_type:'COMPANY',scope_id:String(cid),project_id:null,company_id:String(cid),project:null,company,data,row};
};

const cfReportFields=data=>{
  const out=[];const critical=/(go.?live|baseline|escopo|custo|or[cç]amento|contrato|sponsor|patrocinador)/i;
  const walk=(v,path,label,depth)=>{
    if(out.length>=220||depth>5)return;
    if(v==null||['string','number','boolean'].includes(typeof v)){out.push({target:path,label:label||path,type:typeof v,value:v==null?'':v,critical:critical.test(path+' '+label)});return;}
    if(Array.isArray(v)){v.slice(0,28).forEach((x,i)=>walk(x,`${path}[${i}]`,`${label||path} ${i+1}`,depth+1));return;}
    if(typeof v==='object')for(const [k,x] of Object.entries(v)){if(['ai_audit','_history'].includes(k))continue;walk(x,path?`${path}.${k}`:k,k,depth+1)};
  };
  walk(data,'','Report',0);return out.filter(x=>x.target);
};
const cfReportQuantitative=f=>f.type==='number'||/(%|percent|spi|hora|custo|valor|saldo|meta|avan[cç]o|prazo|data|go.?live)/i.test(f.target+' '+f.label);
const cfReportExtractJson=text=>{
  let s=cfReportStr(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)s=s.slice(a,b+1);
  return JSON.parse(s);
};

// Sem OpenAI: informa ao frontend que o provedor gratuito está disponível pelo binding AI.
if(path==='report-ai/status'&&request.method==='GET'&&!env.OPENAI_API_KEY){
  return json({configured:!!env.AI,model:cfReportModel(),provider:'Cloudflare Workers AI',free_mode:true,free_allocation:'10.000 neurons/dia',approval_required:true});
}

if(path==='report-ai'&&request.method==='POST'&&!env.OPENAI_API_KEY){
  if(!cfReportWrite)return json({error:'Sem permissão para gerar Report com IA'},403);
  if(!env.AI)return json({error:'Binding AI do Cloudflare não está habilitado neste ambiente.'},503);
  const ctx=await cfReportResolve();if(ctx.error)return json({error:ctx.error},ctx.status);await cfReportEnsureSchema();
  const body=await request.json();
  const meeting=cfReportSafe(body.meeting_summary,25000),instructions=cfReportSafe(body.instructions,8000),sources=(Array.isArray(body.sources)?body.sources:[]).slice(0,8);
  const textual=sources.filter(s=>s?.text).map(s=>({name:cfReportSafe(s.name||'Evidência',200),date:cfReportSafe(s.date,30),text:cfReportSafe(s.text,30000)}));
  if(!meeting&&!textual.length)return json({error:'No modo gratuito do Cloudflare, informe o resumo/transcrição da reunião ou uma evidência em texto. Arquivos PDF/imagem sem texto poderão ser usados quando um provedor multimodal estiver configurado.'},400);

  const fields=cfReportFields(ctx.data),fieldMap=new Map(fields.map(f=>[f.target,f]));
  const sourceNames=textual.map(s=>s.name);
  const evidence=cfReportNorm([meeting,...textual.map(s=>s.text)].filter(Boolean).join('\n\n'));
  const schemaExample={overall_status:'A_CONFIRMAR',executive_summary_suggestion:'',changes:[],risks:[],actions:[],decisions:[],roadmap_updates:[],warnings:[],quantitative_fields_without_evidence:[],sources_used:[]};
  const prompt=[
    'PROJETO/ESCOPO: '+(ctx.project?.name||ctx.company?.name||ctx.scope_id),
    'REPORT ATUAL (JSON): '+JSON.stringify(ctx.data).slice(0,65000),
    'CAMPOS EDITÁVEIS; target precisa existir exatamente nesta lista: '+JSON.stringify(fields).slice(0,42000),
    'RESUMO/TRANSCRIÇÃO:\n'+meeting,
    'EVIDÊNCIAS TEXTUAIS:\n'+textual.map(s=>`### ${s.name} ${s.date}\n${s.text}`).join('\n\n'),
    'INSTRUÇÕES ADICIONAIS:\n'+instructions,
    'Retorne APENAS JSON válido, sem markdown e sem explicações fora do JSON.',
    'Estrutura obrigatória: '+JSON.stringify(schemaExample),
    'changes: objetos com target,label,old_value,suggested_value,reason,source_name,source_date,evidence_quote,confidence,critical,requires_manual_validation.',
    'risks: risk,probability,impact,mitigation,owner,source_name,confidence.',
    'actions: title,description,responsible,due_date,responsible_party,source_name,confidence.',
    'decisions: decision,owner,date,impact,source_name,confidence.',
    'roadmap_updates: title,status,responsible_party,responsible,start_date,due_date,description,source_name,confidence.',
    'confidence deve ser BAIXA, MEDIA ou ALTA. responsible_party deve ser CLIENTE, DEV, TERCEIRO, PMO ou A_CONFIRMAR.',
    'overall_status deve ser VERDE, AMARELO, VERMELHO ou A_CONFIRMAR.'
  ].join('\n\n');
  const system=[
    'Você é o Copiloto PMO do Instituto Államo.',
    'Trabalhe exclusivamente com evidências fornecidas e responda em português do Brasil.',
    'Nunca invente percentuais, SPI, horas, custos, datas, Go-live, responsáveis, decisões, marcos ou fatos.',
    'Sem evidência objetiva para um dado quantitativo: não altere o valor e registre o campo em quantitative_fields_without_evidence.',
    'Opinião não é decisão. Decisão exige registro explícito.',
    'Go-live, baseline, escopo, custo/orçamento, contrato e sponsor são críticos e sempre exigem validação humana.',
    'Toda mudança deve indicar fonte e evidence_quote curta.',
    'A IA apenas propõe. O PMO humano decide o que será salvo.'
  ].join('\n');

  const model=cfReportModel();let ai;
  try{ai=await env.AI.run(model,{messages:[{role:'system',content:system},{role:'user',content:prompt}],max_tokens:4500,temperature:0.2})}
  catch(e){return json({error:'Falha ao executar Cloudflare Workers AI.',detail:cfReportSafe(e?.message||e,300)},502)}
  const text=cfReportStr(ai?.response||ai?.result||ai?.output_text||ai?.text||'');
  let result;try{result=cfReportExtractJson(text)}catch(e){return json({error:'O modelo gratuito respondeu fora do JSON esperado. Tente novamente com um resumo mais objetivo.'},502)}
  for(const key of ['changes','risks','actions','decisions','roadmap_updates','warnings','quantitative_fields_without_evidence','sources_used'])if(!Array.isArray(result[key]))result[key]=[];
  if(!['VERDE','AMARELO','VERMELHO','A_CONFIRMAR'].includes(result.overall_status))result.overall_status='A_CONFIRMAR';
  result.executive_summary_suggestion=cfReportSafe(result.executive_summary_suggestion,12000);
  if(sources.some(s=>s?.file_data&&!s?.text))result.warnings.push('Há arquivo(s) sem texto anexado(s). O modo gratuito Cloudflare não utilizou o conteúdo desses arquivos nesta análise.');

  result.changes=result.changes.filter(ch=>fieldMap.has(ch?.target)).map(ch=>{
    const f=fieldMap.get(ch.target),quote=cfReportNorm(ch.evidence_quote),sourceKnown=sourceNames.some(n=>cfReportNorm(n)===cfReportNorm(ch.source_name))||(!sourceNames.length&&!!meeting),quoteOk=!!quote&&evidence.includes(quote),quant=cfReportQuantitative(f),critical=!!ch.critical||!!f.critical;
    return {...ch,label:ch.label||f.label,old_value:cfReportStr(f.value),critical,requires_manual_validation:!!ch.requires_manual_validation||critical||!sourceKnown||(quant&&!quoteOk)};
  });

  const runId=cfReportRunId();
  await DB.prepare('INSERT INTO report_ai_runs(id,scope_type,scope_id,company_id,project_id,model,input_summary,output_json,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(runId,ctx.scope_type,ctx.scope_id,ctx.company_id||'',ctx.project_id||null,'cloudflare:'+model,cfReportSafe(meeting||sourceNames.join(', '),1000),JSON.stringify(result),'GENERATED',user.name).run();
  await logEvent(env,user,'report-ai:gerar',ctx.scope_type+' '+ctx.scope_id,`run ${runId} · Cloudflare Workers AI · ${model}`);
  return json({ok:true,run_id:runId,model,provider:'Cloudflare Workers AI',free_mode:true,result,report_ref:ctx.data?.ref||'',approval_required:true});
}
