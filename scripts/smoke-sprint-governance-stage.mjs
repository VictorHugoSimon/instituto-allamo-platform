const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const marker='SG-SMOKE-'+Date.now().toString(36).toUpperCase();
const cleanupIds=[];

async function raw(path,opt={}){
  const headers={'cache-control':'no-store','pragma':'no-cache',...(opt.headers||{})};
  if(opt.body!=null&&!headers['content-type'])headers['content-type']='application/json';
  const r=await fetch(base+path,{redirect:'follow',cache:'no-store',...opt,headers});
  const text=await r.text();
  let data=null;try{data=JSON.parse(text)}catch{}
  return {r,text,data};
}

async function get(path){
  let last;
  for(let i=1;i<=6;i++){
    const out=await raw(path);
    if(out.r.ok)return out;
    last=out;
    if(out.r.status!==503)break;
    await sleep(2500);
  }
  return last;
}

async function expect(path,opt,status,label){
  const out=opt?.method==='GET'||!opt?.method?await get(path):await raw(path,opt);
  assert(out.r.status===status,`${label}: esperado HTTP ${status}, recebido ${out.r.status} · ${out.text.slice(0,220)}`);
  return out;
}

async function cleanup(){
  for(const id of [...cleanupIds].reverse()){
    try{
      let out=await raw('/api/sprint-documents/'+encodeURIComponent(id)+'/archive',{method:'POST',body:'{}'});
      if(out.r.status===404)continue;
      if(!out.r.ok)out=await raw('/api/sprint-documents/'+encodeURIComponent(id),{method:'DELETE'});
      if(!out.r.ok&&out.r.status!==404)console.warn('Cleanup DoR/DoD falhou',id,out.r.status,out.text.slice(0,120));
    }catch(e){console.warn('Cleanup DoR/DoD falhou',id,e.message)}
  }
}

