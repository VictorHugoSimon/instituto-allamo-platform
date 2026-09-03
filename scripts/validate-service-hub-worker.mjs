import fs from 'node:fs';

const api=fs.readFileSync('src/service-hub-worker-api.js','utf8');
const hardener=fs.readFileSync('scripts/harden-service-hub.mjs','utf8');
const worker=fs.readFileSync('public/_worker.js','utf8');
const migration=fs.readFileSync('migrations/2026-09-01-valkiria-service-hub-foundation.sql','utf8');
const ensure=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');
const pkg=fs.readFileSync('package.json','utf8');

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',api);

const must=(content,needle,label)=>{if(!content.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const tables=['service_hub_systems','service_hub_channels','service_hub_sla_policies','service_hub_routing_rules','service_hub_tickets','service_hub_ticket_events','service_hub_messages','service_hub_audit_log'];
for(const table of tables){must(migration,`CREATE TABLE IF NOT EXISTS ${table}`,`migration ${table}`);must(ensure,`'${table}'`,`gate aditivo ${table}`);must(api,`'${table}'`,`readiness ${table}`)}

must(api,"path==='service-hub/health'",'health do Service Hub');
must(api,"path==='service-hub/tickets'",'API de chamados');
must(api,"SELECT id,name,company_id FROM projects WHERE id=? AND company_id=?",'validação projeto/tenant');
must(api,"service_hub_schema_missing",'fail closed sem schema');
must(api,"business_hours_sla_not_supported_in_mvp",'bloqueio SLA comercial sem calendário');
must(api,"[EMAIL_REDACTED]",'sanitização de PII');
must(api,"title=shwRedact",'sanitização do título do chamado');
must(api,"first_responded_at=?",'registro de primeira resposta do SLA');
must(api,"firstResponseRecorded",'auditoria da primeira resposta');
must(hardener,'BEGIN ALLAMO VALKIRIA SERVICE HUB','marcador do hardener');
must(worker,'BEGIN ALLAMO VALKIRIA SERVICE HUB','bloco injetado no Worker');
must(ensure,'migrations/2026-09-01-valkiria-service-hub-foundation.sql','migration no schema aditivo');
must(pkg,'harden-service-hub.mjs','Service Hub no build:work');
must(pkg,'test:service-hub','gate do Service Hub no package');

console.log('SERVICE_HUB_WORKER_OK');
