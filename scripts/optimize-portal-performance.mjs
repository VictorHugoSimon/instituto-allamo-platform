import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

if(html.includes('window.__allamoBootSeen')){
  // Guard novo: segurança do tenant tem precedência sobre revelar a fotografia embutida mais cedo.
  if(!html.includes('Date.now()+10000')) throw new Error('Timeout seguro do boot guard novo não encontrado.');
  if(!html.includes('now-quietSince>=250')) throw new Error('Janela de estabilidade do boot guard novo não encontrada.');
  if(!html.includes('seen.companies&&!!seen.projects')) throw new Error('Boot guard novo não espera companies/projects.');
  if(!html.includes('return !!seen.public')) throw new Error('Boot guard novo não espera API pública.');
  fs.writeFileSync(file,html);
  console.log('OK: boot guard tenant-safe preservado; nenhuma otimização pode revelar dados embutidos antes das APIs reais.');
}else{
  // Compatibilidade com artefatos legados ainda sem o guard tenant-safe.
  html=html.split('var quietSince=0,max=Date.now()+6000').join('var quietSince=0,max=Date.now()+1800');
  html=html.split('now-quietSince>=700').join('now-quietSince>=120');
  html=html.split('setTimeout(tick,75)').join('setTimeout(tick,30)');
  if(html.includes('Date.now()+6000')||html.includes('now-quietSince>=700')) throw new Error('Boot guard antigo ainda presente.');
  if(!html.includes('Date.now()+1800')||!html.includes('now-quietSince>=120')||!html.includes('setTimeout(tick,30)')) throw new Error('Marcadores de performance legados não encontrados.');
  fs.writeFileSync(file,html);
  console.log('OK: boot guard legado otimizado.');
}
