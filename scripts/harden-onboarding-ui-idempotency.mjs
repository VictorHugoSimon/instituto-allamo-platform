import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
const open='<script type="__bundler/template">';
const a=html.indexOf(open);
if(a<0) throw new Error('Template do bundler não encontrado.');
const start=a+open.length;
const end=html.indexOf('</script>',start);
if(end<0) throw new Error('Fechamento do template do bundler não encontrado.');
let template;
try{template=JSON.parse(html.slice(start,end));}
catch(err){throw new Error('Template inválido: '+String(err?.message||err));}

const marker='// [allamo-onboarding-ui-idempotency]';
let changed=false;
function replaceOnce(needle,replacement,label){
  const count=template.split(needle).length-1;
  if(count!==1) throw new Error(`Contrato inesperado para ${label}: ocorrências=${count}`);
  template=template.replace(needle,replacement);
  changed=true;
}

if(!template.includes(marker)){
  replaceOnce(
    "  async api(path, opts = {}) {",
    `  ${marker}\n  onboardingRequestId(kind){\n    const raw=(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')?globalThis.crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2));\n    return ('pmo-'+String(kind||'request')+'-'+raw).replace(/[^A-Za-z0-9._:-]/g,'').slice(0,120);\n  }\n  async api(path, opts = {}) {`,
    'helper de request_id'
  );

  replaceOnce(
    "  closeModal(){ this.setState({ modal:null, formError:'' }); }",
    "  closeModal(){ this.setState({ modal:null, formError:'', companyRequestId:null, projectRequestId:null }); }",
    'limpeza de request_id ao cancelar'
  );

  replaceOnce(
    "else { await this.api('company-create',{method:'POST',body:JSON.stringify(f)}); }",
    "else { if(!this.state.token) throw new Error('Onboarding exige sessão humana autenticada. Faça login para cadastrar empresa.'); const requestId=this.state.companyRequestId||this.onboardingRequestId('company'); if(!this.state.companyRequestId)this.setState({companyRequestId:requestId}); await this.api('company-create',{method:'POST',headers:{'Idempotency-Key':requestId},body:JSON.stringify(f)}); }",
    'POST de empresa'
  );

  replaceOnce(
    "await this.loadData(); this.setState({modal:null,saving:false}); this.forceUpdate();",
    "await this.loadData(); this.setState({modal:null,saving:false,companyRequestId:null}); this.forceUpdate();",
    'sucesso de empresa'
  );

  replaceOnce(
    "    if(!f.name.trim()){ this.setState({ formError:'Informe o nome do projeto.' }); return; }",
    "    if(!f.name.trim()){ this.setState({ formError:'Informe o nome do projeto.' }); return; }\n    if(!f.company_id){ this.setState({ formError:'Selecione a empresa do projeto.' }); return; }",
    'validação empresa do projeto'
  );

  replaceOnce(
    "try{ await this.api('projects',{ method:'POST', body:JSON.stringify(f) }); await this.loadData(); this.setState({ modal:null, saving:false }); this.forceUpdate(); }",
    "try{ if(!this.state.token) throw new Error('Onboarding exige sessão humana autenticada. Faça login para cadastrar projeto.'); const requestId=this.state.projectRequestId||this.onboardingRequestId('project'); if(!this.state.projectRequestId)this.setState({projectRequestId:requestId}); await this.api('projects',{ method:'POST', headers:{'Idempotency-Key':requestId}, body:JSON.stringify(f) }); await this.loadData(); this.setState({ modal:null, saving:false, projectRequestId:null }); this.forceUpdate(); }",
    'POST de projeto'
  );
}else{
  console.log('OK: UI de onboarding já contém idempotência explícita.');
}

for(const required of [
  marker,
  "headers:{'Idempotency-Key':requestId}",
  "headers:{'Idempotency-Key':requestId}, body:JSON.stringify(f)",
  "companyRequestId:null",
  "projectRequestId:null",
  "Selecione a empresa do projeto.",
  "Onboarding exige sessão humana autenticada. Faça login para cadastrar empresa.",
  "Onboarding exige sessão humana autenticada. Faça login para cadastrar projeto."
]){
  if(!template.includes(required)) throw new Error('Hardening de onboarding incompleto: '+required);
}

if(changed){
  const serialized=JSON.stringify(template).replace(/<\//gi,'<\\u002F');
  if(serialized.toLowerCase().includes('</script')) throw new Error('Serialização insegura do template.');
  html=html.slice(0,start)+serialized+html.slice(end);
  fs.writeFileSync(file,html);
  console.log('OK: UI de onboarding envia Idempotency-Key, preserva retry e exige empresa/sessão.');
}else{
  console.log('OK: nenhum patch adicional necessário.');
}
