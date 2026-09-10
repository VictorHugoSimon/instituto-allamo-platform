import fs from 'node:fs';

const contextFile='scripts/bootstrap-madri-production-context.mjs';
const seedFile='scripts/seed-madri-governance-baseline-production.mjs';
const seedValidator='scripts/validate-madri-baseline-seed-production.mjs';
const workflowFile='.github/workflows/madri-production-bootstrap-authorized.yml';
const markerFile='ops/production/madri-bootstrap-authorized-2026-09-09.json';
const reqFile='data/madri/madri-governance-requirements-baseline.json.gz.b64';
const testFile='data/madri/madri-governance-tests-baseline.json.gz.b64';

for(const f of [contextFile,seedFile,seedValidator,workflowFile,markerFile,reqFile,testFile]){
  if(!fs.existsSync(f))throw new Error(`Arquivo obrigatório ausente: ${f}`);
}

const context=fs.readFileSync(contextFile,'utf8');
const seed=fs.readFileSync(seedFile,'utf8');
const workflow=fs.readFileSync(workflowFile,'utf8');
const marker=JSON.parse(fs.readFileSync(markerFile,'utf8'));
const destructive=/\b(?:DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente ${label}: ${needle}`)};

for(const [needle,label] of [
  ["const CONFIG='wrangler.production.toml'",'config exclusiva de Produção'],
  ["const CONFIRM='CREATE-MADRI-CONTEXT-PRODUCTION'",'confirmação de contexto produtivo'],
  ["id:'madri',name:'Madri'",'tenant canônico MADRI'],
  ["name:'Implantação NUCCI ERP'",'projeto canônico NUCCI'],
  ["migrations/2026-08-30-madri-pmo-master-plan.sql",'baseline do Plano Mestre'],
  ["pmo_scope='MADRI_NUCCI'",'escopo isolado MADRI'],
  ['Number(row.n)!==18','validação das 18 ações do baseline']
])must(context,needle,label);

if(/const\s+CONFIG\s*=\s*['"]wrangler\.stage\.toml['"]/.test(context))throw new Error('Bootstrap de contexto seleciona configuração STAGE.');
if(destructive.test(context))throw new Error('Bootstrap de contexto contém SQL destrutivo.');
if(!context.includes('INSERT INTO ${ident(table)}'))throw new Error('Bootstrap não usa inserção dinâmica compatível com schema.');
if(!context.includes("if(matches.length>1)throw new Error(`Tenant MADRI ambíguo"))throw new Error('Bootstrap não falha fechado para tenant ambíguo.');
if(!context.includes("if(matches.length>1)throw new Error(`Projeto NUCCI ambíguo"))throw new Error('Bootstrap não falha fechado para projeto ambíguo.');

for(const [needle,label] of [
  ["const CONFIG = 'wrangler.production.toml'",'seed em Produção'],
  ['SEED-MADRI-BASELINE-PRODUCTION','confirmação do seed'],
  ['requirements.length !== 86','86 requisitos'],
  ['tests.length !== 54','54 testes'],
  ['readiness = [','17 itens de readiness'],
  ['INSERT OR IGNORE INTO madri_requirements','seed idempotente de requisitos']
])must(seed,needle,label);
if(seed.includes('wrangler.stage.toml')||seed.includes('allamo-pmo-stage'))throw new Error('Seed contém referência a STAGE.');
if(destructive.test(seed))throw new Error('Seed contém SQL destrutivo.');

for(const [needle,label] of [
  ['push:','gatilho de execução pós-merge'],
  ['branches: [main]','branch principal'],
  ['ops/production/madri-bootstrap-authorized-2026-09-09.json','marcador one-shot'],
  ['Backup obrigatório do D1 Produção antes de qualquer escrita','backup antes de mutação'],
  ['--confirm=CREATE-MADRI-CONTEXT-PRODUCTION','apply de contexto autorizado'],
  ['--confirm=SEED-MADRI-BASELINE-PRODUCTION','apply de baseline autorizado'],
  ['ensure-madri-governance-schema.mjs --env=production --apply --confirm=APPLY-MADRI-GOV-PRODUCTION','schema MADRI produtivo'],
  ['retention-days: 30','retenção do backup']
])must(workflow,needle,label);
if(workflow.includes('wrangler.stage.toml')||workflow.includes('allamo-pmo-stage'))throw new Error('Workflow autorizado contém referência a STAGE.');
if(destructive.test(workflow))throw new Error('Workflow autorizado contém SQL destrutivo.');
const backupPos=workflow.indexOf('Backup obrigatório do D1 Produção antes de qualquer escrita');
const contextPos=workflow.indexOf('--apply --confirm=CREATE-MADRI-CONTEXT-PRODUCTION');
const seedPos=workflow.indexOf('--apply --confirm=SEED-MADRI-BASELINE-PRODUCTION');
if(!(backupPos>=0&&contextPos>backupPos&&seedPos>contextPos))throw new Error('Ordem segura inválida: backup deve preceder contexto e baseline.');

if(marker.authorized!==true)throw new Error('Marcador não contém authorized=true.');
if(marker.company!=='Madri'||marker.project!=='Implantação NUCCI ERP')throw new Error('Escopo do marcador não corresponde a Madri / Implantação NUCCI ERP.');
if(marker.pmo_scope!=='MADRI_NUCCI')throw new Error('Escopo PMO do marcador inválido.');
if(marker.environment!=='production')throw new Error('Marcador não está limitado a production.');
if(marker.baseline?.requirements!==86||marker.baseline?.tests!==54||marker.baseline?.phases!==15||marker.baseline?.readiness!==17||marker.baseline?.actions!==18)throw new Error('Contagens do baseline autorizado estão incorretas.');

console.log('[OK] Bootstrap MADRI Produção: autorização explícita, one-shot, backup-first, contexto Madri/NUCCI isolado, Plano Mestre 18 e baseline 86/54/15/17 validados.');
