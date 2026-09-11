import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
const title='Distribuição do portfólio';
const titleAt=html.indexOf(title);
if(titleAt<0) throw new Error('Gráfico Distribuição do portfólio não encontrado.');

const legacyGradient='conic-gradient(#2f67a5 0 42.86%,#98a2b3 42.86% 71.43%,#16865c 71.43% 85.72%,#b42318 85.72% 100%)';
const gradientAt=html.indexOf(legacyGradient,titleAt);
if(gradientAt>=0) html=html.slice(0,gradientAt)+'#e5e7eb'+html.slice(gradientAt+legacyGradient.length);

const legendNeedle='3 Em andamento — 42,9%';
const legendAt=html.indexOf(legendNeedle,titleAt);
if(legendAt>=0){
  const centerAt=html.lastIndexOf('>7<br>',legendAt);
  if(centerAt>titleAt) html=html.slice(0,centerAt)+'>0<br>'+html.slice(centerAt+6);
}

const replacements=[
  ['3 Em andamento — 42,9%','0 Em andamento — 0,0%'],
  ['2 Backlog — 28,6%','0 Backlog — 0,0%'],
  ['1 Completo — 14,3%','0 Completo — 0,0%'],
  ['1 Cancelado — 14,3%','0 Cancelado — 0,0%']
];
for(const [from,to] of replacements) html=html.split(from).join(to);

for(const [legacy] of replacements){
  if(html.includes(legacy)) throw new Error('Valor histórico ainda presente no gráfico: '+legacy);
}
if(html.includes(legacyGradient)) throw new Error('Gradiente histórico do gráfico ainda presente.');

const runtime=fs.readFileSync('src/portfolio-work-distribution.js','utf8');
const start='<!-- BEGIN ALLAMO PORTFOLIO WORK DISTRIBUTION -->';
const end='<!-- END ALLAMO PORTFOLIO WORK DISTRIBUTION -->';
const block=`${start}\n<script>\n${runtime}\n</script>\n${end}`;
if(html.includes(start)){
  const a=html.indexOf(start),b=html.indexOf(end,a);
  if(b<0) throw new Error('Marcador final do gráfico operacional ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const at=html.lastIndexOf('</body>');
  if(at<0) throw new Error('body externo do artefato não encontrado.');
  html=html.slice(0,at)+block+'\n'+html.slice(at);
}
if(!html.includes('__allamoPortfolioWorkDistributionLoaded')) throw new Error('Runtime de demandas/tarefas não entrou no artefato.');

fs.writeFileSync(file,html);
console.log('OK: gráfico executivo inicia zerado e reflete demandas + tarefas reais por status, sem alterar o D1.');
