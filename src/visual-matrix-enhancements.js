(()=>{
  if(window.__allamoVisualMatricesLoaded)return;
  window.__allamoVisualMatricesLoaded=true;

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STYLE_ID='allamo-visual-matrices-style';
  const css=`
  .avm-wrap{margin:10px 0 14px}.avm-title{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}.avm-title b{font-size:13px;color:#344054}.avm-sub{font-size:11px;color:#667085}
  .avm-legend{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 10px}.avm-leg{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#475467}.avm-dot{width:11px;height:11px;border-radius:3px;display:inline-block}
  .avm-risk-grid{display:grid;grid-template-columns:42px repeat(5,minmax(92px,1fr));gap:4px;min-width:610px}.avm-axis{display:grid;place-items:center;font-size:10px;font-weight:800;color:#667085;min-height:38px}.avm-cell{min-height:84px;border-radius:9px;padding:6px;border:1px solid rgba(16,24,40,.08);overflow:hidden}.avm-cell-score{font-size:9px;font-weight:900;opacity:.72;margin-bottom:4px}.avm-risk-chip{display:block;border-radius:7px;background:rgba(255,255,255,.88);border:1px solid rgba(16,24,40,.12);padding:4px 5px;margin:3px 0;font-size:10px;font-weight:800;color:#344054;line-height:1.25}.avm-risk-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}.avm-risk-unclassified{margin-top:8px;padding:8px;border:1px dashed #d0d5dd;border-radius:9px;font-size:11px;color:#667085}
  .avm-raci-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:8px 0 10px}.avm-raci-stat{border-radius:10px;padding:9px 10px;color:#fff;min-width:0}.avm-raci-stat b{display:block;font-size:18px;line-height:1}.avm-raci-stat span{display:block;font-size:10px;margin-top:4px;opacity:.92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.avm-raci-bar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:#eef1f4;margin:7px 0 10px}.avm-raci-seg{height:100%;min-width:0}.avm-raci-r{background:#2563eb}.avm-raci-a{background:#7c3aed}.avm-raci-c{background:#d97706}.avm-raci-i{background:#64748b}.avm-raci-table td.avm-role-r{background:#eff6ff!important;border-left:4px solid #2563eb!important}.avm-raci-table td.avm-role-a{background:#f5f3ff!important;border-left:4px solid #7c3aed!important}.avm-raci-table td.avm-role-c{background:#fffbeb!important;border-left:4px solid #d97706!important}.avm-raci-table td.avm-role-i{background:#f8fafc!important;border-left:4px solid #64748b!important}.avm-role-label{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:7px;color:#fff;font-weight:900;font-size:11px;margin-right:6px}
  .avm-s1{background:#dcfce7}.avm-s2{background:#fef9c3}.avm-s3{background:#fed7aa}.avm-s4{background:#fecaca}.avm-s5{background:#fca5a5}
  @media(max-width:760px){.avm-raci-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.avm-risk-grid{min-width:590px}.avm-cell{min-height:76px}}
  `;
  function ensureStyle(){let s=document.getElementById(STYLE_ID);if(!s){s=document.createElement('style');s.id=STYLE_ID;(document.head||document.documentElement).appendChild(s)}if(s.textContent!==css)s.textContent=css}

  function level(v,type){
    const raw=String(v??'').trim();
    const n=Number(raw.replace(',','.'));
    if(Number.isFinite(n)&&n>=1&&n<=5)return Math.round(n);
    const x=norm(raw);
    if(!x)return 0;
    if(type==='prob'){
      if(/quase certo|muito alta|altissima|certa/.test(x))return 5;
      if(/provavel|alta/.test(x))return 4;
      if(/possivel|media|moderada/.test(x))return 3;
      if(/improvavel|baixa/.test(x))return 2;
      if(/rara|remota|muito baixa/.test(x))return 1;
    }else{
      if(/catastrof|critico|muito alto|muito alta/.test(x))return 5;
      if(/alto|alta|grave/.test(x))return 4;
      if(/moderado|media|medio/.test(x))return 3;
      if(/baixo|baixa|menor/.test(x))return 2;
      if(/insignificante|minimo|minima|muito baixo/.test(x))return 1;
    }
    return 0;
  }
  const sev=score=>score>=17?5:score>=10?4:score>=5?3:score>=3?2:1;
  const sevName=s=>({1:'Baixo',2:'Moderado',3:'Atenção',4:'Alto',5:'Crítico'}[s]||'');

  function riskRows(table){return [...table.querySelectorAll('tbody tr')].map(tr=>{const c=[...tr.children].map(td=>(td.innerText||td.textContent||'').trim());return {risk:c[0]||'',prob:c[1]||'',impact:c[2]||'',owner:c[3]||'',mitig:c[4]||''}}).filter(x=>x.risk)}
  function buildRisk(table){
    if(table.dataset.avmRisk==='1')return;table.dataset.avmRisk='1';
    const rows=riskRows(table);if(!rows.length)return;
    const cells={};const unknown=[];
    rows.forEach(r=>{const p=level(r.prob,'prob'),i=level(r.impact,'impact');if(!p||!i){unknown.push(r);return}const k=p+'-'+i;(cells[k]||(cells[k]=[])).push(r)});
    let grid='<div class="avm-risk-scroll"><div class="avm-risk-grid"><div></div>';
    for(let i=1;i<=5;i++)grid+=`<div class="avm-axis">Impacto ${i}</div>`;
    for(let p=5;p>=1;p--){grid+=`<div class="avm-axis">P${p}</div>`;for(let i=1;i<=5;i++){const score=p*i,s=sev(score),items=cells[p+'-'+i]||[];grid+=`<div class="avm-cell avm-s${s}" title="Probabilidade ${p} × Impacto ${i} = ${score} · ${sevName(s)}"><div class="avm-cell-score">${score} · ${sevName(s)}</div>${items.map(r=>`<span class="avm-risk-chip">${esc(r.risk)}</span>`).join('')}</div>`} }
    grid+='</div></div>';
    const box=document.createElement('div');box.className='avm-wrap';box.setAttribute('data-avm-risk','1');
    box.innerHTML=`<div class="avm-title"><b>Mapa Probabilidade × Impacto</b><span class="avm-sub">Quanto mais à direita e acima, maior a criticidade</span></div><div class="avm-legend"><span class="avm-leg"><i class="avm-dot avm-s1"></i>Baixo</span><span class="avm-leg"><i class="avm-dot avm-s2"></i>Moderado</span><span class="avm-leg"><i class="avm-dot avm-s3"></i>Atenção</span><span class="avm-leg"><i class="avm-dot avm-s4"></i>Alto</span><span class="avm-leg"><i class="avm-dot avm-s5"></i>Crítico</span></div>${grid}${unknown.length?`<div class="avm-risk-unclassified"><b>Sem posição no mapa:</b> ${unknown.map(r=>esc(r.risk)).join(', ')}. Informe Probabilidade e Impacto de 1 a 5 ou em escala textual.</div>`:''}`;
    table.parentElement?.insertAdjacentElement('beforebegin',box);
  }

  const roleMeta={R:{name:'Responsável',color:'#2563eb'},A:{name:'Aprovador / Accountable',color:'#7c3aed'},C:{name:'Consultado',color:'#d97706'},I:{name:'Informado',color:'#64748b'}};
  function buildRaci(table){
    if(table.dataset.avmRaci==='1')return;table.dataset.avmRaci='1';table.classList.add('avm-raci-table');
    const headers=[...table.querySelectorAll('thead th')].map(th=>(th.innerText||'').trim().toUpperCase());
    const idx={};['R','A','C','I'].forEach(r=>idx[r]=headers.indexOf(r));
    if(Object.values(idx).every(i=>i<0))return;
    const count={R:0,A:0,C:0,I:0};
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{const tds=[...tr.children];['R','A','C','I'].forEach(r=>{const i=idx[r];if(i<0||!tds[i])return;const text=(tds[i].innerText||tds[i].textContent||'').trim();tds[i].classList.add('avm-role-'+r.toLowerCase());if(text&&text!=='—'){count[r]++;tds[i].innerHTML=`<span class="avm-role-label avm-raci-${r.toLowerCase()}">${r}</span>${esc(text)}`}})});
    const total=Object.values(count).reduce((a,b)=>a+b,0)||1;
    const box=document.createElement('div');box.className='avm-wrap';box.setAttribute('data-avm-raci','1');
    box.innerHTML=`<div class="avm-title"><b>Mapa visual de responsabilidades</b><span class="avm-sub">Distribuição RACI do ciclo</span></div><div class="avm-raci-summary">${['R','A','C','I'].map(r=>`<div class="avm-raci-stat avm-raci-${r.toLowerCase()}"><b>${count[r]}</b><span>${r} · ${roleMeta[r].name}</span></div>`).join('')}</div><div class="avm-raci-bar" title="Distribuição dos papéis">${['R','A','C','I'].map(r=>`<span class="avm-raci-seg avm-raci-${r.toLowerCase()}" style="width:${(count[r]/total)*100}%"></span>`).join('')}</div><div class="avm-legend">${['R','A','C','I'].map(r=>`<span class="avm-leg"><i class="avm-dot avm-raci-${r.toLowerCase()}"></i><b>${r}</b> ${roleMeta[r].name}</span>`).join('')}</div>`;
    table.parentElement?.insertAdjacentElement('beforebegin',box);
  }

  function enhanceRich(){
    [...document.querySelectorAll('.arrv-card h3')].forEach(h=>{
      const t=norm(h.textContent),card=h.closest('.arrv-card'),table=card?.querySelector('table');if(!table)return;
      if(t==='matriz de riscos'||t==='matriz de risco')buildRisk(table);
      if(t==='matriz raci')buildRaci(table);
    });
  }
  function enhanceGeneric(){
    [...document.querySelectorAll('table')].forEach(table=>{
      if(table.closest('.arrv-card'))return;
      const hs=[...table.querySelectorAll('thead th')].map(x=>norm(x.textContent));
      if(hs.includes('risco')&&hs.some(x=>/prob/.test(x))&&hs.some(x=>/impact/.test(x)))buildRisk(table);
      const up=hs.map(x=>x.toUpperCase());if(['R','A','C','I'].every(x=>up.includes(x)))buildRaci(table);
    });
  }
  function tick(){try{ensureStyle();enhanceRich();enhanceGeneric()}catch(e){console.warn('[visual-matrices]',e)}}
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(tick,120)};
  const start=()=>{tick();const mo=new MutationObserver(schedule);mo.observe(document.body,{childList:true,subtree:true});window.addEventListener('allamo:data-changed',schedule);window.addEventListener('allamo:reports-changed',schedule)};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
