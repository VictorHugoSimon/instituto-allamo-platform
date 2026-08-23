import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// Trabalha sobre o JSON real do template do bundler, evitando depender da
// quantidade de barras de escape existente no arquivo final.
const open='<script type="__bundler/template">';
const a=html.indexOf(open);
if(a<0) throw new Error('Template do bundler não encontrado.');
const start=a+open.length;
const end=html.indexOf('</script>',start);
if(end<0) throw new Error('Fechamento do template do bundler não encontrado.');

let template;
try{ template=JSON.parse(html.slice(start,end)); }
catch(err){ throw new Error('Template do bundler contém JSON inválido: '+String(err&&err.message||err)); }

// O formulário não deve depender do binding visual value="{{ ... }}".
// Os handlers onEmail/onPassword continuam responsáveis por atualizar o estado,
// enquanto o navegador pode usar autocomplete de forma nativa.
template=template
  .split('value="{{ emailVal }}"')
  .join('autocomplete="username" autocapitalize="none" spellcheck="false"')
  .split('value="{{ passwordVal }}"')
  .join('autocomplete="current-password"');

if(template.includes('value="{{ emailVal }}"')) throw new Error('Binding literal emailVal ainda existe no input de login.');
if(template.includes('value="{{ passwordVal }}"')) throw new Error('Binding literal passwordVal ainda existe no input de senha.');
if(!template.includes('sc-camel-on-input="{{ onEmail }}"')) throw new Error('Handler onEmail foi perdido.');
if(!template.includes('sc-camel-on-input="{{ onPassword }}"')) throw new Error('Handler onPassword foi perdido.');
if(!template.includes('autocomplete="username"')) throw new Error('Autocomplete de usuário não aplicado.');
if(!template.includes('autocomplete="current-password"')) throw new Error('Autocomplete de senha não aplicado.');

// IMPORTANTE: JSON.parse() recupera tags HTML como </script>. Se JSON.stringify()
// gravar isso literalmente dentro de <script type="__bundler/template">, o parser
// HTML encerra o bloco antes da hora e o próximo hardening recebe JSON truncado.
// Escapar a barra como \u002F preserva exatamente o mesmo valor após JSON.parse(),
// mas impede fechamento prematuro do elemento <script> no artefato.
const serialized=JSON.stringify(template).replace(/<\//gi,'<\\u002F');
try{
  const roundTrip=JSON.parse(serialized);
  if(roundTrip!==template) throw new Error('round-trip alterou o template');
}catch(err){
  throw new Error('Falha ao serializar template do login com segurança: '+String(err&&err.message||err));
}
if(serialized.toLowerCase().includes('</script')) throw new Error('Serialização insegura: </script> literal permaneceu no JSON do bundler.');

html=html.slice(0,start)+serialized+html.slice(end);
fs.writeFileSync(file,html);
console.log('OK: login sem bindings literais, autocomplete nativo, handlers preservados e JSON do bundler protegido contra fechamento prematuro.');
