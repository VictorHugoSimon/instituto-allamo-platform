import fs from 'node:fs';
const index='public/index.html';
const source='src/pmo-cockpit-navigation.js';
if(!fs.existsSync(index))throw new Error('public/index.html não encontrado.');
if(!fs.existsSync(source))throw new Error('src/pmo-cockpit-navigation.js não encontrado.');

const nav=fs.readFileSync(source,'utf8').trim();
let html=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO PMO COCKPIT NAVIGATION -->';
const end='<!-- END ALLAMO PMO COCKPIT NAVIGATION -->';
const block=`${start}\n<script>\n${nav}\n</script>\n${end}`;

if(html.includes(start)){
  const a=html.indexOf(start);
  const b=html.indexOf(end,a);
  if(b<0)throw new Error('Marcador final da navegação PMO ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  if(!html.includes('</body>'))throw new Error('Ponto de injeção </body> não encontrado.');
  html=html.replace('</body>',block+'\n</body>');
}
fs.writeFileSync(index,html);
console.log('OK: navegação Cockpit Executivo PMO injetada no portal.');
