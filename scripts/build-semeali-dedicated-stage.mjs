import fs from 'node:fs';
import path from 'node:path';

const src='public';
const portal=path.join(src,'semeali');
const out='semeali-dist';
const release=String(process.env.SEMEALI_RELEASE_SHA||'local').trim();

for(const file of ['index.html','app.js','data.js','live.js','live.css']){
  const p=path.join(portal,file);
  if(!fs.existsSync(p)) throw new Error(`Portal Semeali ausente: ${p}`);
}
if(!fs.existsSync(path.join(src,'_worker.js'))) throw new Error('Worker canônico ausente em public/_worker.js');

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

// Publica somente os artefatos necessários ao portal Semeali.
fs.copyFileSync(path.join(src,'_worker.js'),path.join(out,'_worker.js'));
for(const file of ['app.js','data.js','live.js','live.css'])fs.copyFileSync(path.join(portal,file),path.join(out,file));

let index=fs.readFileSync(path.join(portal,'index.html'),'utf8');
const fingerprint=`<meta name="semeali-release" content="${release.replace(/[^a-zA-Z0-9._-]/g,'')}">`;
const liveCss='<link rel="stylesheet" href="./live.css" data-semeali-live="1">';
const liveJs='<script src="./live.js" data-semeali-live="1"></script>';
index=index.includes('</head>')?index.replace('</head>',`${fingerprint}\n${liveCss}\n</head>`):fingerprint+liveCss+index;
index=index.includes('</body>')?index.replace('</body>',`${liveJs}\n</body>`):index+liveJs;
fs.writeFileSync(path.join(out,'index.html'),index);

for(const marker of ['SEMEALI','Portal Comercial','Prospecção','Clientes & Carteira','Oportunidades','Rotas','Visitas','Inteligência de Mercado','data-semeali-live']){
  if(!index.includes(marker)) throw new Error(`Build dedicado Semeali inválido: ausente ${marker}`);
}
const live=fs.readFileSync(path.join(out,'live.js'),'utf8');
for(const marker of ['Área do Vendedor','Clima Agrícola','Mercado agora','semeali-live-market','semeali-weather','commercial-interactions','commercial-routes']){
  if(!live.includes(marker)) throw new Error(`Build dedicado Semeali live inválido: ausente ${marker}`);
}
if(/allamo-pmo/i.test(index)) throw new Error('A experiência dedicada Semeali não pode exibir allamo-pmo.');

const forbidden=['projects.html','pmo.html','clientes.html'];
for(const file of forbidden){
  if(fs.existsSync(path.join(out,file))) throw new Error(`Artefato de PMO indevido no build Semeali: ${file}`);
}

console.log(`OK: build dedicado Semeali em ${out}/ com mercado, clima e área do vendedor; release=${release}`);
