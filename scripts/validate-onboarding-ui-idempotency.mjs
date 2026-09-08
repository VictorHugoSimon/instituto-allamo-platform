import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const index=read('public/index.html');
const hardener=read('scripts/harden-onboarding-ui-idempotency.mjs');
const pkg=JSON.parse(read('package.json'));

function must(haystack,needle,label){
  if(!haystack.includes(needle)) throw new Error(`Faltando ${label}: ${needle}`);
}

const open='<script type="__bundler/template">';
const a=index.indexOf(open);
if(a<0) throw new Error('Template do bundler não encontrado.');
const start=a+open.length;
const end=index.indexOf('</script>',start);
if(end<0) throw new Error('Fechamento do template não encontrado.');
const template=JSON.parse(index.slice(start,end));

must(template,'// [allamo-onboarding-ui-idempotency]','marcador de hardening UI');
must(template,"onboardingRequestId(kind)",'gerador de request_id');
must(template,"headers:{'Idempotency-Key':requestId}",'Idempotency-Key da empresa');
must(template,"headers:{'Idempotency-Key':requestId}, body:JSON.stringify(f)",'Idempotency-Key do projeto');
must(template,'companyRequestId:null','limpeza da chave de empresa');
must(template,'projectRequestId:null','limpeza da chave de projeto');
must(template,'Selecione a empresa do projeto.','validação local empresa→projeto');
must(template,'Faça login para cadastrar empresa.','feedback de sessão para empresa');
must(template,'Faça login para cadastrar projeto.','feedback de sessão para projeto');

const companyPost="await this.api('company-create',{method:'POST',headers:{'Idempotency-Key':requestId},body:JSON.stringify(f)})";
const projectPost="await this.api('projects',{ method:'POST', headers:{'Idempotency-Key':requestId}, body:JSON.stringify(f) })";
must(template,companyPost,'POST idempotente de empresa');
must(template,projectPost,'POST idempotente de projeto');

must(hardener,"this.state.companyRequestId||this.onboardingRequestId('company')",'retry estável da empresa');
must(hardener,"this.state.projectRequestId||this.onboardingRequestId('project')",'retry estável do projeto');
must(hardener,"closeModal(){ this.setState({ modal:null, formError:'', companyRequestId:null, projectRequestId:null }); }",'cancelamento limpa chaves');

must(pkg.scripts['build:work'],'harden-onboarding-ui-idempotency.mjs','hardener no build oficial');
must(pkg.scripts['test:mutation-safety'],'validate-onboarding-ui-idempotency.mjs','validador no gate de mutações');

console.log('OK: UI do onboarding está compatível com sessão humana + Idempotency-Key + retry sem duplicação.');
