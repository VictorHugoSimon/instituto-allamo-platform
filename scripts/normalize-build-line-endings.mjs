import fs from 'node:fs';

const files=['public/_worker.js','public/index.html'];
for(const file of files){
  const original=fs.readFileSync(file,'utf8');
  const normalized=original.replace(/\r\n?/g,'\n');
  if(normalized!==original) fs.writeFileSync(file,normalized,'utf8');
}

console.log('OK: arquivos-base do build normalizados para LF; compatível com checkout CRLF do Windows.');
