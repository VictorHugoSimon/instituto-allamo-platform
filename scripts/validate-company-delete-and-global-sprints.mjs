import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');
const hardener=fs.readFileSync('scripts/harden-company-delete-and-global-sprints.mjs','utf8');

const must=(haystack,needle,label)=>{if(!haystack.includes(needle))throw new Error(`Ausente ${label}: ${needle}`)};

for(const [needle,label] of [
  ['// [allamo-company-delete-retain-work]','marcador de retenção na exclusão de empresa'],
  ["UPDATE work_items SET company_id='__unassigned__'",'tarefas movidas para Sem empresa'],
  ["UPDATE work_comments SET company_id='__unassigned__'",'comentários preservados'],
  ["UPDATE work_checklist SET company_id='__unassigned__'",'checklists preservados'],
  ["UPDATE work_links SET company_id='__unassigned__'",'links de trabalho preservados'],
  ["UPDATE work_events SET company_id='__unassigned__'",'eventos de trabalho preservados'],
  ["UPDATE work_sprints SET company_id='__unassigned__'",'sprints da empresa preservadas'],
  ["retained_work_items:retainedWork",'API informa quantidade preservada'],
  ["work_retention_required",'exclusão destrutiva de tarefas bloqueada'],
  ['// [allamo-global-multicompany-sprints]','marcador de sprint multiempresa'],
  ["const WM_MULTI='__multi__',WM_UNASSIGNED='__unassigned__'",'sentinelas de escopo'],
  ["b.multi_company===true",'criação de sprint multiempresa'],
  ["Sprint multiempresa exige perfil PMO/Admin global",'RBAC multiempresa'],
  ["/^work-sprints\\/[^/]+\\/items$/",'rota de composição da sprint'],
  ["item_ids deve ser uma lista",'contrato de composição da sprint'],
  ["UPDATE work_items SET sprint_id=NULL",'substituição segura da composição'],
  ["sprint_assigned",'auditoria/evento de associação']
]) must(worker,needle,label);

const companyDeleteStart=worker.indexOf('// [allamo-company-delete-retain-work]');
const companyDeleteEnd=worker.indexOf("if (path === 'projects' && request.method === 'GET')",companyDeleteStart);
const companyDeleteBlock=worker.slice(companyDeleteStart,companyDeleteEnd);
if(companyDeleteBlock.includes('DELETE FROM work_items WHERE company_id'))throw new Error('Exclusão de empresa ainda apaga work_items.');
if(!companyDeleteBlock.includes("DELETE FROM companies WHERE id = ?"))throw new Error('Empresa deixou de ser removida do cadastro.');
const updatePos=companyDeleteBlock.indexOf("UPDATE work_items SET company_id='__unassigned__'");
const deleteCompanyPos=companyDeleteBlock.indexOf("DELETE FROM companies WHERE id = ?");
if(!(updatePos>=0&&deleteCompanyPos>updatePos))throw new Error('Tarefas precisam ser desvinculadas antes da exclusão da empresa.');

for(const [needle,label] of [
  ['// [allamo-delete-company-retain-work-ui]','UI de exclusão segura'],
  ['Tarefas vinculadas, se existirem, serão mantidas como','mensagem de retenção'],
  ["companies/'+id+'?work=keep",'UI solicita retenção explícita'],
  ['Sem empresa','rótulo Sem empresa'],
  ['// [allamo-global-sprint-ui]','UI de sprint global'],
  ['Multiempresa (recomendado)','criação multiempresa padrão'],
  ['Gerenciar tarefas','gestão de composição da sprint'],
  ["data-sm=\"items\"",'ação de gestão de tarefas'],
  ["method:'PUT',body:JSON.stringify({item_ids:ids})",'salvamento da composição'],
  ['A empresa original continua registrada em cada tarefa.','preservação de tenant na sprint']
]) must(index,needle,label);

if(index.includes('Projetos, demandas e a área dela deixam de aparecer.'))throw new Error('Confirmação antiga e destrutiva de empresa ainda está ativa.');

for(const [needle,label] of [
  ["await import('./harden-company-delete-and-global-sprints.mjs')",'hardener encadeado no build'],
  ["await import('./validate-company-delete-and-global-sprints.mjs')",'validador encadeado no gate']
]){
  const src=label.includes('hardener')?fs.readFileSync('scripts/harden-no-login-mutation-safety.mjs','utf8'):fs.readFileSync('scripts/validate-no-login-mutation-safety.mjs','utf8');
  must(src,needle,label);
}

must(hardener,"company_id='__unassigned__'",'hardener preserva itens sem empresa');
must(hardener,"company_id===WM_MULTI",'hardener implementa escopo multiempresa');

console.log('OK: empresa pode ser excluída sem perder tarefas; itens passam para Sem empresa; Sprint global aceita tarefas de várias empresas com RBAC e tenant de origem preservados.');
