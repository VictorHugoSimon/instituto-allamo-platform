import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
if(!html.includes('[allamo-live-reset]')){
  const loadAt=html.indexOf('async loadData()');
  const companyAt=loadAt>=0?html.indexOf('const c = this.state.company;',loadAt):-1;
  if(loadAt<0||companyAt<0||companyAt-loadAt>800) throw new Error('Início de loadData não encontrado para reset visual.');
  const reset="/* [allamo-live-reset] nunca renderizar fotografia demo durante fetch */ this.companies=[];this.projects=[];this.issues=[];this.viradas=[];this.docs=[];this.forceUpdate(); ";
  html=html.slice(0,companyAt)+reset+html.slice(companyAt);
}
if(!html.includes('[allamo-live-reset]')) throw new Error('Reset visual live não aplicado.');
fs.writeFileSync(file,html);
console.log('OK: estado demo é zerado antes do fetch live.');
