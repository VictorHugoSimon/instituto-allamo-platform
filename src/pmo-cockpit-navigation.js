(()=>{
  if(window.__allamoPmoCockpitNavigationLoaded)return;
  window.__allamoPmoCockpitNavigationLoaded=true;

  const NAV_ID='allamo-pmo-cockpit-nav';
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function findExecutiveTab(){
    return [...document.querySelectorAll('button')].find(button=>norm(button.textContent)==='visao executiva')||null;
  }

  function mount(){
    const executiveTab=findExecutiveTab();
    const existing=document.getElementById(NAV_ID);
    if(!executiveTab){
      if(existing)existing.remove();
      return;
    }
    if(existing&&existing.parentElement===executiveTab.parentElement)return;
    if(existing)existing.remove();

    const link=document.createElement('a');
    link.id=NAV_ID;
    link.href='/pmo-cockpit/';
    link.setAttribute('aria-label','Abrir Cockpit Executivo PMO');
    link.setAttribute('data-allamo-pmo-nav','cockpit');
    link.innerHTML='<span aria-hidden="true" style="width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#302f39;color:#fff;font-size:10px;font-weight:900">2.0</span><span>Cockpit Executivo</span>';
    link.style.cssText='border:0;background:none;font-size:13.5px;font-weight:800;color:#302f39;padding:12px 15px;text-decoration:none;border-bottom:3px solid transparent;white-space:nowrap;display:flex;align-items:center;gap:8px;cursor:pointer';
    link.addEventListener('mouseenter',()=>{link.style.borderBottomColor='#b88b78'});
    link.addEventListener('mouseleave',()=>{link.style.borderBottomColor='transparent'});
    executiveTab.insertAdjacentElement('afterend',link);
  }

  let timer=0;
  const schedule=()=>{
    if(timer)return;
    timer=setTimeout(()=>{timer=0;mount()},100);
  };
  const start=()=>{
    mount();
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('allamo:data-changed',schedule);
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
