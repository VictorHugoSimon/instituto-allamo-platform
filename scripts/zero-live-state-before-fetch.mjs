import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
if(!html.includes('[allamo-live-reset]')){
  const needle="  async loadData() {\\\n    const c = this.state.company;";
  const replacement="  async loadData() {\\\n    /* [allamo-live-reset] nunca renderizar fotografia demo durante fetch */\\\n    this.companies=[]; this.projects=[]; this.issues=[]; this.viradas=[]; this.docs=[]; this.forceUpdate();\\\n    const c = this.state.company;";
  if(!html.includes(needle)) throw new Error('Início de loadData não encontrado para reset visual.');
  html=html.replace(needle,replacement);
}
if(!html.includes('[allamo-live-reset]')) throw new Error('Reset visual live não aplicado.');
fs.writeFileSync(file,html);
console.log('OK: estado demo é zerado antes do fetch live.');
