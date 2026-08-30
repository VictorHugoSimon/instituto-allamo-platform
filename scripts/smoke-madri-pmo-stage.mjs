const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const fail=m=>{throw new Error('[MADRI PMO SMOKE] '+m)};
const req=async(path,opt={})=>{const r=await fetch(base+path,{...opt,headers:{'content-type':'application/json',...(opt.headers||{})},cache:'no-store'});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d=text}if(!r.ok)fail(`${opt.method||'GET'} ${path} -> ${r.status} ${typeof d==='string'?d:JSON.stringify(d)}`);return d};

console.log('[1/12] páginas públicas...');
const planHtml=await (await fetch(base+'/madri-plano-acao.html',{cache:'no-store'})).text();
if(!planHtml.includes('Plano de Ação Operacional')||!planHtml.includes('Entrada de Demandas'))fail('Plano operacional não publicado corretamente');
const reportHtml=await (await fetch(base+'/madri-status-report.html',{cache:'no-store'})).text();
if(!reportHtml.includes('Vision Roadmap')||(reportHtml.match(/class="tab(?: on)?"/g)||[]).length!==4)fail('Status Report não possui Vision Roadmap + quatro abas');

console.log('[2/12] endpoint público derivado do Plano...');
const pub=await req('/api/public-madri-pmo-report');
if(pub.source_of_truth!=='Plano Mestre MADRI / work_items[pmo_scope=MADRI_NUCCI]')fail('Report público não declara fonte única esperada');

console.log('[3/12] carregar Plano Mestre...');
const before=await req('/api/madri-pmo/actions');
if(!Array.isArray(before)||before.length<18)fail('Seed do Plano Mestre não carregado');

const marker='SMOKE '+Date.now();
console.log('[4/12] criar tarefa...');
const created=await req('/api/madri-pmo/actions',{method:'POST',body:JSON.stringify({action:`${marker} · tarefa CRUD`,front:'Smoke Test',responsible:'PMO Smoke',status:'Planejado',impact:'Teste de persistência',next_step:'Transicionar status',evidence:'Smoke automatizado de Stage',source_ref:'GitHub Actions / smoke-madri-pmo-stage',critical_path:false})});
const id=created.id;if(!id)fail('POST não retornou ID');

console.log('[5/12] Planejado → Em andamento...');
await req('/api/madri-pmo/actions/'+encodeURIComponent(id)+'/status',{method:'POST',body:JSON.stringify({status:'Em andamento'})});
console.log('[6/12] editar campos...');
await req('/api/madri-pmo/actions/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({impact:'Impacto editado e persistido',next_step:'Concluir smoke',evidence:'Evidência atualizada pelo smoke'})});
console.log('[7/12] Em andamento → Concluído...');
await req('/api/madri-pmo/actions/'+encodeURIComponent(id)+'/status',{method:'POST',body:JSON.stringify({status:'Concluído'})});
let actions=await req('/api/madri-pmo/actions');let row=actions.find(x=>x.id===id);if(!row||row.status!=='Concluído'||row.impact_text!=='Impacto editado e persistido')fail('Persistência de status/campos falhou');

console.log('[8/12] histórico...');
const hist=await req('/api/madri-pmo/history?action='+encodeURIComponent(id));
if(!hist.some(x=>x.event_name==='INSERT')||!hist.some(x=>x.event_name==='UPDATE'))fail('Histórico INSERT/UPDATE não encontrado');

console.log('[9/12] lixeira e restauração...');
await req('/api/madri-pmo/actions/'+encodeURIComponent(id),{method:'DELETE'});
let trash=await req('/api/madri-pmo/trash');if(!trash.some(x=>x.id===id))fail('SOFT_DELETE não apareceu na lixeira');
await req('/api/madri-pmo/actions/'+encodeURIComponent(id)+'/restore',{method:'POST'});
actions=await req('/api/madri-pmo/actions');if(!actions.some(x=>x.id===id))fail('RESTORE não devolveu item ao Plano');
const hist2=await req('/api/madri-pmo/history?action='+encodeURIComponent(id));if(!hist2.some(x=>x.event_name==='SOFT_DELETE')||!hist2.some(x=>x.event_name==='RESTORE'))fail('Histórico de lixeira/restauração incompleto');

console.log('[10/12] customização CRUD...');
const custom=await req('/api/madri-pmo/actions',{method:'POST',body:JSON.stringify({action:`${marker} · customização`,item_type:'CUSTOMIZACAO',front:'Smoke Test',responsible:'PMO Smoke',status:'Planejado',evidence:'Smoke customização',source_ref:'GitHub Actions'})});
let customs=await req('/api/madri-pmo/customizations');if(!customs.some(x=>x.id===custom.id))fail('Customização criada não aparece na visão específica');
await req('/api/madri-pmo/actions/'+encodeURIComponent(custom.id),{method:'PATCH',body:JSON.stringify({next_step:'Customização editada'})});
customs=await req('/api/madri-pmo/customizations');if(customs.find(x=>x.id===custom.id)?.next_step!=='Customização editada')fail('Edição de customização não persistiu');

console.log('[11/12] editar cadência existente e recarregar...');
const cadence=await req('/api/madri-pmo/cadence');if(!cadence.length)fail('Cadência seed ausente');
const cad=cadence[0];await req('/api/madri-pmo/cadence/'+encodeURIComponent(cad.id),{method:'PATCH',body:JSON.stringify({result_next_step:cad.result_next_step})});
const cadenceReload=await req('/api/madri-pmo/cadence');if(!cadenceReload.some(x=>x.id===cad.id))fail('Cadência não persistiu após edição/reload');

console.log('[12/12] limpeza por soft-delete + report derivado...');
await req('/api/madri-pmo/actions/'+encodeURIComponent(id),{method:'DELETE'});
await req('/api/madri-pmo/actions/'+encodeURIComponent(custom.id),{method:'DELETE'});
const afterPub=await req('/api/public-madri-pmo-report');if(afterPub.actions.some(x=>x.id===id||x.id===custom.id))fail('Report público incluiu itens arquivados');
console.log('[OK] CRUD real, status inline/API, persistência, histórico, lixeira, restauração, customização, cadência e report derivados validados em Stage.');
