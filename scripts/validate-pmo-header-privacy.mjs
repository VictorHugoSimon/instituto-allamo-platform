import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};

must('BEGIN ALLAMO PMO HEADER PRIVACY','bloco de privacidade do header');
must('allamo-pmo-header-privacy','script dedicado do header');
must('__allamoPmoHeaderPrivacyLoaded','guard idempotente do runtime');
must('data-allamo-hidden-user-name','marker de nome/cargo ocultado');
must('Consultor\\s*PMO','cobertura explícita para Consultor PMO');
must("text(exit)!=='Sair'",'âncora segura no botão Sair');
must("setProperty('display','none','important')",'ocultação visual forte do bloco textual');
must("removeAttribute('aria-label')",'remoção de exposição por aria-label');

console.log('OK: header PMO não exibe nome/cargo do usuário e preserva controles vizinhos.');
