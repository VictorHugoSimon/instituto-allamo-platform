import fs from 'node:fs';

const legacyApi=fs.readFileSync('src/opr-pmo-api.js','utf8');
const masterApi=fs.readFileSync('src/opr-governance-master-api.js','utf8');
const popApi=fs.readFileSync('src/opr-pop-api.js','utf8');
const pub=fs.readFileSync('src/opr-public-report-api.js','utf8');
const ui=fs.readFileSync('src/opr-pmo-ui.js','utf8');
const dedicated=fs.readFileSync('public/opr-plano-de-acao/index.html','utf8');
const popPage=fs.readFileSync('public/opr-pop/index.html','utf8');
const route=fs.readFileSync('src/opr-dedicated-route.js','utf8');
const hardener=fs.readFileSync('scripts/harden-opr-governance-master.mjs','utf8');
const migration=fs.readFileSync('migrations/2026-08-30-opr-pmo-action-plan.sql','utf8');
const popMigration=fs.readFileSync('migrations/2026-08-31-opr-pop.sql','utf8');
const ensure=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');
const pkg=fs.readFileSync('package.json','utf8');

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',legacyApi);
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',masterApi);
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env','oprMasterWrite','oprMasterProjectContext','oprMasterId',popApi);
new AsyncFunction('request','DB','url','path',pub);
new Function(ui);new Function(route);
for(const html of [dedicated,popPage])for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);

function must(text,needle,label=needle){if(!text.includes(needle))throw new Error('Ausente: '+label)}
function mustNot(text,re,label){if(re.test(text))throw new Error('Conteúdo proibido: '+label)}

for(const routeName of ['opr-actions','opr-intake','opr-cadence','opr-roles','opr-customizations','opr-pendencies','opr-audit'])must(masterApi,routeName,'rota mestre '+routeName);
for(const op of ['INSERT','UPDATE','SOFT_DELETE','RESTORE'])must(masterApi,`'${op}'`,'histórico mestre '+op);
for(const status of ['Planejado','Em andamento','Atrasado','Concluído']){must(masterApi,status);must(dedicated,status)}
for(const cadenceStatus of ['Realizada','Planejada','A confirmar','Cancelada','Não realizada'])must(masterApi,cadenceStatus);
for(const stage of ['Análise','Revisão','Aprovação','Desenvolvimento','Disponível para Teste','Validação','Aceite'])must(masterApi,stage);
for(const classification of ['COBERTO','INCLUÍDO NESTA AUDITORIA','COBERTO POR DECOMPOSIÇÃO','MARCO RASTREADO','PENDENTE DE VALIDAÇÃO'])must(masterApi,classification);

must(masterApi,"'PA-'+String(n).padStart(3,'0')",'gerador sequencial PA-xxx');must(masterApi,'opr_action_sequence','sequência persistente de IDs');must(migration,'display_id','display ID persistido');must(migration,'opr_action_sequence','tabela de sequência');must(ensure,"['opr_action_meta','display_id'",'upgrade aditivo de display_id');must(ensure,'idx_opr_action_display_id','índice único do PA');

const navLabels=['Plano Mestre','Customizações / Desenvolvimentos','Responsáveis por Papel','Pendências','Entrada de Demandas','Cadência Completa'];for(const t of navLabels)must(dedicated,t,'menu dedicado '+t);const navCount=(dedicated.match(/class="navbtn(?: on)?" data-tab=/g)||[]).length;if(navCount!==6)throw new Error(`Plano dedicado deve possuir exatamente 6 itens no menu; encontrado: ${navCount}`);for(const control of ['Histórico','Lixeira','Restaurar','+ Nova demanda / tarefa','Exportar JSON'])must(dedicated,control,'controle '+control);must(dedicated,'data-status-id','status editável direto na linha');must(dedicated,'opr-audit','auditoria de completude no plano dedicado');must(route,"/opr-plano-de-acao/",'roteamento para plano dedicado');

