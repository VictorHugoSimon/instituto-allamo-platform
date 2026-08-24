import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};

must('allamoNoLoginReportHost','Central de Reports reconhece host oficial sem login');
must('allamoNoLoginAdminHost','Navegação de Reports reconhece host oficial sem login');
must('allamo-no-login-profile-cleaner','Cleaner do perfil no cabeçalho');
must('data-allamo-hidden-profile','Marca de remoção do perfil');
must('data-allamo-hidden-avatar','Marca de remoção do avatar');
must('data-allamo-hidden-auth-ui','Marca de remoção do botão Sair');

const oldReport="const api=async(p,o={})=>{const t=tok();if(!t)throw new Error('Sessão não encontrada')";
const oldNav="const api=async p=>{const t=token();if(!t)return []";
if(html.includes(oldReport))throw new Error('Central de Reports ainda depende de allamo_session.');
if(html.includes(oldNav))throw new Error('Navegação de Reports ainda aborta sem token.');

console.log('OK: Reports operam no modo sem login e nome/avatar/cargo não aparecem no cabeçalho oficial.');
