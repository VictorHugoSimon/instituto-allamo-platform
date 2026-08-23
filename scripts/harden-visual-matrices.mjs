import fs from 'node:fs';
const file='public/index.html';
const runtime=fs.readFileSync('src/visual-matrix-enhancements.js','utf8');
let html=fs.readFileSync(file,'utf8');
const open='<script type="__bundler/template">',close='</script>';
const a=html.indexOf(open);if(a<0)throw new Error('Template do bundler não encontrado.');
const s=a+open.length,e=html.indexOf(close,s);if(e<0)throw new Error('Fechamento do template não encontrado.');
let template=JSON.parse(html.slice(s,e));if(typeof template!=='string')throw new Error('Template não é string.');
const start='<!-- BEGIN ALLAMO VISUAL MATRICES -->',end='<!-- END ALLAMO VISUAL MATRICES -->';
const block=`${start}\n<script>\n${runtime}\n</script>\n${end}`;
if(template.includes(start)){
  const x=template.indexOf(start),y=template.indexOf(end,x);if(y<0)throw new Error('Marcador final das matrizes ausente.');
  template=template.slice(0,x)+block+template.slice(y+end.length);
}else{
  if(!template.includes('</body>'))throw new Error('body final não encontrado.');
  template=template.replace('</body>',block+'\n</body>');
}
if(!template.includes('__allamoVisualMatricesLoaded'))throw new Error('Runtime visual não entrou no template.');
const serialized=JSON.stringify(template);JSON.parse(serialized);
html=html.slice(0,s)+serialized+html.slice(e);fs.writeFileSync(file,html);
console.log('OK: heatmap de riscos e visual RACI adicionados ao artefato final.');
