import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const stage=read('src/stage-runtime-bootstrap.js');
const reports=read('src/report-schema-bootstrap.js');
const freshness=read('src/data-freshness-runtime.js');
const index=read('public/index.html');
const pkg=JSON.parse(read('package.json'));
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(stage,'globalThis.__allamoStageCoreSchemaPromise','Bootstrap central compartilhado por isolate');
must(stage,"mode: 'once-per-isolate'",'Estado do bootstrap central expõe modo serializado');
must(stage,'await globalThis.__allamoStageCoreSchemaPromise','Requisições simultâneas aguardam a mesma Promise');
must(reports,'globalThis.__allamoStageReportSchemaPromise','Schema de Reports compartilhado por isolate');
must(reports,"mode:'once-per-isolate'",'Estado do schema de Reports expõe modo serializado');
must(reports,'await globalThis.__allamoStageReportSchemaPromise','Reports aguardam bootstrap único');
must(freshness,'retryableRead','Retry só é habilitado para leitura');
must(freshness,'res.status===503','503 transitório dispara retry de leitura');
must(freshness,'attempt<2','Retry é limitado e não entra em loop');
must(freshness,"method==='GET'||method==='HEAD'",'Mutações não são repetidas automaticamente');
must(index,'data-report-central-warning','Central de Reports degrada parcialmente sem abortar a tela');
must(index,'Promise.allSettled','Central carrega fontes de forma independente');

const build=String(pkg.scripts['build:work']||'');
must(build,'harden-report-central-resilience.mjs','Hardening da Central faz parte do artefato');
const release=String(pkg.scripts['test:release']||'');
must(release,'test:stage-api-resilience','Gate de release cobre a correção de 503');

console.log('OK: Stage serializa bootstrap D1, GETs repetem 503 transitório com limite e Central de Reports mantém fontes disponíveis.');
