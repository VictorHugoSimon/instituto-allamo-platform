(()=>{
  const params=new URLSearchParams(location.search);
  if(!params.get('cliente'))return;
  const STYLE_ID='allamo-public-client-layer-fix';
  const apply=()=>{
    if(document.body){
      document.body.setAttribute('data-allamo-public-client-shell','1');
      document.body.setAttribute('data-allamo-public-no-user','1');
    }
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;(document.head||document.documentElement).appendChild(s)}
    s.textContent=`
      body[data-allamo-public-no-user="1"] > *:not(#allamo-public-client-portal):not(.arrv):not(.pc-modal){display:none!important}
      #allamo-public-client-portal{z-index:2147482000!important}
      .arrv{z-index:2147483000!important}
      .pc-modal{z-index:2147483500!important}
    `;
  };
  apply();
  document.addEventListener('DOMContentLoaded',apply);
  window.addEventListener('pageshow',apply);
  const mo=new MutationObserver(()=>apply());
  try{mo.observe(document.documentElement,{childList:true,subtree:false})}catch(_){ }
})();