let primaryError=null;
try{
  console.log('[1/14] painel e contrato visual...');
  const page=await expect('/governanca-sprint/',{method:'GET'},200,'Painel Governança de Sprint');
  for(const needle of ['Governança de Sprint','Definition of Ready','Definition of Done','Histórico de versões','data-new="DOR"','data-new="DOD"','duplicateDoc','archiveDoc','window.print()','calcGate','pct>=85','Cloudflare Pages + D1','@media(max-width:1050px)']){
    assert(page.text.includes(needle),'Painel não contém contrato funcional/visual: '+needle);
  }

  console.log('[2/14] descoberta de empresa/projeto e API base...');
  const companiesOut=await expect('/api/companies',{method:'GET'},200,'Empresas');
  const projectsOut=await expect('/api/projects',{method:'GET'},200,'Projetos');
  assert(Array.isArray(companiesOut.data)&&companiesOut.data.length>0,'Stage sem empresas para smoke DoR/DoD');
  assert(Array.isArray(projectsOut.data)&&projectsOut.data.length>0,'Stage sem projetos para smoke DoR/DoD');
  const pair=companiesOut.data.map(c=>({company:c,project:projectsOut.data.find(p=>String(p.company_id)===String(c.id))})).find(x=>x.project);
  assert(pair?.company?.id&&pair?.project?.id,'Nenhum par empresa/projeto válido para smoke DoR/DoD');
  const company=pair.company,project=pair.project;
  const initialList=await expect('/api/sprint-documents',{method:'GET'},200,'Lista DoR/DoD');
  assert(Array.isArray(initialList.data),'API sprint-documents não retornou lista');

  console.log('[3/14] validações negativas de criação...');
  await expect('/api/sprint-documents',{method:'POST',body:JSON.stringify({company_id:company.id,project_id:project.id,document_type:'INVALIDO'})},400,'Tipo inválido');
  await expect('/api/sprint-documents',{method:'POST',body:JSON.stringify({project_id:project.id,document_type:'DOR'})},400,'Empresa obrigatória');
  const cross=companiesOut.data.map(c=>({company:c,project:projectsOut.data.find(p=>String(p.company_id)!==String(c.id))})).find(x=>x.project);
  if(cross){
    const x=await expect('/api/sprint-documents',{method:'POST',body:JSON.stringify({company_id:cross.company.id,project_id:cross.project.id,document_type:'DOR'})},400,'Projeto cruzado entre empresas');
    assert(String(x.data?.error||'').includes('não pertence'),'Validação empresa/projeto cruzado sem mensagem esperada');
  }

  console.log('[4/14] criação real de DoR...');
  const dorPayload={
    company_id:company.id,project_id:project.id,document_type:'DOR',
    sprint_name:marker+' Ready',sprint_number:marker+'-01',title:'Definition of Ready · '+marker,
    cycle_start:'2026-09-01',cycle_end:'2026-09-15',status:'RASCUNHO',score:0,critical_pending:7,
    decision:'',content:{sprint_goal:'Objetivo '+marker,scope:'Escopo de teste',business_value:'Valor de teste',checks:{c1_1:false},evidences:[{type:'Smoke',reference:marker,observation:'Teste automatizado',status:'A preencher'}],notes_left:'',notes_right:'',decision:'',approvals:{po:'',tech:'',pmo:''}}
  };
  const dorCreate=await expect('/api/sprint-documents',{method:'POST',body:JSON.stringify(dorPayload)},201,'Criar DoR');
  const dorId=dorCreate.data?.id;assert(dorId,'Criação de DoR não retornou id');cleanupIds.push(dorId);

  console.log('[5/14] leitura e versão inicial do DoR...');
  let dor=await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'GET'},200,'Abrir DoR');
  assert(dor.data.document_type==='DOR','DoR criado com tipo incorreto');
  assert(String(dor.data.company_id)===String(company.id)&&String(dor.data.project_id)===String(project.id),'DoR perdeu escopo empresa/projeto');
  assert(dor.data.status==='RASCUNHO'&&Number(dor.data.score)===0,'DoR inicial não está em rascunho/score 0');
  assert(Array.isArray(dor.data.versions)&&dor.data.versions.length===1,'DoR não criou versão inicial');
  assert(dor.data.content?.sprint_goal==='Objetivo '+marker,'Conteúdo JSON do DoR não persistiu');

  console.log('[6/14] busca e filtros...');
  const qs=new URLSearchParams({company:String(company.id),project:String(project.id),type:'DOR',status:'RASCUNHO',q:marker});
  const filtered=await expect('/api/sprint-documents?'+qs,{method:'GET'},200,'Filtros DoR');
  assert(filtered.data.some(x=>x.id===dorId),'Filtros não localizaram DoR criado');
  const wrongType=await expect('/api/sprint-documents?type=DOD&q='+encodeURIComponent(marker),{method:'GET'},200,'Filtro tipo oposto');
  assert(!wrongType.data.some(x=>x.id===dorId),'Filtro DOD vazou DoR');

  console.log('[7/14] validações negativas de edição...');
  await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'PATCH',body:JSON.stringify({status:'INVALIDO'})},400,'Status inválido');
  await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'PATCH',body:JSON.stringify({document_type:'INVALIDO'})},400,'Tipo inválido em edição');
  dor=await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'GET'},200,'DoR após edição inválida');
  assert(dor.data.versions.length===1,'Edição inválida criou versão indevida');

  console.log('[8/14] edição, gate persistido e versionamento...');
  const updatedContent={...dor.data.content,sprint_goal:'Objetivo atualizado '+marker,decision:'READY_COM_RESSALVAS',notes_left:'Pendência não crítica',approvals:{po:'PO Smoke',tech:'Tech Smoke',pmo:'PMO Smoke'}};
  const patch=await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'PATCH',body:JSON.stringify({status:'APROVADO_COM_RESSALVAS',score:87,critical_pending:0,decision:'READY_COM_RESSALVAS',content:updatedContent})},200,'Editar DoR');
  assert(Number(patch.data?.version)===2,'Edição não gerou versão 2');
  dor=await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'GET'},200,'DoR editado');
  assert(dor.data.status==='APROVADO_COM_RESSALVAS'&&Number(dor.data.score)===87&&Number(dor.data.critical_pending)===0,'Gate editado não persistiu');
  assert(dor.data.content?.approvals?.pmo==='PMO Smoke','Aprovações não persistiram');

  console.log('[9/14] histórico e limites numéricos...');
  let versions=await expect('/api/sprint-documents/'+encodeURIComponent(dorId)+'/versions',{method:'GET'},200,'Histórico DoR');
  assert(Array.isArray(versions.data)&&versions.data.length===2&&Number(versions.data[0].version_no)===2,'Histórico não retornou versões 2→1');
  const clamp=await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'PATCH',body:JSON.stringify({score:999,critical_pending:1200})},200,'Clamp score/críticos');
  assert(Number(clamp.data?.version)===3,'Clamp não gerou versão 3');
  dor=await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'GET'},200,'DoR após clamp');
  assert(Number(dor.data.score)===100&&Number(dor.data.critical_pending)===999,'Limites score/críticos não foram aplicados');

  console.log('[10/14] duplicação...');
  const dup=await expect('/api/sprint-documents/'+encodeURIComponent(dorId)+'/duplicate',{method:'POST',body:JSON.stringify({sprint_name:marker+' Cópia',sprint_number:marker+'-COPY'})},201,'Duplicar DoR');
  const dupId=dup.data?.id;assert(dupId&&dupId!==dorId,'Duplicação não retornou novo id');cleanupIds.push(dupId);
  const dupDoc=await expect('/api/sprint-documents/'+encodeURIComponent(dupId),{method:'GET'},200,'Abrir cópia DoR');
  assert(dupDoc.data.document_type==='DOR'&&dupDoc.data.status==='RASCUNHO'&&Number(dupDoc.data.score)===0,'Cópia não nasceu como rascunho');
  assert(Array.isArray(dupDoc.data.versions)&&dupDoc.data.versions.length===1,'Cópia não criou versão inicial');

  console.log('[11/14] criação e filtro real de DoD...');
  const dodCreate=await expect('/api/sprint-documents',{method:'POST',body:JSON.stringify({company_id:company.id,project_id:project.id,document_type:'DOD',sprint_name:marker+' Done',sprint_number:marker+'-02',title:'Definition of Done · '+marker,critical_pending:8,content:{sprint_goal:'Fechamento '+marker,checks:{c1_1:false},evidences:[],approvals:{po:'',tech:'',pmo:''}}})},201,'Criar DoD');
  const dodId=dodCreate.data?.id;assert(dodId,'Criação de DoD não retornou id');cleanupIds.push(dodId);
  const dod=await expect('/api/sprint-documents/'+encodeURIComponent(dodId),{method:'GET'},200,'Abrir DoD');
  assert(dod.data.document_type==='DOD'&&dod.data.status==='RASCUNHO','DoD criado incorretamente');
  const dodFilter=await expect('/api/sprint-documents?type=DOD&q='+encodeURIComponent(marker),{method:'GET'},200,'Filtro DoD');
  assert(dodFilter.data.some(x=>x.id===dodId)&&!dodFilter.data.some(x=>x.id===dorId),'Filtro DoD não segregou tipos');

  console.log('[12/14] arquivamento pelo mesmo caminho usado na interface...');
  const archiveDup=await expect('/api/sprint-documents/'+encodeURIComponent(dupId),{method:'DELETE'},200,'Soft archive DoR duplicado');
  assert(archiveDup.data?.ok===true,'Soft archive não confirmou sucesso');
  cleanupIds.splice(cleanupIds.indexOf(dupId),1);
  await expect('/api/sprint-documents/'+encodeURIComponent(dupId),{method:'GET'},404,'Documento arquivado deve sair da leitura ativa');
  const postArchive=await expect('/api/sprint-documents/'+encodeURIComponent(dorId)+'/archive',{method:'POST',body:'{}'},200,'Soft archive alternativo DoR');
  assert(postArchive.data?.archived===true,'Endpoint de archive não confirmou archived=true');
  cleanupIds.splice(cleanupIds.indexOf(dorId),1);
  await expect('/api/sprint-documents/'+encodeURIComponent(dorId),{method:'GET'},404,'DoR arquivado deve sair da leitura ativa');
  await expect('/api/sprint-documents/'+encodeURIComponent(dodId),{method:'DELETE'},200,'Soft archive DoD');
  cleanupIds.splice(cleanupIds.indexOf(dodId),1);

  console.log('[13/14] lista ativa sem resíduos do smoke...');
  const after=await expect('/api/sprint-documents?q='+encodeURIComponent(marker),{method:'GET'},200,'Lista pós-arquivamento');
  assert(Array.isArray(after.data)&&after.data.length===0,'Documentos arquivados continuam na lista ativa: '+after.data.map(x=>x.id).join(','));

  console.log('[14/14] proteção contra exclusão destrutiva permanece ativa...');
  const destructive=await expect('/api/companies/__sprint_smoke_delete_guard__',{method:'DELETE'},403,'Guard DELETE destrutivo');
  assert(destructive.data?.code==='authenticated_session_required','Guard destrutivo perdeu código authenticated_session_required');

  console.log('SPRINT_GOVERNANCE_FULL_SMOKE_OK',JSON.stringify({base,company:company.id,project:project.id,marker,tests:14,initial_documents:initialList.data.length}));
}catch(e){
  primaryError=e;
}finally{
  await cleanup();
}
if(primaryError)throw primaryError;
