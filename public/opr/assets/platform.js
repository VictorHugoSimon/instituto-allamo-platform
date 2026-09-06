(()=>{
  'use strict';
  let project=null;

  // Navegação única da OPR. Cada item possui URL permanente e segue a jornada do projeto.
  const navGroups=[
    {label:'Início',items:[['/opr/','Portal','01 · Visão Geral']]},
    {label:'Entender e planejar',items:[['/opr-blueprint/','Blueprint','02 · Blueprint'],['/opr-plano-de-acao/','Plano de Ação','03 · Plano de Ação'],['/opr-requisitos/','Requisitos','04 · Requisitos']]},
    {label:'Executar e controlar',items:[['/opr-integracoes/','Integrações','05 · Integrações'],['/opr-riscos/','Riscos','06 · Riscos'],['/opr-mapa-implantacao/','Mapa Mestre','07 · Mapa Mestre']]},
    {label:'Validar e decidir',items:[['/opr-plano-testes/','Testes','08 · Testes'],['/opr-defeitos/','Defeitos','09 · Defeitos'],['/opr-readiness/','Readiness','10 · Readiness'],['/opr-decisoes/','Decisões','11 · Decisões']]},
    {label:'Governança e conhecimento',items:[['/opr-status-report/','Status Report','12 · Status Report'],['/opr-pop/','POP','13 · POP'],['/opr-documentos/','Documentos','14 · Documentos'],['/opr-biblioteca/','Biblioteca','15 · Biblioteca / Drive']]}
  ];
  const routes=navGroups.flatMap(g=>g.items.map(([url,key,label])=>[url,label,key]));
  // Mantidos para compatibilidade e para os validadores de URLs oficiais permanentes.
  const officialRoutes=[['/opr-plano-de-acao/','Plano de Ação'],['/opr-status-report/','Status Report'],['/opr-pop/','POP'],['/opr-mapa-implantacao/','Mapa Mestre']];
  const supportRoutes=[['/opr/','Portal'],['/opr-blueprint/','Blueprint'],['/opr-requisitos/','Requisitos'],['/opr-integracoes/','Integrações'],['/opr-riscos/','Riscos'],['/opr-plano-testes/','Testes'],['/opr-defeitos/','Defeitos'],['/opr-readiness/','Readiness'],['/opr-decisoes/','Decisões'],['/opr-documentos/','Documentos'],['/opr-biblioteca/','Biblioteca']];

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opt={}){const headers={'content-type':'application/json',...(opt.headers||{})};const r=await fetch(path,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}if(!r.ok){const err=new Error((data&&data.error)||`HTTP ${r.status}`);err.status=r.status;err.data=data;throw err}return data}
  async function resolveProject(){if(project)return project;const rows=await api('/api/opr-projects');if(!Array.isArray(rows)||!rows.length)throw new Error('Projeto OPR não localizado.');project=rows[0];return project}
  function showMessage(text,type='ok'){const box=document.getElementById('messageArea');if(!box)return;box.innerHTML=text?`<div class="message ${type==='error'?'error':'ok'}">${esc(text)}</div>`:'';if(text)setTimeout(()=>{if(box.textContent===text)box.innerHTML=''},6000)}
  function badge(status){const s=String(status||'A confirmar');const n=s.toLowerCase();let c='';if(/conclu|aprov|atendid|homolog|produção|tomada|fechado/.test(n))c='good';else if(/atras|bloque|reprov|vermelho|sev1|crít/.test(n))c='crit';else if(/andamento|atenção|pendente|revis|amarelo/.test(n))c='warn';else if(/sit|uat|e2e|pronto|desenvolvimento/.test(n))c='blue';return `<span class="pill ${c}">${esc(s)}</span>`}
  const groupLinks=(items,active)=>items.map(([u,key,label])=>`<a class="${active===key?'on':''}" ${active===key?'aria-current="page"':''} href="${u}"><span class="navtext">${esc(label)}</span></a>`).join('');
  function nav(active){return `<div class="brand"><div class="eyebrow">Instituto Államo · PMO</div><h1>OPR</h1><small>Portal único de Governança</small></div>${navGroups.map(g=>`<div class="navlabel">${esc(g.label)}</div><div class="nav">${groupLinks(g.items,active)}</div>`).join('')}<div class="side-note"><b>Links oficiais permanentes.</b><br>Cada etapa possui uma URL própria, mas todas pertencem ao mesmo portal OPR.<br><br><b>Sequência:</b> entender → planejar → executar → controlar → testar → decidir → reportar → documentar.<br><br><b>Fonte única:</b> dados operacionais permanecem no D1/API da OPR; o menu não cria bases paralelas.</div>`}
  async function init(active,title,subtitle){const side=document.getElementById('sidebar');if(side){side.innerHTML=nav(active);requestAnimationFrame(()=>side.querySelector('a.on')?.scrollIntoView({block:'nearest',inline:'nearest'}))}const t=document.getElementById('pageTitle');if(t)t.textContent=title||active;const s=document.getElementById('pageSub');if(s)s.textContent=subtitle||'Dados persistentes no Cloudflare D1';const p=await resolveProject();document.querySelectorAll('[data-project-name]').forEach(x=>x.textContent=p.name);return p}
  function openModal(id){document.getElementById(id)?.classList.add('on')}
  function closeModal(id){document.getElementById(id)?.classList.remove('on')}
  function formValue(id){const e=document.getElementById(id);if(!e)return '';if(e.type==='checkbox')return e.checked;return e.value}
  function setValue(id,v){const e=document.getElementById(id);if(!e)return;if(e.type==='checkbox')e.checked=!!v;else e.value=v??''}
  async function softDelete(entity,id,onDone){if(!confirm('Enviar este registro para a lixeira?'))return;try{await api(`/api/opr-platform/${entity}/${encodeURIComponent(id)}`,{method:'DELETE'});showMessage('Registro enviado para a lixeira.');if(onDone)await onDone()}catch(e){showMessage(e.message,'error')}}
  async function restore(entity,id,onDone){try{await api(`/api/opr-platform/${entity}/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});showMessage('Registro restaurado.');if(onDone)await onDone()}catch(e){showMessage(e.message,'error')}}
  async function history(entity,id){try{const rows=await api(`/api/opr-platform/${entity}/${encodeURIComponent(id)}/history`);const body=document.getElementById('historyBody');if(body)body.innerHTML=rows.length?rows.map(r=>`<div class="card" style="margin:7px 0"><b>${esc(r.action_type)}</b> · ${esc(r.created_at)} · ${esc(r.actor||'')}<pre style="white-space:pre-wrap;font-size:8px;max-height:220px;overflow:auto">${esc(r.snapshot_json)}</pre></div>`).join(''):'<div class="empty">Sem histórico.</div>';openModal('historyModal')}catch(e){showMessage(e.message,'error')}}
  function operationalProgress(v){return v===null||v===undefined?'N/D':`${Number(v)}% das ações concluídas`}
  window.OPRPlatform={api,esc,resolveProject,init,badge,showMessage,openModal,closeModal,formValue,setValue,softDelete,restore,history,operationalProgress,routes,officialRoutes,supportRoutes,navGroups};
})();
