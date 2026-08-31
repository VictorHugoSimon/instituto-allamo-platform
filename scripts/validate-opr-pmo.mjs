import fs from 'node:fs';

const legacyApi=fs.readFileSync('src/opr-pmo-api.js','utf8');
const masterApi=fs.readFileSync('src/opr-governance-master-api.js','utf8');
const pub=fs.readFileSync('src/opr-public-report-api.js','utf8');
const ui=fs.readFileSync('src/opr-pmo-ui.js','utf8');
const dedicated=fs.readFileSync('public/opr-plano-de-acao/index.html','utf8');
const route=fs.readFileSync('src/opr-dedicated-route.js','utf8');
const hardener=fs.readFileSync('scripts/harden-opr-governance-master.mjs','utf8');
const migration=fs.readFileSync('migrations/2026-08-30-opr-pmo-action-plan.sql','utf8');
const ensure=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');
const pkg=fs.readFileSync('package.json','utf8');

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',legacyApi);
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',masterApi);
new AsyncFunction('request','DB','url','path',pub);
new Function(ui);
new Function(route);
for(const m of dedicated.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);

function must(text,needle,label=needle){if(!text.includes(needle))throw new Error('Ausente: '+label)}
function mustNot(text,re,label){if(re.test(text))throw new Error('Conteúdo proibido: '+label)}

// Contrato operacional mestre.
for(const routeName of ['opr-actions','opr-intake','opr-cadence','opr-roles','opr-customizations','opr-pendencies','opr-audit'])must(masterApi,routeName,'rota mestre '+routeName);
for(const op of ['INSERT','UPDATE','SOFT_DELETE','RESTORE'])must(masterApi,`'${op}'`,'histórico mestre '+op);
for(const status of ['Planejado','Em andamento','Atrasado','Concluído']){must(masterApi,status);must(dedicated,status)}
for(const cadenceStatus of ['Realizada','Planejada','A confirmar','Cancelada','Não realizada'])must(masterApi,cadenceStatus);
for(const stage of ['Análise','Revisão','Aprovação','Desenvolvimento','Disponível para Teste','Validação','Aceite'])must(masterApi,stage);
for(const classification of ['COBERTO','INCLUÍDO NESTA AUDITORIA','COBERTO POR DECOMPOSIÇÃO','MARCO RASTREADO','PENDENTE DE VALIDAÇÃO'])must(masterApi,classification);

// O ID operacional precisa ser PA-001, PA-002... e nunca depender do UUID interno.
must(masterApi,"'PA-'+String(n).padStart(3,'0')",'gerador sequencial PA-xxx');
must(masterApi,'opr_action_sequence','sequência persistente de IDs');
must(migration,'display_id','display ID persistido');
must(migration,'opr_action_sequence','tabela de sequência');
must(ensure,"['opr_action_meta','display_id'",'upgrade aditivo de display_id');
must(ensure,'idx_opr_action_display_id','índice único do PA');

// Plano dedicado deve manter exatamente os seis menus de governança solicitados.
const navLabels=['Plano Mestre','Customizações / Desenvolvimentos','Responsáveis por Papel','Pendências','Entrada de Demandas','Cadência Completa'];
for(const t of navLabels)must(dedicated,t,'menu dedicado '+t);
const navCount=(dedicated.match(/class="navbtn(?: on)?" data-tab=/g)||[]).length;
if(navCount!==6)throw new Error(`Plano dedicado deve possuir exatamente 6 itens no menu; encontrado: ${navCount}`);
for(const control of ['Histórico','Lixeira','Restaurar','+ Nova demanda / tarefa','Exportar JSON'])must(dedicated,control,'controle '+control);
must(dedicated,'data-status-id','status editável direto na linha');
must(dedicated,'opr-audit','auditoria de completude no plano dedicado');
must(route,"/opr-plano-de-acao/",'roteamento para plano dedicado');

// Campos obrigatórios e extensões funcionais.
for(const field of ['front','dependency','impact','critical_path','next_step','evidence','display_id'])must(migration,field,'campo '+field);
for(const field of ['development_owner','supplier']){must(migration,field);must(masterApi,field);must(dedicated,field)}
for(const field of ['technical_owner','next_step']){must(migration,field);must(masterApi,field)}
for(const table of ['opr_action_meta','opr_action_sequence','opr_action_history','opr_intake','opr_cadence','opr_role_assignments','opr_customizations','opr_completeness_audit','opr_report_publications']){must(migration,table);must(ensure,table)}

// Build: API mestre precisa entrar antes da API OPR legada.
must(hardener,'BEGIN ALLAMO OPR GOVERNANCE MASTER API');
must(hardener,'BEGIN ALLAMO OPR PMO API');
must(pkg,'harden-opr-governance-master.mjs');
must(pkg,'test:opr-pmo');

// Nunca hard delete das ações OPR pelo módulo mestre.
mustNot(masterApi,/DELETE\s+FROM\s+work_items/i,'hard delete de work_items');
must(masterApi,"archived_at=datetime('now')",'soft delete');
must(masterApi,'archived_at=NULL','restore');

// Report do cliente: exatamente quatro abas, mesma fonte do Plano e sem horas internas.
const tabLabels=['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança'];
for(const t of tabLabels)must(pub,t,'aba do report '+t);
const tabCount=(pub.match(/<button class="tab/g)||[]).length;
if(tabCount!==4)throw new Error(`Report público deve ter exatamente 4 abas; encontrado: ${tabCount}`);
must(pub,'FROM work_items w JOIN opr_action_meta m','report deve ler Plano Mestre');
mustNot(pub,/fch_entries|horas_import|fch-hours|capacity_hours|actual_hours|planned_hours/i,'acoplamento de horas internas no report do cliente');

// Isolamento: nenhum dado operacional de projeto alheio pode contaminar os artefatos OPR.
for(const [name,text] of [['API Mestre',masterApi],['Plano dedicado',dedicated],['Report público',pub],['Migration',migration]])mustNot(text,/Dual Clima|Status Report · Dual|MADRI · Implantação|NUCCI ERP/i,`${name}: dado de outro projeto`);

console.log('OK: OPR Governança Mestre validada — PA sequencial, 6 menus, CRUD lógico, histórico/lixeira, customizações, papéis, pendências, auditoria, isolamento e report executivo derivado.');
