import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const file='public/index.html';
const original=fs.readFileSync(file,'utf8');
const open='<script type="__bundler/template">';

function readTemplate(html){
  const a=html.indexOf(open);
  if(a<0)throw new Error('Template do bundler ausente no teste de recuperação.');
  const start=a+open.length;
  const end=html.indexOf('</script>',start);
  if(end<0)throw new Error('Fechamento do template ausente no teste de recuperação.');
  return {start,end,template:JSON.parse(html.slice(start,end))};
}

try{
  const parsed=readTemplate(original);
  const companyNeedle='const c = this.state.company;';
  if(!parsed.template.includes(companyNeedle))throw new Error('loadData sem ponto de injeção para simular artefato legado.');

  const legacy="/* [allamo-load-initial-reset] */ if(!this.__allamoLegacyResetTest){this.__allamoLegacyResetTest=true;this.companies=[];this.projects=[];} ";
  const staleTemplate=parsed.template.replace(companyNeedle,legacy+companyNeedle);
  const serialized=JSON.stringify(staleTemplate).replace(/<\//gi,'<\\u002F');
  const stale=original.slice(0,parsed.start)+serialized+original.slice(parsed.end);
  fs.writeFileSync(file,stale);

  execFileSync(process.execPath,['scripts/zero-live-state-before-fetch.mjs'],{stdio:'pipe'});

  const healed=fs.readFileSync(file,'utf8');
  const healedParsed=readTemplate(healed);
  if(healedParsed.template.includes('[allamo-load-initial-reset]'))throw new Error('Build não removeu o reset inicial legado.');
  if(!healedParsed.template.includes('[allamo-load-initial-continuity]'))throw new Error('Build não preservou a continuidade nova após autocorreção.');
  if(!healedParsed.template.includes("sessionStorage.getItem('allamo_portfolio_snapshot_v2')"))throw new Error('Snapshot efêmero da carteira não foi preservado.');
  JSON.parse(healed.slice(healedParsed.start,healedParsed.end));
  console.log('OK: build autocorrige public/index.html legado sem git reset e mantém continuidade da carteira.');
} finally {
  fs.writeFileSync(file,original);
}
