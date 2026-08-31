import fs from 'node:fs';
const api=fs.readFileSync('src/opr-pop-api.js','utf8');
const page=fs.readFileSync('public/opr-pop/index.html','utf8');
const migration=fs.readFileSync('migrations/2026-08-31-opr-pop.sql','utf8');
const hardener=fs.readFileSync('scripts/harden-opr-pop.mjs','utf8');
const ensure=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('request','DB','url','path','json','user','scope','logEvent','env',api);
for(const m of page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);
const must=(t,n,l=n)=>{if(!t.includes(n))throw new Error('Ausente: '+l)};const mustNot=(t,r,l)=>{if(r.test(t))throw new Error('Conteúdo proibido: '+l)};
for(const table of ['opr_pop_config','opr_pop_sequence','opr_pop_procedures','opr_pop_history']){must(migration,table);must(ensure,table)}
for(const route of ['opr-pop','opr-pop-bootstrap','opr-pop-config'])must(api,route,'rota '+route);
for(const status of ['Ativo','Em revisão','Pendente','Inativo']){must(api,status);must(page,status)}
for(const op of ['INSERT','UPDATE','SOFT_DELETE','RESTORE'])must(api,`'${op}'`,'histórico '+op);
for(const label of ['POP Mestre','Fluxo Operacional','Rituais PMO','Evidências & Critérios','Histórico','Lixeira'])must(page,label,'menu '+label);
const nav=(page.match(/class="navbtn(?: on)?" data-tab=/g)||[]).length;if(nav!==6)throw new Error('POP deve possuir 6 itens de menu; encontrado '+nav);
for(const control of ['Editar cabeçalho','+ Novo procedimento','Exportar JSON','Plano de Ação','Restaurar'])must(page,control,'controle '+control);
must(page,'href="/opr-plano-de-acao/"','atalho para Plano de Ação');must(page,"api('opr-pop",'página consumindo API persistente');must(api,"'POP-'+String(n).padStart(3,'0')",'ID sequencial POP-xxx');must(api,'Tratamento de Reuniões','procedimento de reuniões');must(api,'Informar quais PAs foram criados ou atualizados','aviso de contexto pós-reunião');must(hardener,'BEGIN ALLAMO OPR POP API','injeção no worker');
mustNot(api,/DELETE\s+FROM\s+opr_pop_procedures/i,'hard delete de procedimentos');
for(const [name,text] of [['API',api],['Página',page],['Migration',migration]])mustNot(text,/Dual Clima|MADRI · Implantação|NUCCI ERP/i,name+' com dado de outro projeto');
console.log('OK: POP OPR validado — layout, edição persistente, histórico, lixeira, reunião→PA, isolamento e schema.');
