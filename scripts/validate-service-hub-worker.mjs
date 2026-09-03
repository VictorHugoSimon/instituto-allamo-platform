import fs from 'node:fs';

const api=fs.readFileSync('src/service-hub-worker-api.js','utf8');
const reviewApi=fs.readFileSync('src/service-hub-provider-events-api.js','utf8');
const webhook=fs.readFileSync('src/service-hub-whatsapp-webhook-api.js','utf8');
const metaProviderRaw=fs.readFileSync('service-hub/src/providers/meta-whatsapp.mjs','utf8');
const metaProvider=metaProviderRaw.replace(/\bexport\s+/g,'');
const hardener=fs.readFileSync('scripts/harden-service-hub.mjs','utf8');
const worker=fs.readFileSync('public/_worker.js','utf8');
const migration=fs.readFileSync('migrations/2026-09-01-valkiria-service-hub-foundation.sql','utf8');
const ingressMigration=fs.readFileSync('migrations/2026-09-03-valkiria-whatsapp-ingress.sql','utf8');
const ensure=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');
const pkg=fs.readFileSync('package.json','utf8');

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',api);
new AsyncFunction('request','DB','url','path','json','user','logEvent','env',reviewApi);
new AsyncFunction('request','env','url','path','json','DB',metaProvider+'\n'+webhook);

const must=(content,needle,label)=>{if(!content.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const tables=['service_hub_systems','service_hub_channels','service_hub_sla_policies','service_hub_routing_rules','service_hub_tickets','service_hub_ticket_events','service_hub_messages','service_hub_audit_log'];
for(const table of tables){must(migration,`CREATE TABLE IF NOT EXISTS ${table}`,`migration ${table}`);must(ensure,`'${table}'`,`gate aditivo ${table}`);must(api,`'${table}'`,`readiness ${table}`)}

must(ingressMigration,'CREATE TABLE IF NOT EXISTS service_hub_provider_events','quarentena de ingressos WhatsApp');
must(ingressMigration,"status IN ('unresolved','resolved','rejected','ignored')",'estados da quarentena');
must(ensure,"'service_hub_provider_events'",'gate aditivo da quarentena');
must(ensure,'migrations/2026-09-03-valkiria-whatsapp-ingress.sql','migration WhatsApp no schema aditivo');

must(api,"path==='service-hub/health'",'health do Service Hub');
must(api,"path==='service-hub/tickets'",'API de chamados');
must(api,"SELECT id,name,company_id FROM projects WHERE id=? AND company_id=?",'validação projeto/tenant');
must(api,"service_hub_schema_missing",'fail closed sem schema');
must(api,"business_hours_sla_not_supported_in_mvp",'bloqueio SLA comercial sem calendário');
must(api,"[EMAIL_REDACTED]",'sanitização de PII');
must(api,"title=shwRedact",'sanitização do título do chamado');
must(api,"first_responded_at=?",'registro de primeira resposta do SLA');
must(api,"firstResponseRecorded",'auditoria da primeira resposta');

must(metaProviderRaw,'verifyMetaChallenge','challenge Meta');
must(metaProviderRaw,'verifyMetaSignature','HMAC Meta');
must(metaProviderRaw,"error: 'invalid_timestamp'",'timestamp Meta fail-closed');
must(webhook,"path===shwMetaWebhookPath&&request.method==='GET'",'rota GET de verificação');
must(webhook,"path===shwMetaWebhookPath&&request.method==='POST'",'rota POST do webhook');
must(webhook,"request.headers.get('x-hub-signature-256')",'assinatura exigida no webhook');
must(webhook,"processing:'quarantine_only'",'ingresso não abre chamado automaticamente');
must(webhook,'shwMetaSenderHash','hash do remetente');
must(webhook,'shwMetaRedact','redaction antes de persistir');

must(reviewApi,"['admin','pmo','techlead']",'RBAC restrito da quarentena');
must(reviewApi,"user.__portal_no_login!==true",'PMO sintético sem login bloqueado na quarentena');
must(reviewApi,"authenticated_session_required",'fila exige sessão real');
must(reviewApi,"path===shpPathPrefix&&request.method==='GET'",'listagem da quarentena');
must(reviewApi,"['resolve','ignore','reject']",'decisões da quarentena');
must(reviewApi,"provider_event_already_reviewed",'máquina de estados bloqueia nova decisão sobre evento finalizado');
must(reviewApi,"WHERE id=? AND status='unresolved'",'transição concorrente somente a partir de unresolved');
must(reviewApi,"String(channel.provider)!=='whatsapp'",'resolução apenas para canal WhatsApp');
must(reviewApi,"SET status='resolved',channel_id=?,tenant_id=?,project_id=?",'resolução atribui tenant/projeto pelo canal');
must(reviewApi,'safeProviderMetadata','metadata filtrada');
if(reviewApi.includes('sender_ref_hash'))throw new Error('Fila administrativa não pode expor sender_ref_hash.');
if(reviewApi.includes('INSERT INTO service_hub_tickets'))throw new Error('Resolver quarentena não pode abrir chamado automaticamente.');
if(reviewApi.includes('INSERT INTO service_hub_messages'))throw new Error('Resolver quarentena não pode promover mensagem automaticamente.');

must(hardener,'BEGIN ALLAMO VALKIRIA SERVICE HUB','marcador do hardener');
must(hardener,'BEGIN ALLAMO VALKIRIA WHATSAPP WEBHOOK','marcador webhook do hardener');
must(hardener,'BEGIN ALLAMO VALKIRIA WHATSAPP QUARANTINE REVIEW','marcador fila de quarentena');
must(worker,'BEGIN ALLAMO VALKIRIA SERVICE HUB','bloco Service Hub injetado no Worker');
must(worker,'BEGIN ALLAMO VALKIRIA WHATSAPP WEBHOOK','bloco webhook injetado no Worker');
must(worker,'BEGIN ALLAMO VALKIRIA WHATSAPP QUARANTINE REVIEW','fila de quarentena injetada no Worker');
const webhookPos=worker.indexOf('BEGIN ALLAMO VALKIRIA WHATSAPP WEBHOOK');
const authPos=worker.indexOf("if (!user) return json({ error: 'Não autenticado' }, 401);");
const reviewPos=worker.indexOf('BEGIN ALLAMO VALKIRIA WHATSAPP QUARANTINE REVIEW');
const servicePos=worker.indexOf('BEGIN ALLAMO VALKIRIA SERVICE HUB');
if(webhookPos<0||authPos<0||webhookPos>authPos)throw new Error('Webhook WhatsApp não está antes do gate de autenticação de usuário.');
if(reviewPos<authPos)throw new Error('Fila de quarentena não está protegida por autenticação.');
if(servicePos>=0&&reviewPos>servicePos)throw new Error('Fila de quarentena deve executar antes da API tenant-scoped.');

must(ensure,'migrations/2026-09-01-valkiria-service-hub-foundation.sql','migration base no schema aditivo');
must(pkg,'harden-service-hub.mjs','Service Hub no build:work');
must(pkg,'test:service-hub','gate do Service Hub no package');

console.log('SERVICE_HUB_WORKER_OK');
