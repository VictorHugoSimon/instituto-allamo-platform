import fs from 'node:fs';

const workerFile='public/_worker.js';
const indexFile='public/index.html';
const api=fs.readFileSync('src/public-client-manifest-api.js','utf8');
const runtime=fs.readFileSync('src/public-client-pwa-runtime.js','utf8');

let worker=fs.readFileSync(workerFile,'utf8');
const start='    // BEGIN ALLAMO PUBLIC CLIENT MANIFEST';
const end='    // END ALLAMO PUBLIC CLIENT MANIFEST';
const needle='    // BEGIN ALLAMO PUBLIC CLIENT PORTAL';
const block=start+'\n'+api.split('\n').map(x=>'    '+x).join('\n')+'\n'+end+'\n';
if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do manifesto público ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length+1);
}else{
  if(!worker.includes(needle))throw new Error('Ponto de injeção do manifesto público não encontrado.');
  worker=worker.replace(needle,block+needle);
}
if(!worker.includes("path==='public-client-manifest'"))throw new Error('Endpoint de manifesto público não foi injetado.');
fs.writeFileSync(workerFile,worker);

let html=fs.readFileSync(indexFile,'utf8');
const rStart='<!-- BEGIN ALLAMO PUBLIC CLIENT PWA RUNTIME -->';
const rEnd='<!-- END ALLAMO PUBLIC CLIENT PWA RUNTIME -->';
const rBlock=rStart+'\n<script>\n'+runtime+'\n</script>\n'+rEnd;
if(html.includes(rStart)){
  const a=html.indexOf(rStart),b=html.indexOf(rEnd,a);
  if(b<0)throw new Error('Marcador final do runtime PWA público ausente.');
  html=html.slice(0,a)+rBlock+html.slice(b+rEnd.length);
}else{
  if(!html.includes('</head>'))throw new Error('Head do portal não encontrado para runtime PWA.');
  html=html.replace('</head>',rBlock+'\n</head>');
}
if(!html.includes('public-client-manifest?company='))throw new Error('Runtime de manifesto tenant-safe não está no artefato.');
fs.writeFileSync(indexFile,html);
console.log('OK: PWA público usa manifesto dinâmico por tenant e start_url canônico sem login.');
