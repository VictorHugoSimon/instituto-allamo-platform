(()=>{
  if(window.__allamoPublicPwaRuntime)return;
  window.__allamoPublicPwaRuntime=true;

  const KEY='allamo_public_pwa_tenant';
  const params=new URLSearchParams(location.search);
  const requested=String(params.get('cliente')||'').trim();
  const standalone=()=>{
    try{return !!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||(navigator.standalone===true)}catch(_){return false}
  };
  const remember=tenant=>{try{if(tenant)localStorage.setItem(KEY,JSON.stringify({tenant:String(tenant),saved_at:Date.now()}))}catch(_){}};
  const remembered=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&v.tenant?String(v.tenant):''}catch(_){return ''}};

  // Fallback defensivo: se algum navegador ignorar o start_url tenant-safe e abrir a raiz,
  // o app instalado continua preso ao tenant que originou a instalação.
  if(!requested){
    if(standalone()){
      const tenant=remembered();
      if(tenant){location.replace('/?cliente='+encodeURIComponent(tenant)+'&source=pwa-fallback');return}
    }
    // Instalação iniciada no portal interno não deve reutilizar tenant público antigo.
    window.addEventListener('beforeinstallprompt',()=>{try{localStorage.removeItem(KEY)}catch(_){}},{once:true});
    return;
  }

  const manifestHref='/api/public-client-manifest?company='+encodeURIComponent(requested)+'&v=20260822';
  let deferredPrompt=null;

  function ensureManifest(){
    try{
      const head=document.head||document.documentElement;
      if(!head)return;
      let current=document.querySelector('link[data-allamo-public-manifest="1"]');
      document.querySelectorAll('link[rel~="manifest"]').forEach(link=>{
        if(link!==current&&link.getAttribute('data-allamo-public-manifest')!=='1')link.remove();
      });
      if(!current){
        current=document.createElement('link');
        current.rel='manifest';
        current.setAttribute('data-allamo-public-manifest','1');
        head.appendChild(current);
      }
      if(current.getAttribute('href')!==manifestHref)current.setAttribute('href',manifestHref);
      let theme=document.querySelector('meta[name="theme-color"][data-allamo-public-theme="1"]');
      if(!theme){theme=document.createElement('meta');theme.name='theme-color';theme.setAttribute('data-allamo-public-theme','1');head.appendChild(theme)}
      theme.content='#302f39';
    }catch(e){console.warn('[public-pwa] manifesto indisponível',e)}
  }

  ensureManifest();
  window.addEventListener('DOMContentLoaded',ensureManifest);
  window.addEventListener('pageshow',ensureManifest);
  setTimeout(ensureManifest,0);
  setTimeout(ensureManifest,500);
  setTimeout(ensureManifest,1800);

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    window.__allamoPublicInstallPrompt=e;
    remember(requested);
    ensureManifest();
  });
  window.addEventListener('appinstalled',()=>{remember(requested);deferredPrompt=null;window.__allamoPublicInstallPrompt=null});

  document.addEventListener('click',async e=>{
    const btn=e.target&&e.target.closest?e.target.closest('.pc-install'):null;
    if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    remember(requested);
    ensureManifest();
    const p=deferredPrompt||window.__allamoPublicInstallPrompt;
    if(p){
      try{await p.prompt();await p.userChoice}catch(_){ }
      deferredPrompt=null;window.__allamoPublicInstallPrompt=null;
      return;
    }
    alert('Para instalar este painel: use o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”. O aplicativo abrirá diretamente nesta empresa, sem login.');
  },true);

  const observer=new MutationObserver(()=>ensureManifest());
  try{observer.observe(document,{childList:true,subtree:false})}catch(_){ }
})();
