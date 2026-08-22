import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// O runtime do bundle pode exibir literalmente {{ emailVal }}/{{ passwordVal }}
// antes/na falha parcial de hidratação. Login deve funcionar como formulário HTML
// normal, enquanto os handlers onEmail/onPassword mantêm o estado da aplicação.
const pairs=[
  ['value=\\\"{{ emailVal }}\\\"','autocomplete=\\\"username\\\" autocapitalize=\\\"none\\\" spellcheck=\\\"false\\\"'],
  ['value=\\\"{{ passwordVal }}\\\"','autocomplete=\\\"current-password\\\"']
];
for(const [from,to] of pairs) html=html.split(from).join(to);

if(html.includes('value=\\\"{{ emailVal }}\\\"')) throw new Error('Binding literal emailVal ainda existe no input de login.');
if(html.includes('value=\\\"{{ passwordVal }}\\\"')) throw new Error('Binding literal passwordVal ainda existe no input de senha.');
if(!html.includes('sc-camel-on-input=\\\"{{ onEmail }}\\\"')) throw new Error('Handler onEmail foi perdido.');
if(!html.includes('sc-camel-on-input=\\\"{{ onPassword }}\\\"')) throw new Error('Handler onPassword foi perdido.');
if(!html.includes('autocomplete=\\\"username\\\"')) throw new Error('Autocomplete de usuário não aplicado.');
if(!html.includes('autocomplete=\\\"current-password\\\"')) throw new Error('Autocomplete de senha não aplicado.');

fs.writeFileSync(file,html);
console.log('OK: login sem bindings literais, com autocomplete nativo e handlers preservados.');
