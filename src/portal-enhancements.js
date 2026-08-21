(()=>{
  const token=()=>{
    try{const s=JSON.parse(localStorage.getItem('allamo_session')||'null');if(s&&s.token)return s.token}catch(e){}
    return localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||'';
  };
  const api=async p=>{const t=token();if(!t)throw new Error('Sem sessão');const r=await fetch('/api/'+p,{headers:{authorization:'Bearer '+t},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()};
  const exact=(txt)=>Array.from(document.querySelectorAll('button,a,div,span,p')).filter(e=>e.children.length===0&&e.textContent.trim()===txt);
  let companyRefreshAt=0,companyLoading=false;

  function workMenu(){
    if(document.querySelector('[data-allamo-work-menu]'))return;
    const candidates=exact('Projetos').filter(e=>{const r=e.getBoundingClientRect();return r.left<260&&r.top>100&&r.top<window.innerHeight-40});
    const src=candidates[0]; if(!src)return;
    let item=src;
    while(item.parentElement&&item.parentElement.getBoundingClientRect().width<280&&item.parentElement.getBoundingClientRect().height<85)item=item.parentElement;
    const clone=item.cloneNode(true); clone.setAttribute('data-allamo-work-menu','1');
    const leaf=Array.from(clone.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()==='Projetos');
    if(leaf)leaf.textContent='Trabalho'; else clone.textContent='Trabalho';
    clone.style.cursor='pointer';
    clone.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.AllamoWork&&window.AllamoWork.open();},true);
    item.insertAdjacentElement('afterend',clone);
  }

  async function companyKpi(){
    let count=document.querySelector('[data-allamo-company-count]');
    if(!count){
      const labels=exact('Projetos').filter(e=>{const r=e.getBoundingClientRect();return r.left>250&&r.top>150&&r.top<520});
      const label=labels[0]; if(!label)return;
      let card=label;
      for(let i=0;i<6&&card.parentElement;i++){
        const r=card.getBoundingClientRect(),t=card.textContent||'';
        if(r.width>=140&&r.width<=300&&r.height>=90&&r.height<=220&&/Projetos/.test(t)&&/\d/.test(t))break;
        card=card.parentElement;
      }
      const cr=card.getBoundingClientRect(); if(cr.width<120||cr.width>330)return;
      const clone=card.cloneNode(true); clone.setAttribute('data-allamo-company-kpi','1');
      const leaves=Array.from(clone.querySelectorAll('*')).filter(e=>e.children.length===0);
      const l=leaves.find(e=>e.textContent.trim()==='Projetos'); if(l)l.textContent='Empresas';
      const n=leaves.find(e=>/^\s*\d+\s*$/.test(e.textContent));
      if(n){n.textContent='—';n.setAttribute('data-allamo-company-count','1')}
      const sub=leaves.find(e=>/portf[oó]lio atual|projeto/i.test(e.textContent)&&e!==l); if(sub)sub.textContent='empresas cadastradas';
      card.insertAdjacentElement('beforebegin',clone);
      count=n||null;
    }
    if(!count||!token())return;
    const now=Date.now();if(companyLoading||now-companyRefreshAt<2500)return;
    companyRefreshAt=now;companyLoading=true;
    try{const companies=await api('companies');count.textContent=String(Array.isArray(companies)?companies.length:0)}
    catch(e){console.error('[company-kpi]',e);count.textContent='0'}
    finally{companyLoading=false}
  }

  function tick(){workMenu();companyKpi();}
  const obs=new MutationObserver(()=>tick());
  const start=()=>{obs.observe(document.documentElement,{subtree:true,childList:true});tick();setInterval(tick,1500)};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
