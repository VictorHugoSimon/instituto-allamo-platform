import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

if(html.includes('window.__allamoBootSeen')){
  if(!html.includes('window.__allamoBootNonBlocking=true')) throw new Error('First paint não bloqueante ausente.');
  if(html.includes('body{visibility:hidden!important}')) throw new Error('Performance não pode reintroduzir bloqueio global do body.');
  if(!html.includes('Date.now()+12000')) throw new Error('Timeout seguro da sincronização não encontrado.');
  if(!html.includes('now-quietSince>=200')) throw new Error('Janela de estabilidade da sincronização não encontrada.');
  if(!html.includes('seen.companies&&!!seen.projects')) throw new Error('Sincronização não rastreia companies/projects.');
  if(!html.includes('return !!seen.publicClient')) throw new Error('Sincronização não rastreia public-client-projects.');
  if(!html.includes('window.__allamoBootGuardStarted')) throw new Error('Sincronização não possui auto-start seguro.');
  fs.writeFileSync(file,html);
  console.log('OK: sincronização tenant-safe preservada sem bloquear a interface.');
}else{
  throw new Error('Sincronização tenant-safe ausente.');
}
