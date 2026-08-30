import fs from 'node:fs';

const api=fs.readFileSync('src/opr-pmo-api.js','utf8');
const pub=fs.readFileSync('src/opr-public-report-api.js','utf8');
const ui=fs.readFileSync('src/opr-pmo-ui.js','utf8');
const migration=fs.readFileSync('migrations/2026-08-30-opr-pmo-action-plan.sql','utf8');
const build=fs.readFileSync('scripts/build-work-management.mjs','utf8');
const ensure=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',api);
new AsyncFunction('request','DB','url','path',pub);
new Function(ui);

function must(text,needle,label=needle){if(!text.includes(needle))throw new Error('Ausente: '+label)}
function mustNot(text,re,label){if(re.test(text))throw new Error('Conteúdo proibido: '+label)}

for(const route of ['opr-projects','opr-actions','opr-intake','opr-cadence','opr-roles','opr-customizations','opr-pendencies','opr-report-data','opr-report-publish','opr-bootstrap']) must(api,route,'rota '+route);
for(const op of ['INSERT','UPDATE','SOFT_DELETE','RESTORE']) must(api,`'${op}'`,'histórico '+op);
for(const status of ['Planejado','Em andamento','Atrasado','Concluído']){must(api,status);must(ui,status)}
for(const tab of ['Plano Mestre','Customizações / Desenvolvimentos','Responsáveis por Papel','Pendências','Entrada de Demandas','Cadência Completa','Lixeira'])must(ui,tab);
for(const field of ['front','dependency','impact','critical_path','next_step','evidence'])must(migration,field,'campo '+field);
for(const table of ['opr_action_meta','opr_action_history','opr_intake','opr_cadence','opr_role_assignments','opr_customizations','opr_report_publications']){must(migration,table);must(ensure,table)}
must(build,"src/opr-pmo-api.js");must(build,"src/opr-public-report-api.js");must(build,"src/opr-pmo-ui.js");
must(build,'BEGIN ALLAMO OPR PMO API');must(build,'BEGIN ALLAMO OPR PUBLIC REPORT');

// Report do cliente: exatamente quatro abas e sem detalhe interno de horas/FCH.
const tabLabels=['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança'];
for(const t of tabLabels)must(pub,t,'aba do report '+t);
const tabCount=(pub.match(/<button class=\\"tab/g)||[]).length;
if(tabCount!==4)throw new Error(`Report público deve ter exatamente 4 abas; encontrado: ${tabCount}`);
mustNot(pub,/FCH|Horas individuais|banco de horas/i,'horas internas no report do cliente');

// Isolamento: nenhum dado copiado de Dual/Madri/Nucci nos artefatos OPR.
for(const [name,text] of [['API',api],['UI',ui],['Report público',pub],['Migration',migration]]){
  mustNot(text,/Dual Clima|Status Report · Dual|MADRI · Implantação|NUCCI ERP/i,`${name}: dado de outro projeto`);
}

// Nunca hard delete de work_items pelo módulo OPR.
mustNot(api,/DELETE\s+FROM\s+work_items/i,'hard delete de work_items');
must(api,"archived_at=datetime('now')",'soft delete');
must(api,'archived_at=NULL','restore');

// O report lê a mesma fonte do Plano Mestre.
must(pub,'FROM work_items w JOIN opr_action_meta m','report deve ler Plano Mestre');
must(api,'FROM work_items w JOIN opr_action_meta m','API deve ler Plano Mestre');

console.log('OK: módulo OPR PMO validado — sintaxe, CRUD lógico, histórico, isolamento, fonte única e report de 4 abas.');
