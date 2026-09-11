(()=>{
  'use strict';
  let report=null,context=null;

  // Navegação única MADRI, espelhando a jornada OPR sem compartilhar dados.
  const navGroups=[
    {label:'Início',items:[['/madri/','Portal','01 · Visão Geral']]},
    {label:'Entender e planejar',items:[['/madri-blueprint/','Blueprint','02 · Blueprint'],['/madri-plano-de-acao/','Plano de Ação','03 · Plano de Ação'],['/madri-requisitos/','Requisitos','04 · Requisitos']]},
    {label:'Executar e controlar',items:[['/madri-integracoes/','Integrações','05 · Integrações'],['/madri-riscos/','Riscos','06 · Riscos'],['/madri-mapa-implantacao/','Mapa Mestre','07 · Mapa Mestre']]},
    {label:'Validar e decidir',items:[['/madri-plano-testes/','Testes','08 · Testes'],['/madri-defeitos/','Defeitos','09 · Defeitos'],['/madri-readiness/','Readiness','10 · Readiness'],['/madri-decisoes/','Decisões','11 · Decisões']]},
    {label:'Gestão da mudança',items:[['/madri-impacto-humano/','Impacto Humano','Mapa de Impacto Humano']]},
    {label:'Governança e conhecimento',items:[['/madri-status-report/','Status Report','12 · Status Report'],['/madri-pop/','POP','13 · POP'],['/madri-documentos/','Documentos','14 · Documentos'],['/madri-biblioteca/','Biblioteca','15 · Biblioteca / Drive']]}
  ];
  const routes=navGroups.flatMap(g=>g.items.map(([url,key,label])=>[url,label,key]));
  const officialRoutes=[['/madri-plano-de-acao/','Plano de Ação'],['/madri-status-report/','Status Report'],['/madri-pop/','POP'],['/madri-mapa-implantacao/','Mapa Mestre']];
  const supportRoutes=routes.map(([url,label])=>[url,label]);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opt={}){
    const headers={'content-type':'application/json',...(opt.headers||{})};
    const r=await fetch(path,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok){const err=new Error((data&&data.error)||`HTTP ${r.status}`);err.status=r.status;err.data=data;throw err}return data;
  }
  async function resolveContext(force=false){if(context&&!force)return context;try{context=await api('/api/madri-platform/context')}catch{const d=await api('/api/madri-pmo/context');context={company_id:d.company?.id,company_name:d.company?.name,project_id:d.project?.id,project_name:d.project?.name}}return context}
  async function loadReport(force=false){if(report&&!force)return report;try{report=await api('/api/madri-platform/status-report')}catch{report=await api('/api/public-madri-pmo-report')}return report}
  function showMessage(text,type='ok'){const box=document.getElementById('messageArea');if(!box)return;box.innerHTML=text?`<div class="message ${type==='error'?'error':'ok'}">${esc(text)}</div>`:'';if(text)setTimeout(()=>{if(box.textContent===text)box.innerHTML=''},6000)}
  function badge(status){const s=String(status||'A confirmar');const n=s.toLowerCase();let c='';if(/conclu|aprov|atendid|homolog|produção|tomada|fechado|verde|embaixador|engajado/.test(n))c='good';else if(/atras|bloque|reprov|vermelho|sev1|crít|no-go|atenção na adoção/.test(n))c='crit';else if(/andamento|atenção|pendente|revis|amarelo|adaptável/.test(n))c='warn';else if(/sit|uat|e2e|pronto|desenvolvimento/.test(n))c='blue';return `<span class="pill ${c}">${esc(s)}</span>`}
  const groupLinks=(items,active)=>items.map(([u,key,label])=>`<a class="${active===key?'on':''}" ${active===key?'aria-current="page"':''} href="${u}"><span class="navtext">${esc(label)}</span></a>`).join('');
  function nav(active){return `<div class="brand"><div class="eyebrow">Instituto Államo · PMO</div><h1>MADRI</h1><small>Portal único de Governança</small></div>${navGroups.map(g=>`<div class="navlabel">${esc(g.label)}</div><div class="nav">${groupLinks(g.items,active)}</div>`).join('')}<div class="side-note"><b>Links oficiais permanentes.</b><br>Cada etapa possui URL própria e pertence ao mesmo portal MADRI.<br><br><b>Sequência:</b> entender → planejar → executar → controlar → testar → decidir → reportar → documentar.<br><br><b>Isolamento:</b> dados MADRI permanecem em APIs/tabelas MADRI; o menu replica somente a experiência OPR.</div>`}
  async function init(active,title,subtitle){const side=document.getElementById('sidebar');if(side){side.innerHTML=nav(active);requestAnimationFrame(()=>side.querySelector('a.on')?.scrollIntoView({block:'nearest',inline:'nearest'}))}const t=document.getElementById('pageTitle');if(t)t.textContent=title||active;const s=document.getElementById('pageSub');if(s)s.textContent=subtitle||'Fonte única de governança MADRI';let projectName='Implantação NUCCI ERP/TMS';try{const c=await resolveContext();projectName=c.project_name||projectName}catch{try{const d=await loadReport();projectName=d.project?.project_name||projectName}catch{}}document.querySelectorAll('[data-project-name]').forEach(x=>x.textContent=projectName);return context||report||{}}
  function openModal(id){document.getElementById(id)?.classList.add('on')}
  function closeModal(id){document.getElementById(id)?.classList.remove('on')}
  async function softDelete(entity,id,onDone){if(!confirm('Enviar este registro para a lixeira?'))return;try{await api(`/api/madri-platform/${entity}/${encodeURIComponent(id)}`,{method:'DELETE'});showMessage('Registro enviado para a lixeira.');if(onDone)await onDone()}catch(e){showMessage(e.message,'error')}}
  async function restore(entity,id,onDone){try{await api(`/api/madri-platform/${entity}/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});showMessage('Registro restaurado.');if(onDone)await onDone()}catch(e){showMessage(e.message,'error')}}
  async function history(entity,id){try{const rows=await api(`/api/madri-platform/${entity}/${encodeURIComponent(id)}/history`),body=document.getElementById('historyBody');if(body)body.innerHTML=rows.length?rows.map(r=>`<div class="card" style="margin:7px 0"><b>${esc(r.action_type)}</b> · ${esc(r.created_at)} · ${esc(r.actor||'')}<pre style="white-space:pre-wrap;font-size:8px;max-height:220px;overflow:auto">${esc(r.snapshot_json)}</pre></div>`).join(''):'<div class="empty">Sem histórico.</div>';openModal('historyModal')}catch(e){showMessage(e.message,'error')}}
  function operationalProgress(){if(!report)return 'N/D';const a=report.summary?.actions;if(a?.total)return `${Math.round(Number(a.done||0)*100/Number(a.total))}% das ações concluídas`;const total=Number(report.total||0),done=Number(report.counts?.['Concluído']||0);return total?`${Math.round(done*100/total)}% das ações concluídas`:'N/D'}
  window.MADRIPlatform={api,esc,resolveContext,loadReport,init,badge,showMessage,openModal,closeModal,softDelete,restore,history,operationalProgress,routes,officialRoutes,supportRoutes,navGroups};
})();