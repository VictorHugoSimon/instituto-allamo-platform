const base='https://allamo-pmo-stage.pages.dev';
const raw=async(path,opt={})=>{const r=await fetch(base+path,{...opt,headers:{'cache-control':'no-store','content-type':'application/json',...(opt.headers||{})}});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {r,data,text}};
let id='';
try{
  const companies=(await raw('/api/companies')).data;
  const projects=(await raw('/api/projects')).data;
  const pair=companies.map(c=>({company:c,project:projects.find(p=>String(p.company_id)===String(c.id))})).find(x=>x.project);
  console.log('SELECTED',JSON.stringify({company:{id:pair?.company?.id,type:typeof pair?.company?.id,name:pair?.company?.name},project:{id:pair?.project?.id,type:typeof pair?.project?.id,company_id:pair?.project?.company_id,name:pair?.project?.name}}));
  const payload={company_id:pair.company.id,project_id:pair.project.id,document_type:'DOR',sprint_name:'DEBUG-CONTEXT',title:'DEBUG CONTEXT',content:{debug:true}};
  const created=await raw('/api/sprint-documents',{method:'POST',body:JSON.stringify(payload)});
  console.log('CREATE',created.r.status,JSON.stringify(created.data));
  id=created.data?.id||'';
  if(!id)process.exitCode=2;
  if(id){
    const opened=await raw('/api/sprint-documents/'+encodeURIComponent(id));
    console.log('OPEN',opened.r.status,JSON.stringify({id:opened.data?.id,company_id:opened.data?.company_id,company_type:typeof opened.data?.company_id,project_id:opened.data?.project_id,project_type:typeof opened.data?.project_id,company_name:opened.data?.company_name,project_name:opened.data?.project_name,full:opened.data}));
  }
}finally{
  if(id){const archived=await raw('/api/sprint-documents/'+encodeURIComponent(id)+'/archive',{method:'POST',body:'{}'});console.log('ARCHIVE',archived.r.status,JSON.stringify(archived.data));}
}
