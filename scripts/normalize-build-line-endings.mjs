import fs from 'node:fs';

const files=['public/_worker.js','public/index.html'];
for(const file of files){
  if(!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
  const raw=fs.readFileSync(file,'utf8');
  const normalized=raw.replace(/\r\n?/g,'\n');
  if(raw!==normalized) fs.writeFileSync(file,normalized,'utf8');
}
console.log('OK: entradas do build normalizadas para LF (compatível com Windows CRLF e CI Linux).');
