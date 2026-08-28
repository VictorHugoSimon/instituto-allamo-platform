(()=>{
  if(window.__allamoReportDirectLinkLoaded)return;
  window.__allamoReportDirectLinkLoaded=true;

  const officialHost=/(^|\.)(?:allamo-pmo-stage|allamo-pmo)\.pages\.dev$/i.test(location.hostname||'');
  const token=()=>{try{return JSON.parse(localStorage.getItem('allamo_session')||'{}').token||''}catch(_){return ''}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast=(msg,kind='info')=>{if(window.AllamoToast)return window.AllamoToast(msg,kind);if(window.AllamoActionFeedback)return window.AllamoActionFeedback(msg);console.log('[report-link]',msg)};
  const api=async p=>{
    const t=officialHost?'':token();
    const headers={};if(t)headers.authorization='Bearer '+t;
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
    try{
      const r=await fetch('/api/'+p,{headers,cache:'no-store',credentials:'same-origin',signal:ctrl.signal});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'HTTP '+r.status);
      return d;
    }catch(err){if(err?.name==='AbortError')throw new Error('Tempo limite ao buscar o Report. Tente novamente.');throw err}
    finally{clearTimeout(timer)}
  };

  // O ID do Report é a chave imutável. Não precisamos criar coluna adicional no banco.
  const buildLink=r=>{
    if(!r?.id||!r?.company_id||r?.project_id==null||r?.project_id==='')return '';
    const u=new URL(location.origin+'/');
    u.searchParams.set('cliente',String(r.company_id));
    u.searchParams.set('projeto',String(r.project_id));
    u.searchParams.set('report',String(r.id));
    return u.toString();
  };
  const copy=async text=>{
    try{await navigator.clipboard.writeText(text);return true}catch(_){
      try{const x=document.createElement('textarea');x.value=text;x.style.cssText='position:fixed;opacity:0';document.body.appendChild(x);x.select();const ok=document.execCommand('copy');x.remove();return ok}catch(__){return false}
    }
  };

  function show(r){
    const link=buildLink(r);if(!link)return;
    try{sessionStorage.setItem('allamo_last_created_report_link',link)}catch(_){}
    document.querySelector('[data-report-direct-link-modal]')?.remove();
    const published=String(r.status||'').toUpperCase()==='PUBLICADO';
    const m=document.createElement('div');m.setAttribute('data-report-direct-link-modal','1');
    m.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,Arial,sans-serif';
    m.innerHTML=`<div style="width:min(720px,96vw);background:#fff;border-radius:16px;padding:20px;box-shadow:0 22px 70px #0005"><div style="font-size:11px;font-weight:850;color:#8f715e;letter-spacing:.05em">LINK EXCLUSIVO DO REPORT</div><h2 style="margin:5px 0 8px;color:#302f39">${published?'Report publicado':'Report criado como rascunho'}</h2><p style="margin:0 0 12px;color:#667085;font-size:13px;line-height:1.5">${published?'Este endereço abre diretamente esta edição do Report no projeto correto.':'O endereço desta edição já foi criado e permanecerá o mesmo. O cliente só conseguirá abrir quando esta edição for publicada.'}</p><input data-link readonly value="${esc(link)}" style="width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:9px;padding:10px;font-size:12px"><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px"><button data-copy style="border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer">Copiar link</button>${published?'<button data-open style="border:0;background:#b88b78;color:#fff;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer">Abrir link</button>':''}<button data-close style="border:0;background:#302f39;color:#fff;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer">Fechar</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('[data-copy]').onclick=async()=>{const ok=await copy(link);toast(ok?'Link exclusivo do Report copiado.':'Não foi possível copiar o link automaticamente.',ok?'ok':'error')};
    m.querySelector('[data-open]')?.addEventListener('click',()=>window.open(link,'_blank','noopener'));
    m.querySelector('[data-close]').onclick=()=>m.remove();m.addEventListener('click',e=>{if(e.target===m)m.remove()});
  }

  async function resolveAndShow(id,quiet=false){
    if(!id)return;
    try{const r=await api('report-records/'+encodeURIComponent(id));show(r)}catch(err){if(!quiet)toast(err.message,'error')}
  }

  // O criador oficial já emite este evento ao concluir um POST com sucesso.
  window.addEventListener('allamo:reports-changed',e=>{
    const d=e.detail||{};
    if(d.reason==='official-report-created'&&d.id)setTimeout(()=>resolveAndShow(d.id),80);
  });

  // Todo Report existente ganha ação de link, inclusive os criados por recorrência/IA.
  function enhanceRows(){
    document.querySelectorAll('#arm .rrow[data-report]').forEach(row=>{
      if(row.querySelector('[data-report-direct-link]'))return;
      const id=String(row.dataset.report||'');if(!id)return;
      const first=row.firstElementChild;if(!first)return;
      const b=document.createElement('button');b.type='button';b.setAttribute('data-report-direct-link',id);b.textContent='🔗 Link';
      b.style.cssText='margin-top:6px;border:1px solid #d0d5dd;background:#fff;border-radius:7px;padding:4px 7px;font-size:10.5px;font-weight:800;cursor:pointer;color:#302f39';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();resolveAndShow(id)};
      first.appendChild(b);
    });
  }
  const mo=new MutationObserver(enhanceRows);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{mo.observe(document.body,{childList:true,subtree:true});enhanceRows()}):(()=>{mo.observe(document.body,{childList:true,subtree:true});enhanceRows()})();

  window.AllamoReportDirectLink={build:buildLink,open:resolveAndShow};
})();
