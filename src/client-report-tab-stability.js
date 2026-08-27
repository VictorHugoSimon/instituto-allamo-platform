(()=>{
  const engine=window.AllamoClientExecutiveReport;
  if(!engine||typeof engine.renderInto!=='function'||window.__allamoClientTabStability)return;
  window.__allamoClientTabStability=true;
  const base=engine.renderInto.bind(engine);
  engine.renderInto=function(host,report){
    let active=0;
    try{
      const tabs=[...host.querySelectorAll('.acrt .tab')];
      const current=tabs.findIndex(x=>x.classList.contains('on'));
      if(current>=0)active=current;
      else if(host.dataset.allamoActiveReportTab)active=Math.max(0,Number(host.dataset.allamoActiveReportTab)||0);
    }catch(_){}
    const root=base(host,report);
    const tabs=[...root.querySelectorAll('.tab')],panels=[...root.querySelectorAll('.panel')];
    const apply=i=>{
      const idx=Math.max(0,Math.min(tabs.length-1,Number(i)||0));
      tabs.forEach((x,n)=>x.classList.toggle('on',n===idx));
      panels.forEach((x,n)=>x.classList.toggle('on',n===idx));
      host.dataset.allamoActiveReportTab=String(idx);
    };
    apply(active);
    tabs.forEach((tab,i)=>tab.addEventListener('click',()=>{host.dataset.allamoActiveReportTab=String(i)},true));
    return root;
  };
})();
