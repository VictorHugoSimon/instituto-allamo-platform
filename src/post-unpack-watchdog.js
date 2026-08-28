(()=>{
  let lastRoot=null,lastExecRefresh=0,reportsOpening=null;
  const leaf=(txt)=>Array.from(document.querySelectorAll('button,a,div,span,p')).filter(e=>e.children.length===0&&e.textContent.trim()===txt);
  function sidebarItemByText(txt){
    const src=leaf(txt).find(e=>{const r=e.getBoundingClientRect();return r.left<260&&r.top>90&&r.top<window.innerHeight-30});
    if(!src)return null;let item=src;
    while(item.parentElement&&item.parentElement.getBoundingClientRect().width<280&&item.parentElement.getBoundingClientRect().height<85)item=item.parentElement;
    return item;
  }
  function feedback(msg,error=false){
    let x=document.getElementById('allamo-reports-menu-feedback');
    if(!x){x=document.createElement('div');x.id='allamo-reports-menu-feedback';x.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483000;border-radius:10px;padding:10px 14px;font:700 12px/1.35 Inter,Arial,sans-serif;box-shadow:0 8px 28px #0003;pointer-events:none;transition:.2s';document.body.appendChild(x)}
    x.style.background=error?'#8f2d2d':'#302f39';x.style.color='#fff';x.textContent=msg;x.style.opacity='1';clearTimeout(x._t);x._t=setTimeout(()=>{x.style.opacity='0'},2200);
  }
  async function openReports(){
    if(reportsOpening)return reportsOpening;
    reportsOpening=(async()=>{
      feedback('Abrindo Reports…');
      for(let i=0;i<40;i++){
        const fn=window.AllamoReports&&window.AllamoReports.open;
        if(typeof fn==='function'){
          try{await fn.call(window.AllamoReports);return true}catch(err){console.error('[reports-menu] falha ao abrir Central de Reports',err);feedback('Não foi possível abrir Reports. Tente novamente.',true);return false}
        }
        const arm=document.getElementById('arm');
        if(arm){arm.style.display='block';return true}
        await new Promise(r=>setTimeout(r,75));
      }
      console.error('[reports-menu] AllamoReports não ficou disponível após o pós-unpack');
      feedback('Reports ainda não carregou. Atualize a página.',true);
      return false;
    })();
    try{return await reportsOpening}finally{reportsOpening=null}
  }
  window.AllamoOpenReports=openReports;
  function ensureSidebar(){
    if(new URLSearchParams(location.search).get('cliente'))return;
    let work=document.querySelector('[data-allamo-work-menu]');
    if(!work){
      const projects=sidebarItemByText('Projetos');
      if(projects){
        work=projects.cloneNode(true);work.setAttribute('data-allamo-work-menu','1');
        const l=Array.from(work.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()==='Projetos');if(l)l.textContent='Trabalho';else work.textContent='Trabalho';
        work.style.cursor='pointer';work.setAttribute('role','button');work.setAttribute('tabindex','0');
        projects.insertAdjacentElement('afterend',work);
      }
    }
    if(work&&!document.querySelector('[data-allamo-reports-menu]')){
      const reports=work.cloneNode(true);reports.removeAttribute('data-allamo-work-menu');reports.setAttribute('data-allamo-reports-menu','1');
      const l=Array.from(reports.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()==='Trabalho');if(l)l.textContent='Reports';else reports.textContent='Reports';
      reports.style.cursor='pointer';reports.setAttribute('role','button');reports.setAttribute('tabindex','0');reports.setAttribute('aria-label','Abrir Central de Reports');
      work.insertAdjacentElement('afterend',reports);
    }
  }
  function ensurePublicClient(){if(new URLSearchParams(location.search).get('cliente')&&window.AllamoPublicClientPortal&&typeof window.AllamoPublicClientPortal.mount==='function')window.AllamoPublicClientPortal.mount()}
  function removeLegacyLaunchers(){document.getElementById('awm-launcher')?.remove();document.getElementById('arm-launcher')?.remove()}
  function executiveVisible(){return Array.from(document.querySelectorAll('h2')).some(e=>e.textContent.trim()==='Distribuição do portfólio')}
  function tick(){
    const root=document.documentElement,changed=root!==lastRoot;if(changed)lastRoot=root;
    ensurePublicClient();ensureSidebar();removeLegacyLaunchers();
    const now=Date.now();if(!new URLSearchParams(location.search).get('cliente')&&executiveVisible()&&typeof window.AllamoRefreshExecutive==='function'&&(changed||now-lastExecRefresh>10000)){lastExecRefresh=now;window.AllamoRefreshExecutive()}
  }
  // Delegação global: continua funcionando mesmo quando o DOM é substituído pelo unpack.
  document.addEventListener('click',e=>{
    const reports=e.target&&e.target.closest?e.target.closest('[data-allamo-reports-menu]'):null;
    if(reports){e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();openReports();return}
    const work=e.target&&e.target.closest?e.target.closest('[data-allamo-work-menu]'):null;
    if(work){e.preventDefault();e.stopPropagation();const fn=window.AllamoWork&&window.AllamoWork.open;if(typeof fn==='function')fn.call(window.AllamoWork)}
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const reports=e.target&&e.target.closest?e.target.closest('[data-allamo-reports-menu]'):null;
    if(reports){e.preventDefault();openReports();return}
    const work=e.target&&e.target.closest?e.target.closest('[data-allamo-work-menu]'):null;
    if(work){e.preventDefault();const fn=window.AllamoWork&&window.AllamoWork.open;if(typeof fn==='function')fn.call(window.AllamoWork)}
  },true);
  window.AllamoPostUnpackTick=tick;
  setInterval(tick,2000);setTimeout(tick,0);
})();
