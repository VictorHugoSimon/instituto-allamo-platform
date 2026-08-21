import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

if(html.includes('window.__allamoBootSeen')){
  // Segurança do tenant tem precedência sobre revelar fotografia embutida mais cedo.
  if(!html.includes('Date.now()+12000')) throw new Error('Timeout seguro do boot guard não encontrado.');
  if(!html.includes('now-quietSince>=200')) throw new Error('Janela de estabilidade do boot guard não encontrada.');
  if(!html.includes('seen.companies&&!!seen.projects')) throw new Error('Boot guard não espera companies/projects.');
  if(!html.includes('return !!seen.publicClient')) throw new Error('Boot guard não espera public-client-projects.');
  if(!html.includes('window.__allamoBootGuardStarted')) throw new Error('Boot guard não possui auto-start seguro.');
  fs.writeFileSync(file,html);
  console.log('OK: boot guard tenant-safe preservado; performance não revela dados antigos.');
}else{
  throw new Error('Boot guard tenant-safe ausente.');
}
