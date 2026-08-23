import fs from 'node:fs';
const file='public/index.html';
const runtime=fs.readFileSync('src/visual-matrix-enhancements.js','utf8');
let html=fs.readFileSync(file,'utf8');
const start='<!-- BEGIN ALLAMO VISUAL MATRICES -->',end='<!-- END ALLAMO VISUAL MATRICES -->';
const block=`${start}\n<script>\n${runtime}\n</script>\n${end}`;
if(html.includes(start)){
  const a=html.indexOf(start),b=html.indexOf(end,a);if(b<0)throw new Error('Marcador final das matrizes ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const at=html.lastIndexOf('</body>');if(at<0)throw new Error('body externo do artefato não encontrado.');
  html=html.slice(0,at)+block+'\n'+html.slice(at);
}
if(!html.includes('__allamoVisualMatricesLoaded'))throw new Error('Runtime visual não entrou no artefato.');
fs.writeFileSync(file,html);
console.log('OK: heatmap de riscos e visual RACI adicionados fora do JSON do bundler, sem corromper o template.');
