(()=>{
  let lastRoot=null,lastExecRefresh=0;
  const leaf=(txt)=>Array.from(document.querySelectorAll('button,a,div,span,p')).filter(e=>e.children.length===0&&e.textContent.trim()===txt);
  function sidebarItemByText(txt){
    const src=leaf(txt).find(e=>{const r=e.getBoundingClientRect();return r.left<260&&r.top>90&&r.top<window.innerHeight-30});
    if(!src)return null;let item=src;
    while(item.parentElement&&item.parentElement.getBoundingClientRect().width<280&&item.parentElement.getBoundingClientRect().height<85)item=item.parentElement;
    return item;
  }
  function ensureSidebar(){
    let work=document.querySelector('[data-allamo-work-menu]');
    if(!work){
      const projects=sidebarItemByText('Projetos');
      if(projects){
        work=projects.cloneNode(true);work.setAttribute('data-allamo-work-menu','1');
        const l=Array.from(work.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()==='Projetos');if(l)l.textContent='Trabalho';else work.textContent='Trabalho';
        work.style.cursor='pointer';work.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.AllamoWork&&window.AllamoWork.open()},true);projects.insertAdjacentElement('afterend',work);
      }
    }
    if(work&&!document.querySelector('[data-allamo-reports-menu]')){
      const reports=work.cloneNode(true);reports.removeAttribute('data-allamo-work-menu');reports.setAttribute('data-allamo-reports-menu','1');
      const l=Array.from(reports.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()==='Trabalho');if(l)l.textContent='Reports';else reports.textContent='Reports';
      reports.style.cursor='pointer';reports.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.AllamoReports&&window.AllamoReports.open()},true);work.insertAdjacentElement('afterend',reports);
    }
  }
  function launcher(id,label,bottom,bg,open){
    if(document.getElementById(id)||!document.body)return;
    const b=document.createElement('button');b.id=id;b.textContent=label;b.style.cssText=`position:fixed;right:20px;bottom:${bottom}px;z-index:99980;border:0;border-radius:999px;padding:11px 16px;background:${bg};color:white;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer`;b.onclick=open;document.body.appendChild(b);
  }
  function ensureLaunchers(){
    launcher('awm-launcher','Trabalho',86,'#242321',()=>window.AllamoWork&&window.AllamoWork.open());
    launcher('arm-launcher','Reports',136,'#8f715e',()=>window.AllamoReports&&window.AllamoReports.open());
  }
  function executiveVisible(){return Array.from(document.querySelectorAll('h2')).some(e=>e.textContent.trim()==='Distribuição do portfólio')}
  function tick(){
    const root=document.documentElement,changed=root!==lastRoot;if(changed)lastRoot=root;
    ensureSidebar();ensureLaunchers();
    const now=Date.now();if(executiveVisible()&&typeof window.AllamoRefreshExecutive==='function'&&(changed||now-lastExecRefresh>10000)){lastExecRefresh=now;window.AllamoRefreshExecutive()}
  }
  window.AllamoPostUnpackTick=tick;
  setInterval(tick,750);setTimeout(tick,0);
})();
