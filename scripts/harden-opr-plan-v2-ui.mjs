import fs from 'node:fs';

const file='public/opr-plano-de-acao/index.html';
if(!fs.existsSync(file))throw new Error('Plano OPR ausente: '+file);
let s=fs.readFileSync(file,'utf8');

// O Plano OPR rico tornou-se o layout canônico. Este hardener não reconstrói mais a tela
// por substituições frágeis; ele apenas garante os recursos v2/v3 e a navegação global.
const required=[
  ['data-opr-plan-rich="1"','marcador do layout rico'],
  ['PA sequencial','PA sequencial'],
  ['Kanban','Kanban'],
  ['Histórico','Histórico'],
  ['Lixeira','Lixeira'],
  ['id="fAcceptance"','fAcceptance'],
  ['id="fEvidence"','fEvidence'],
  ['id="fSubfront"','Subfrente'],
  ['id="fPriority"','Prioridade'],
  ['id="fCriticality"','Criticidade'],
  ['id="fRisk"','Risco'],
  ['id="fClass"','Classificação'],
  ['opr-actions/','API de ações'],
  ['&trash=1','soft delete / lixeira'],
  ['/history','Histórico de ação'],
  ['/restore','Restauração'],
  ['ações concluídas ÷ ações rastreadas','regra do indicador operacional']
];
for(const [token,label] of required)if(!s.includes(token))throw new Error(`Plano OPR rico incompleto: ${label}`);

// Compatibilidade com os gates legados do pipeline. O marcador v2 identifica o contrato
// funcional preservado; o marcador rich identifica a nova composição visual canônica.
if(!s.includes('data-opr-plan-v2="1"')){
  s=s.replace('<meta data-opr-plan-rich="1">','<meta data-opr-plan-rich="1"><meta data-opr-plan-v2="1">');
}

// O Plano e o POP possuem navegação local própria. A navegação 01–15 entra somente como
// launcher/drawer não invasivo, preservando o layout e os submenus do módulo.
const bridge='<script src="/opr/assets/legacy-global-nav.js"></script>';
if(!s.includes('/opr/assets/legacy-global-nav.js')){
  if(!s.includes('</body>'))throw new Error('Fechamento body ausente no Plano OPR');
  s=s.replace('</body>',bridge+'\n</body>');
}

fs.writeFileSync(file,s);
console.log('OK: Plano Mestre OPR rico preservado — PA sequencial, campos completos, Kanban, Histórico, Lixeira, fAcceptance, fEvidence e navegação global em drawer.');
