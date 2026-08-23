import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const hardener=read('scripts/harden-governance-roadmap.mjs');
const stage=read('src/stage-runtime-bootstrap.js');
const migration=read('migrations/2026-08-23-governance-roadmap.sql');
const prod=read('.github/workflows/deploy-production.yml');
const stageWorkflow=read('.github/workflows/deploy-stage.yml');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(hardener,"'    // Health-check público APENAS no hostname de homologação.'",'injeção do schema antes do health');
must(hardener,'schemaPos>healthPos','gate de ordem schema/health');
for(const table of ['governance_events','governance_event_agenda_items','governance_event_stakeholders','governance_event_work_links','governance_event_decisions'])must(stage,`stageCount('${table}')`,`health conta ${table}`);
if(/\b(?:DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|DROP\s+DATABASE)\b/i.test(migration))throw new Error('Migration de governança contém SQL destrutivo.');
for(const table of ['governance_events','governance_event_agenda_items','governance_event_stakeholders','governance_event_work_links','governance_event_decisions'])must(migration,`CREATE TABLE IF NOT EXISTS ${table}`,`migration aditiva ${table}`);

must(prod,'workflow_dispatch:','Produção permanece manual');
if(/\npush:\s*\n\s*branches:\s*\[?main/i.test(prod))throw new Error('Produção não pode ter deploy automático por push.');
must(prod,'prepare-cloudflare-auth.mjs','Produção usa preparação de autenticação Cloudflare');
must(prod,'Backup obrigatório do D1 produtivo','Backup obrigatório');
must(prod,'Aplicar migration aditiva da Governança','Migration de governança no release');
must(prod,'Validar schema de Governança no D1 produtivo','Validação pós-migration');
must(prod,'Publicar exatamente o artefato validado em PRODUÇÃO','Deploy produtivo');
const backup=prod.indexOf('Backup obrigatório do D1 produtivo'),migrationStep=prod.indexOf('Aplicar migration aditiva da Governança'),schemaCheck=prod.indexOf('Validar schema de Governança no D1 produtivo'),deploy=prod.indexOf('Publicar exatamente o artefato validado em PRODUÇÃO');
if(!(backup>=0&&backup<migrationStep&&migrationStep<schemaCheck&&schemaCheck<deploy))throw new Error('Ordem segura de Produção inválida: backup → migration → schema → deploy.');

must(stageWorkflow,'push:','Stage deve publicar automaticamente após develop');
must(stageWorkflow,'branches: [develop]','Auto deploy somente em develop');
must(stageWorkflow,'npm run test:release','Stage executa gate consolidado');
must(stageWorkflow,'npm run smoke:governance','Stage executa smoke pós-deploy');
if(stageWorkflow.includes('--project-name allamo-pmo --branch main'))throw new Error('Workflow de Stage aponta para Produção.');

console.log('OK: release governado — schema antes do health, Stage automático com smoke e Produção manual com backup → migration aditiva → validação → deploy.');
