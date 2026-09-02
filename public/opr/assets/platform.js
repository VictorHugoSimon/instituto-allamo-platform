(()=>{
  'use strict';
  let project=null;
  const officialRoutes=[
    ['/opr-plano-de-acao/','Plano de Ação'],
    ['/opr-status-report/','Status Report'],
    ['/opr-pop/','POP'],
    ['/opr-mapa-implantacao/','Mapa Mestre']
  ];
  const supportRoutes=[
    ['/opr/','Portal'],['/opr-requisitos/','Requisitos'],['/opr-plano-testes/','Testes'],['/opr-riscos/','Riscos'],['/opr-integracoes/','Integrações'],['/opr-documentos/','Documentos']
  ];
  const routes=[...officialRoutes,...supportRoutes];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  async function api(path,opt={}){
    const headers={'content-type':'application/json',...(opt.headers||{})};
    const r=await fetch(path,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok){const err=new Error((data&&data.error)||`HTTP ${r.status}`);err.status=r.status;err.data=data;throw err}return data;
  }
  async function resolveProject(){if(project)return project;const rows=await api('/api/opr-projects');if(!Array.isArray(rows)||!rows.length)throw new Error('Projeto OPR não localizado.');project=rows[0];return project}
  function showMessage(text,type='ok'){const box=document.getElementById('messageArea');if(!box)return;box.innerHTML=text?`<div class="message ${type==='error'?'error':'ok'}">${esc(text)}</div>`:'';if(text)setTimeout(()=>{if(box.textContent===text)box.innerHTML=''},6000)}
  function badge(status){const s=String(status||'A confirmar');const n=s.toLowerCase();let c='';if(/conclu|aprov|atendid|homolog|produção|tomada|fechado/.test(n))c='good';else if(/atras|bloque|reprov|vermelho|sev1|crít/.test(n))c='crit';else if(/andamento|atenção|pendente|revis|amarelo/.test(n))c='warn';else if(/sit|uat|e2e|pronto|desenvolvimento/.test(n))c='blue';return `<span class="pill ${c}">${esc(s)}</span>`}
  const links=(items,active)=>items.map(([u,l])=>`<a class="${active===l?'on':''}" href="${u}">${l}</a>`).join('');
  function nav(active){return `<div class="brand"><div class="eyebrow">Instituto Államo · PMO</div><h1>OPR</h1><small>Governança com URLs permanentes</small></div><div class="navlabel">Links oficiais permanentes</div><div class="nav">${links(officialRoutes,active)}</div><div class="navlabel">Módulos de apoio</div><div class="nav">${links(supportRoutes,active)}</div><div class="side-note"><b>Fonte única e rastreável.</b><br>Reunião / Documento / Cliente / Fornecedor / PMO → Evidência → Ação / Decisão / Risco → Plano de Ação → Banco → Execução → Evidência → POP / Mapa Mestre → Status Report.<br><br><b>Regra:</b> o endereço oficial não muda; versões ficam no Git e no banco.</div>`}
  async function init(active,title,subtitle){const side=document.getElementById('sidebar');if(side)side.innerHTML=nav(active);const t=document.getElementById('pageTitle');if(t)t.textContent=title||active;const s=document.getElementById('pageSub');if(s)s.textContent=subtitle||'Dados persistentes no Cloudflare D1';const p=await resolveProject();document.querySelectorAll('[data-project-name]').forEach(x=>x.textContent=p.name);return p}
  function openModal(id){document.getElementById(id)?.classList.add('on')}
  function closeModal(id){document.getElementById(id)?.classList.remove('on')}
  function formValue(id){const e=document.getElementById(id);if(!e)return '';if(e.type==='checkbox')return e.checked;return e.value}
  function setValue(id,v){const e=document.getElementById(id);if(!e)return;if(e.type==='checkbox')e.checked=!!v;else e.value=v??''}
  async function softDelete(entity,id,onDone){if(!confirm('Enviar este registro para a lixeira?'))return;try{await api(`/api/opr-platform/${entity}/${encodeURIComponent(id)}`,{method:'DELETE'});showMessage('Registro enviado para a lixeira.');if(onDone)await onDone()}catch(e){showMessage(e.message,'error')}}
  async function restore(entity,id,onDone){try{await api(`/api/opr-platform/${entity}/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});showMessage('Registro restaurado.');if(onDone)await onDone()}catch(e){showMessage(e.message,'error')}}
  async function history(entity,id){try{const rows=await api(`/api/opr-platform/${entity}/${encodeURIComponent(id)}/history`);const body=document.getElementById('historyBody');if(body)body.innerHTML=rows.length?rows.map(r=>`<div class="card" style="margin:7px 0"><b>${esc(r.action_type)}</b> · ${esc(r.created_at)} · ${esc(r.actor||'')}<pre style="white-space:pre-wrap;font-size:8px;max-height:220px;overflow:auto">${esc(r.snapshot_json)}</pre></div>`).join(''):'<div class="empty">Sem histórico.</div>';openModal('historyModal')}catch(e){showMessage(e.message,'error')}}
  function operationalProgress(v){return v===null||v===undefined?'N/D':`${Number(v)}% das ações concluídas`}
  window.OPRPlatform={api,esc,resolveProject,init,badge,showMessage,openModal,closeModal,formValue,setValue,softDelete,restore,history,operationalProgress,routes,officialRoutes,supportRoutes};
})();
