import fs from 'node:fs';

const file='public/index.html';
const runtimeFile='src/pmo-header-privacy-runtime.js';
const start='<!-- BEGIN ALLAMO PMO HEADER PRIVACY -->';
const end='<!-- END ALLAMO PMO HEADER PRIVACY -->';

let html=fs.readFileSync(file,'utf8');
const runtime=fs.readFileSync(runtimeFile,'utf8');
const block=`${start}\n<script id="allamo-pmo-header-privacy">\n${runtime}\n</script>\n${end}`;

if(html.includes(start)){
  const a=html.indexOf(start);
  const b=html.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do hardening de privacidade do header ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const at=html.lastIndexOf('</body>');
  if(at<0)throw new Error('body externo do artefato não encontrado para privacidade do header.');
  html=html.slice(0,at)+block+'\n'+html.slice(at);
}

if(!html.includes('__allamoPmoHeaderPrivacyLoaded'))throw new Error('Runtime de privacidade do header não entrou no artefato.');
if(!html.includes('data-allamo-hidden-user-name'))throw new Error('Marker de ocultação do nome do usuário ausente.');
if(!html.includes('Consultor\\s*PMO'))throw new Error('Cargo Consultor PMO não está coberto pelo cleaner.');

fs.writeFileSync(file,html);
console.log('OK: nome/cargo do usuário são ocultados no header PMO sem remover controles vizinhos.');
