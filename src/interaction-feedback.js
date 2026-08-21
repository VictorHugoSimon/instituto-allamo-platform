(()=>{
  if(window.__allamoInteractionFeedbackLoaded)return;window.__allamoInteractionFeedbackLoaded=true;
  function toast(msg,kind='info'){let x=document.getElementById('allamo-global-toast');if(!x){x=document.createElement('div');x.id='allamo-global-toast';x.style.cssText='position:fixed;right:18px;bottom:18px;z-index:100005;max-width:min(380px,calc(100vw - 36px));border-radius:11px;padding:11px 14px;color:#fff;font:750 12px/1.4 Inter,Arial,sans-serif;box-shadow:0 10px 32px #0004;transition:.2s;pointer-events:none';document.body.appendChild(x)}x.style.background=kind==='ok'?'#027a48':kind==='error'?'#b42318':'#302f39';x.textContent=msg;x.style.opacity='1';clearTimeout(x._t);x._t=setTimeout(()=>{x.style.opacity='0'},2200)}
  function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(!b)return;const t=norm(b.textContent);
    if(b.closest('#arm')&&t==='publicar'){toast('Publicando Report…');setTimeout(()=>{const still=[...document.querySelectorAll('#arm button')].some(x=>norm(x.textContent)==='publicar');if(!still){toast('Report publicado. Já está disponível no painel da empresa.','ok');window.dispatchEvent(new CustomEvent('allamo:reports-changed'))}},700);return}
    if(b.closest('#arm .modal')&&t==='salvar'){toast('Salvando Report…');setTimeout(()=>window.dispatchEvent(new CustomEvent('allamo:reports-changed')),700);return}
    if(b.closest('#arm')&&t==='atualizar'){toast('Atualizando Reports…');return}
    const virada=[...document.querySelectorAll('h1,h2')].some(h=>h.offsetParent!==null&&norm(h.textContent).includes('nova virada / versao'));if(virada&&(t.includes('salvar')||t.includes('registrar'))){toast('Registrando Virada / versão…');setTimeout(()=>toast('Registro processado. Confira o Histórico de Viradas & Versões.','ok'),1000)}
  },true);
  window.AllamoToast=toast;
})();
