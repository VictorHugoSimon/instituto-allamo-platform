(()=>{
  if(window.__allamoReportProjectScopeUi)return;
  window.__allamoReportProjectScopeUi=true;

  function patchReportForm(root=document){
    const project=root.querySelector&&root.querySelector('#rp');
    const company=root.querySelector&&root.querySelector('#rc');
    if(!project||!company)return;
    const label=[...root.querySelectorAll('label')].find(x=>/^Projeto\s*\*?$/i.test((x.textContent||'').trim()));
    if(label)label.textContent='Projeto *';
    const first=project.options&&project.options[0];
    if(first&&!first.value)first.textContent='Selecione um projeto...';
    project.required=true;
    company.required=true;
  }

  function showError(box,msg){
    let err=box.querySelector('.err');
    if(!err){err=document.createElement('div');err.className='err';box.prepend(err)}
    err.textContent=msg;
  }

  document.addEventListener('click',e=>{
    const btn=e.target&&e.target.closest?e.target.closest('#save'):null;
    if(!btn)return;
    const modal=btn.closest('.modal');
    if(!modal)return;
    const project=modal.querySelector('#rp');
    const company=modal.querySelector('#rc');
    if(!project||!company)return;
    patchReportForm(modal);
    if(!company.value){e.preventDefault();e.stopImmediatePropagation();showError(modal.querySelector('.box')||modal,'Selecione a empresa.');return}
    if(!project.value){e.preventDefault();e.stopImmediatePropagation();showError(modal.querySelector('.box')||modal,'Selecione o projeto. Cada Report precisa estar ligado a um projeto.');return}
  },true);

  document.addEventListener('change',e=>{
    if(e.target&&e.target.id==='rc')setTimeout(()=>patchReportForm(e.target.closest('.modal')||document),0);
  },true);

  const observer=new MutationObserver(()=>document.querySelectorAll('.modal').forEach(patchReportForm));
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
