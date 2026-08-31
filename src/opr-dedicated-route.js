(()=>{
  if(window.__allamoOprDedicatedRoute)return;
  window.__allamoOprDedicatedRoute=true;
  const apply=()=>{
    const btn=document.getElementById('oprPmoBtn');
    if(!btn)return false;
    btn.textContent='OPR · Plano de Ação';
    btn.title='Abrir Plano de Ação OPR';
    btn.onclick=()=>{window.location.href='/opr-plano-de-acao/'};
    return true;
  };
  if(!apply()){
    const obs=new MutationObserver(()=>{if(apply())obs.disconnect()});
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),15000);
  }
})();
