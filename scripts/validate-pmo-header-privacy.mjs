import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};
const forbid=(value,label)=>{if(value.includes(label))throw new Error(`Proibido: ${label}`)};

const open='<script type="__bundler/template">';
const a=html.indexOf(open)+open.length;
const b=html.indexOf('</script>',a);
if(a<open.length||b<a)throw new Error('Template serializado não encontrado.');
const template=JSON.parse(html.slice(a,b));
const marker='data-allamo-pmo-header-actions="1"';
const markerAt=template.indexOf(marker);
if(markerAt<0)throw new Error('Bloco oficial de ações do header não encontrado.');
const headerStart=template.lastIndexOf('<header',markerAt);
const headerEnd=template.indexOf('</header>',markerAt);
const header=template.slice(headerStart,headerEnd);

must('BEGIN ALLAMO PMO HEADER PRIVACY','bloco de privacidade do header');
must('allamo-pmo-header-privacy','script dedicado do header');
must('__allamoPmoHeaderPrivacyLoaded','guard idempotente do runtime');
must('data-allamo-user-identity-free','marker de identidade integralmente removida');
must("text(exit)!=='Sair'",'âncora segura no botão Sair');
must('removeIdentity(candidate)','remoção estrutural independente de iniciais');
must("removeAttribute('aria-label')",'remoção de exposição por aria-label');
must("new MutationObserver(function(){clean();})",'proteção contra re-renderização');

for(const token of ['{{ avatarHeaderEl }}','{{ userName }}','{{ roleLabel }}'])forbid(header,token);
for(const control of ['>Empresa</span>','{{ companyOptions }}','{{ onCompanyChange }}','>🔔','data-allamo-header-logout="1"','>Sair</button>','id="om-install"','↓ Instalar app']){
  if(!header.includes(control))throw new Error(`Controle obrigatório ausente do header: ${control}`);
}
if((header.match(/>Sair<\/button>/g)||[]).length!==1)throw new Error('O header deve conter exatamente um botão Sair.');

console.log('OK: header PMO sem nome, cargo, foto, avatar, badge ou iniciais; empresa, sino, Sair e Instalar app preservados.');