for(const field of ['front','dependency','impact','critical_path','next_step','evidence','display_id'])must(migration,field,'campo '+field);for(const field of ['development_owner','supplier']){must(migration,field);must(masterApi,field);must(dedicated,field)}for(const field of ['technical_owner','next_step']){must(migration,field);must(masterApi,field)}for(const table of ['opr_action_meta','opr_action_sequence','opr_action_history','opr_intake','opr_cadence','opr_role_assignments','opr_customizations','opr_completeness_audit','opr_report_publications']){must(migration,table);must(ensure,table)}

// POP editável no mesmo padrão visual do Plano de Ação.
for(const table of ['opr_pop_config','opr_pop_sequence','opr_pop_procedures','opr_pop_history']){must(popMigration,table);must(ensure,table)}
for(const routeName of ['opr-pop','opr-pop-bootstrap','opr-pop-config'])must(popApi,routeName,'rota POP '+routeName);
for(const status of ['Ativo','Em revisão','Pendente','Inativo']){must(popApi,status);must(popPage,status)}
for(const op of ['INSERT','UPDATE','SOFT_DELETE','RESTORE'])must(popApi,`'${op}'`,'histórico POP '+op);
for(const label of ['POP Mestre','Fluxo Operacional','Rituais PMO','Evidências & Critérios','Histórico','Lixeira'])must(popPage,label,'menu POP '+label);
const popNav=(popPage.match(/class="navbtn(?: on)?" data-tab=/g)||[]).length;if(popNav!==6)throw new Error(`POP deve possuir 6 itens no menu; encontrado: ${popNav}`);
for(const control of ['Editar cabeçalho','+ Novo procedimento','Exportar JSON','Plano de Ação','Restaurar'])must(popPage,control,'controle POP '+control);
must(popPage,"href=\"/opr-plano-de-acao/\"",'atalho do POP para Plano de Ação');
must(popPage,'/api/','POP deve consumir API persistente');
must(popApi,"'POP-'+String(n).padStart(3,'0')",'ID sequencial POP-xxx');
must(popApi,'Tratamento de Reuniões','regra de análise de reunião no POP inicial');
must(popApi,'Informar quais PAs foram criados ou atualizados','comunicação de contexto pós-reunião');
mustNot(popApi,/DELETE\s+FROM\s+opr_pop_procedures/i,'hard delete do POP');

must(hardener,'BEGIN ALLAMO OPR GOVERNANCE MASTER API');must(hardener,'BEGIN ALLAMO OPR POP API');must(hardener,'BEGIN ALLAMO OPR PMO API');must(pkg,'harden-opr-governance-master.mjs');must(pkg,'test:opr-pmo');

mustNot(masterApi,/DELETE\s+FROM\s+work_items/i,'hard delete de work_items');must(masterApi,"archived_at=datetime('now')",'soft delete');must(masterApi,'archived_at=NULL','restore');

const tabLabels=['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança'];for(const t of tabLabels)must(pub,t,'aba do report '+t);const tabCount=(pub.match(/<button class="tab/g)||[]).length;if(tabCount!==4)throw new Error(`Report público deve ter exatamente 4 abas; encontrado: ${tabCount}`);must(pub,'FROM work_items w JOIN opr_action_meta m','report deve ler Plano Mestre');mustNot(pub,/fch_entries|horas_import|fch-hours|capacity_hours|actual_hours|planned_hours/i,'acoplamento de horas internas no report do cliente');

for(const [name,text] of [['API Mestre',masterApi],['API POP',popApi],['Plano dedicado',dedicated],['POP dedicado',popPage],['Report público',pub],['Migration',migration],['Migration POP',popMigration]])mustNot(text,/Dual Clima|Status Report · Dual|MADRI · Implantação|NUCCI ERP/i,`${name}: dado de outro projeto`);

console.log('OK: OPR validada — Plano Mestre + POP editável, IDs sequenciais, histórico/lixeira, isolamento, governança de reuniões e Status Report derivado.');
