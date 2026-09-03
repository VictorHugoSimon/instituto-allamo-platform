import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
const forbid=(c,re,l)=>{if(re.test(c))throw new Error(`Proibido: ${l}`)};

const schema=read('migrations/2026-09-03-commercial-sales-intelligence.sql');
const guards=read('migrations/2026-09-03-commercial-tenant-guards.sql');
const api=read('src/commercial-sales-intelligence-api.js');
const routeGuard=read('src/commercial-sales-intelligence-route-guard.js');
const ui=read('src/commercial-sales-intelligence-ui.js');
const hardener=read('scripts/harden-commercial-sales-intelligence.mjs');
const additive=read('scripts/ensure-additive-schema.mjs');
const worker=read('public/_worker.js');
const index=read('public/index.html');

for(const table of ['commercial_accounts','commercial_opportunities','commercial_interactions','commercial_routes','commercial_route_stops','commercial_campaigns','commercial_approvals']){
  must(schema,`CREATE TABLE IF NOT EXISTS ${table}`,`Tabela comercial ${table}`);
  must(schema,'company_id TEXT NOT NULL',`company_id obrigatório em ${table}`);
  must(additive,`'${table}'`,`Gate aditivo conhece ${table}`);
}
forbid(schema,/\b(DELETE\s+FROM|DROP\s+TABLE|TRUNCATE(?:\s+TABLE)?)\b/i,'migration comercial destrutiva');
forbid(guards,/\b(DELETE\s+FROM|DROP\s+TABLE|TRUNCATE(?:\s+TABLE)?)\b/i,'migration de guards destrutiva');

for(const guard of ['commercial_cross_tenant_account','commercial_cross_tenant_interaction','commercial_cross_tenant_route_stop','commercial_cross_tenant_approval'])must(guards,guard,`Guard D1 ${guard}`);

must(api,"const csScope=id=>!scope||String(id)===String(scope)",'API respeita scope autenticado');
must(api,"path==='commercial-summary'",'Resumo comercial');
must(api,"path==='commercial-accounts'",'Carteira comercial');
must(api,"path==='commercial-opportunities'",'Oportunidades');
must(api,"path==='commercial-interactions'",'Interações/visitas');
must(api,"path==='commercial-approvals'",'Aprovações');
must(api,'Conta não pertence à empresa','Validação de conta por empresa');
must(api,'Oportunidade não pertence à empresa','Validação de oportunidade por empresa');
must(api,"archived_at=COALESCE(archived_at,datetime('now'))",'Exclusão lógica de conta');

must(routeGuard,"const accountIds=Array.isArray(b.account_ids)",'Rota coleta IDs antes do insert');
must(routeGuard,'for(const accountId of accountIds)','Rota pré-valida todas as contas');
const validatePos=routeGuard.indexOf('for(const accountId of accountIds)');
const routeInsertPos=routeGuard.indexOf('INSERT INTO commercial_routes');
if(validatePos<0||routeInsertPos<0||validatePos>routeInsertPos)throw new Error('Rota precisa validar todas as contas antes do primeiro INSERT.');

must(ui,'Semeali · Sales Intelligence','UI white-label Semeali');
must(ui,"api('commercial-summary?'",'UI consome resumo real');
must(ui,"api('commercial-accounts?'",'UI consome carteira real');
must(ui,"api('commercial-opportunities?'",'UI consome oportunidades reais');
must(ui,"api('commercial-approvals?'",'UI consome aprovações reais');
must(ui,"api('commercial-routes?'",'UI consome rotas reais');

must(hardener,'BEGIN ALLAMO SALES INTELLIGENCE API','Hardener injeta API');
must(hardener,'BEGIN ALLAMO SALES INTELLIGENCE UI','Hardener injeta UI');
must(worker,'BEGIN ALLAMO SALES INTELLIGENCE API','Worker final contém Sales Intelligence');
must(worker,"path==='commercial-summary'",'Worker final contém endpoint comercial');
must(index,'data-allamo-sales-intelligence="1"','HTML final contém UI Sales Intelligence');
must(index,'Semeali · Sales Intelligence','HTML final contém experiência Semeali');

must(additive,"migrations/2026-09-03-commercial-sales-intelligence.sql",'Gate aplica schema comercial');
must(additive,"migrations/2026-09-03-commercial-tenant-guards.sql",'Gate aplica guards comerciais');

console.log('OK: Sales Intelligence Semeali integrado ao core D1 canônico, com isolamento multiempresa, schema aditivo e rota pré-validada.');
