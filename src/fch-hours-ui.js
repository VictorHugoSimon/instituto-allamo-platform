(()=>{
  if(window.__allamoFchHoursUi)return;
  window.__allamoFchHoursUi=true;

  const ID='allamo-fch-curve-card';
  const STYLE='allamo-fch-curve-style';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:Number(n)%1?1:0,maximumFractionDigits:2});
  const token=()=>{
    try{const s=JSON.parse(localStorage.getItem('allamo_session')||'null');if(s&&s.token)return s.token}catch(e){}
    return localStorage.getItem('allamo_session_token')||localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||'';
  };
  const api=async p=>{
    const t=token();if(!t)throw new Error('Sessão não encontrada');
    const r=await fetch('/api/'+p,{headers:{authorization:'Bearer '+t},cache:'no-store'});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erro '+r.status);return d;
  };

  const css=`
#${ID}{margin-top:14px;border:1px solid #dedbd6;border-radius:14px;background:#fff;padding:16px;box-shadow:0 3px 12px rgba(48,47,57,.05);color:#302f39}
#${ID} .fh{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}#${ID} .fh>div:first-child{flex:1;min-width:220px}
#${ID} h3{margin:0 0 4px;font-size:16px}#${ID} .sub{font-size:11px;color:#777}
#${ID} .kpis{display:grid;grid-template-columns:repeat(4,minmax(115px,1fr));gap:8px;margin:12px 0}
#${ID} .k{background:#f7f6f3;border-radius:10px;padding:10px}#${ID} .k b{display:block;font-size:20px}#${ID} .k span{font-size:10px;color:#777}
#${ID} .chart{overflow-x:auto;border-top:1px solid #eee;padding-top:10px}#${ID} svg{width:100%;min-width:620px;height:250px;display:block}
#${ID} .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#666;margin-top:6px}.allamo-fch-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:4px}
#${ID} .note{font-size:10.5px;color:#777;margin-top:8px}#${ID} .err{color:#a12626;background:#fff1f1;border-radius:8px;padding:10px}
@media(max-width:760px){#${ID} .kpis{grid-template-columns:1fr 1fr}}
`;

  function ensureStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=css;document.head.appendChild(s)}
  function poly(values,w,h,pad,max){
    if(!values.length)return'';
    return values.map((v,i)=>{
      const x=pad+(values.length===1?0:i*(w-2*pad)/(values.length-1));
      const y=h-pad-(max?Number(v||0)/max*(h-2*pad):0);
      return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
  }
  function chart(curve){
    const w=860,h=250,p=34,actual=curve.actual||[],planned=curve.planned||[];
    const max=Math.max(1,...actual.map(Number),...planned.map(Number));
    let grid='';for(let i=0;i<=4;i++){const y=p+i*(h-2*p)/4,val=max*(4-i)/4;grid+=`<line x1="${p}" y1="${y}" x2="${w-p}" y2="${y}" stroke="#ece9e4"/><text x="${p-6}" y="${y+3}" text-anchor="end" font-size="9" fill="#888">${fmt(val)}</text>`}
    const dates=curve.dates||[],step=Math.max(1,Math.ceil(dates.length/6));let labels='';
    for(let i=0;i<dates.length;i+=step){const x=p+(dates.length===1?0:i*(w-2*p)/(dates.length-1));labels+=`<text x="${x}" y="244" text-anchor="middle" font-size="9" fill="#777">${esc(dates[i].slice(5).split('-').reverse().join('/'))}</text>`}
    const ap=poly(actual,w,h,p,max),pp=poly(planned,w,h,p,max);
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Curva S automática de horas">${grid}${pp?`<polyline points="${pp}" fill="none" stroke="#b88b78" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`:''}${ap?`<polyline points="${ap}" fill="none" stroke="#2a78d6" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`:''}${labels}</svg>`;
  }

  function reportContext(){
    const arm=document.getElementById('arm');
    if(!arm||getComputedStyle(arm).display==='none')return null;
    const panel=arm.querySelector('.panel');if(!panel)return null;
    const meta=panel.querySelector('.small');const text=meta?.textContent||'';
    const n=norm(text);if(!(n.includes('opr')||n.includes('madri')||n.includes('madrid')))return null;
    const content=panel.querySelector('#rcontent');if(!content)return null;
    const summary=[...panel.querySelectorAll('.tabs button')].find(b=>norm(b.textContent)==='resumo');
    if(summary&&!summary.classList.contains('on'))return null;
    return {text,anchor:content};
  }

  async function resolveCompany(text){
    const cs=await api('companies');const n=norm(text),list=Array.isArray(cs)?cs:[];
    return list.find(c=>{const name=norm(c.name);return name&&(n.includes(name)||name.includes(n))})||
      list.find(c=>n.includes('madri')&&(norm(c.name).includes('madri')||norm(c.name).includes('madrid')))||
      list.find(c=>n.includes('opr')&&norm(c.name).includes('opr'))||null;
  }

  let busy=false,lastKey='';
  async function render(){
    if(busy)return;
    const ctx=reportContext();
    if(!ctx){document.getElementById(ID)?.remove();lastKey='';return}
    busy=true;ensureStyle();
    try{
      const co=await resolveCompany(ctx.text);if(!co)return;
      const key=String(co.id)+'|'+norm(ctx.text);
      const old=document.getElementById(ID);if(old&&lastKey===key)return;old?.remove();
      const host=document.createElement('section');host.id=ID;host.innerHTML='<div class="sub">Carregando horas FCH e Curva S…</div>';
      ctx.anchor.insertAdjacentElement('afterend',host);lastKey=key;
      try{
        const curve=await api('fch-curve?company='+encodeURIComponent(co.id));
        const variance=curve.variance_hours==null?'—':((curve.variance_hours>0?'+':'')+fmt(curve.variance_hours)+'h');
        const planAvailable=Number(curve.planned_timed_total||0)>0;
        host.innerHTML=`
          <div class="fh"><div><h3>Curva S de Horas · Automática</h3><div class="sub">FCH Google Drive → ${esc(curve.target)} · última sincronização: ${esc(curve.last_sync||'ainda não realizada')}</div></div></div>
          <div class="kpis">
            <div class="k"><b>${fmt(curve.actual_total)}h</b><span>Realizado FCH</span></div>
            <div class="k"><b>${curve.planned_total?fmt(curve.planned_total)+'h':'—'}</b><span>Horas planejadas</span></div>
            <div class="k"><b>${variance}</b><span>${planAvailable?'realizado − previsto':'baseline temporal pendente'}</span></div>
            <div class="k"><b>${esc(curve.target)}</b><span>Centro analítico</span></div>
          </div>
          <div class="chart">${curve.dates?.length?chart(curve):'<div class="sub">Ainda não há série temporal suficiente para desenhar a Curva S.</div>'}</div>
          <div class="legend"><span><i class="allamo-fch-dot" style="background:#2a78d6"></i>Realizado FCH</span><span><i class="allamo-fch-dot" style="background:#b88b78"></i>Planejado</span></div>
          <div class="note">Fonte somente leitura: ${esc(curve.source||'FCH')}. Regra OPR_Madri: cada hora é refletida integralmente em OPR e MADRI, sem duplicar a capacidade interna do Instituto Államo.${curve.unplanned_plan_hours?' Existem '+fmt(curve.unplanned_plan_hours)+'h planejadas sem datas e, por isso, fora da linha temporal.':''}</div>`;
      }catch(err){host.innerHTML=`<div class="err"><b>Curva S automática indisponível.</b><br>${esc(err.message)}</div>`}
    }finally{busy=false}
  }

  document.addEventListener('click',()=>setTimeout(render,180),true);
  new MutationObserver(()=>setTimeout(render,120)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
  setInterval(render,30000);
  setTimeout(render,900);
})();
