(()=>{
  if(window.__allamoPublicPwaRuntime)return;
  const params=new URLSearchParams(location.search);
  const requested=String(params.get('cliente')||'').trim();
  if(!requested)return;
  window.__allamoPublicPwaRuntime=true;

  const manifestHref='/api/public-client-manifest?company='+encodeURIComponent(requested);
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
    ensureManifest();
  });
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;window.__allamoPublicInstallPrompt=null});

  document.addEventListener('click',async e=>{
    const btn=e.target&&e.target.closest?e.target.closest('.pc-install'):null;
    if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
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
