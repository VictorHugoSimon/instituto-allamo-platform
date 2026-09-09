(()=>{
  const script=document.currentScript,page=String(script?.dataset?.madriPage||'').trim();
  if(!['pop','map'].includes(page))return;
  const selector=page==='pop'?'.section .editable':'.editable';
  let editing=false,beforeEdit='',historyCache=[];
  const els=()=>[...document.querySelectorAll(selector)];
  const snap=()=>Object.fromEntries(els().map((e,i)=>[String(i),e.innerHTML]));
  const official=snap();
  const apply=data=>{if(!data||typeof data!=='object')return;els().forEach((e,i)=>{if(data[String(i)]!=null)e.innerHTML=data[String(i)]})};
  const api=async(path,opt={})=>{const r=await fetch('/api/madri-platform/'+path,{cache:'no-store',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||('Falha HTTP '+r.status));return j};
  const toast=m=>{const t=document.createElement('div');t.textContent=m;t.style='position:fixed;right:20px;bottom:20px;background:#111827;color:#fff;padding:10px 13px;border-radius:10px;font-size:10px;font-weight:800;z-index:90;box-shadow:0 12px 35px #0003';document.body.appendChild(t);setTimeout(()=>t.remove(),2600)};
  const title=()=>page==='pop'?'POP-001 MADRI × NUCCI':'Mapa Mestre da Implantação MADRI × NUCCI';
  const setEditing=on=>{editing=on;document.body.classList.toggle('editing',on);els().forEach(e=>e.contentEditable=on?'true':'false');const b=document.getElementById('editBtn');if(b)b.textContent=on?(page==='pop'?'Sair da edição':'Sair da edição'):(page==='pop'?'Editar POP':'Editar mapa')};
  async function loadCurrent(){try{const r=await api('pages/'+page);if(r.current?.content_json){const data=JSON.parse(r.current.content_json||'{}');apply(data)}historyCache=r.history||[];renderHistory()}catch(e){toast('D1 indisponível: exibindo baseline publicada.')}}
  window.toggleEdit=()=>{const next=!editing;if(next)beforeEdit=JSON.stringify(snap());setEditing(next)};
  window.saveEdit=async()=>{try{const r=await api('pages/'+page,{method:'PUT',body:JSON.stringify({title:title(),content:snap(),reason:'Edição pela interface MADRI'})});setEditing(false);historyCache=r.current?[...(historyCache||[])]:historyCache;await refreshHistory();toast('Alterações persistidas no D1 MADRI.')}catch(e){toast('Falha ao salvar: '+e.message)}};
  window.cancelEdit=()=>{if(beforeEdit)try{apply(JSON.parse(beforeEdit))}catch{}setEditing(false)};
  window.resetOfficial=async()=>{if(!confirm('Restaurar a baseline oficial publicada? A restauração será registrada como nova versão no D1.'))return;apply(official);try{await api('pages/'+page,{method:'PUT',body:JSON.stringify({title:title(),content:official,reason:'Restauração da baseline oficial publicada'})});setEditing(false);await refreshHistory();toast('Baseline oficial restaurada e versionada no D1.')}catch(e){toast('Falha ao restaurar: '+e.message)}};
  async function refreshHistory(){try{const r=await api('pages/'+page+'/history');historyCache=r.history||[];renderHistory()}catch{}}
  window.toggleHistory=()=>{const box=document.getElementById('historyBox');if(box)box.classList.toggle('on');refreshHistory()};
  function renderHistory(){const box=document.getElementById('historyList');if(!box)return;box.innerHTML=historyCache.length?historyCache.map(v=>`<div class="historyItem"><div><small>${new Date(v.created_at).toLocaleString('pt-BR')} · v${v.version}</small><br><small>${escapeHtml(v.actor||'')}${v.reason?' · '+escapeHtml(v.reason):''}</small></div><button class="btn light" onclick="restoreHistory(${Number(v.id)})">Restaurar</button></div>`).join(''):'<p>Nenhuma versão D1 salva ainda.</p>'}
  window.renderHistory=renderHistory;
  window.restoreHistory=async id=>{try{const r=await api(`pages/${page}/history/${Number(id)}/restore`,{method:'POST',body:'{}'});if(r.current?.content_json)apply(JSON.parse(r.current.content_json||'{}'));await refreshHistory();toast('Versão restaurada e registrada como nova versão.')}catch(e){toast('Falha ao restaurar: '+e.message)}};
  const escapeHtml=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  window.exportJSON=()=>{const p={document:title(),exportedAt:new Date().toISOString(),source:'MADRI D1',sections:snap()};const b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='POP_MADRI_NUCCI_editavel.json';a.click();URL.revokeObjectURL(a.href)};
  window.exportMap=()=>{const p={document:title(),exportedAt:new Date().toISOString(),source:'MADRI D1',content:snap()};const b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='Mapa_Mestre_Implantacao_MADRI_NUCCI.json';a.click();URL.revokeObjectURL(a.href)};
  window.showView=v=>{document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));document.getElementById('view-'+v)?.classList.add('on');document.querySelector(`.tab[data-view="${v}"]`)?.classList.add('on');window.scrollTo({top:0,behavior:'smooth'})};
  loadCurrent();
})();
