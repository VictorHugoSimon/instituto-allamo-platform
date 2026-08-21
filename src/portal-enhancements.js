(()=>{
  const token=()=>{
    try{const s=JSON.parse(localStorage.getItem('allamo_session')||'null');if(s&&s.token)return s.token}catch(e){}
    return localStorage.getItem('allamo_session_token')||localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||'';
  };
  const api=async p=>{const t=token();if(!t)throw new Error('Sem sessão');const r=await fetch('/api/'+p,{headers:{authorization:'Bearer '+t},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()};
  const exact=(txt)=>Array.from(document.querySelectorAll('button,a,div,span,p')).filter(e=>e.children.length===0&&e.textContent.trim()===txt);
  let refreshAt=0,loading=false;

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

  function setCard(label,value,note){
    const labels=exact(label).filter(e=>{const r=e.getBoundingClientRect();return r.left>250&&r.top>130&&r.top<560});
    const l=labels[0];if(!l)return;
    let card=l;
    for(let i=0;i<7&&card.parentElement;i++){
      const r=card.getBoundingClientRect();if(r.width>=130&&r.width<=320&&r.height>=80&&r.height<=230)break;card=card.parentElement;
    }
    const leaves=Array.from(card.querySelectorAll('*')).filter(e=>e.children.length===0);
    const n=leaves.find(e=>/^\s*\d+\s*$/.test(e.textContent));if(n)n.textContent=String(value);
    if(note){const sub=leaves.find(e=>e!==l&&e!==n&&/portf|projeto|demanda|empresa|cadastr|registr/i.test(e.textContent));if(sub)sub.textContent=note}
  }

  function updateDistribution(projects){
    const h=Array.from(document.querySelectorAll('h2')).find(e=>e.textContent.trim()==='Distribuição do portfólio');if(!h)return;
    const panel=h.parentElement;if(!panel)return;
    const counts={started:0,backlog:0,completed:0,canceled:0};
    projects.forEach(p=>{const b=String(p.badge||'').toLowerCase(),s=String(p.status||'').toLowerCase();if(b==='started'||s==='em andamento')counts.started++;else if(b==='completed'||s==='completo')counts.completed++;else if(b==='canceled'||s==='cancelado')counts.canceled++;else counts.backlog++});
    const total=projects.length;
    const center=Array.from(panel.querySelectorAll('div')).find(d=>d.querySelector('span')&&/projetos/i.test(d.textContent)&&/^\s*\d+/.test(d.textContent.trim()));
    if(center){const text=Array.from(center.childNodes).find(n=>n.nodeType===3);if(text)text.nodeValue=String(total);const sp=center.querySelector('span');if(sp)sp.textContent='projetos'}
    const donut=Array.from(panel.querySelectorAll('div')).find(d=>(d.style.borderRadius==='50%'||getComputedStyle(d).borderRadius==='50%')&&d.style.background.includes('conic-gradient'));
    if(donut){if(!total)donut.style.background='#e5e7eb';else{const a=counts.started/total*100,b=a+counts.backlog/total*100,c=b+counts.completed/total*100;donut.style.background=`conic-gradient(#2f67a5 0 ${a}%,#98a2b3 ${a}% ${b}%,#16865c ${b}% ${c}%,#b42318 ${c}% 100%)`}}
    const map=[['Em andamento',counts.started],['Backlog',counts.backlog],['Completo',counts.completed],['Cancelado',counts.canceled]];
    for(const [name,count] of map){const el=Array.from(panel.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.includes(name)&&e.textContent.includes('—'));if(el){const pct=total?((count/total)*100).toFixed(1).replace('.',','):'0,0';el.textContent=`${count} ${name} — ${pct}%`}}
  }

  function clearLegacyFindings(totalProjects,totalWork){
    const h=Array.from(document.querySelectorAll('h2')).find(e=>e.textContent.trim()==='Principais achados PMO');if(!h)return;
    const panel=h.parentElement;if(!panel||panel.dataset.allamoLiveFindings==='1')return;
    panel.dataset.allamoLiveFindings='1';
    const p=panel.querySelector('p');
    Array.from(panel.children).forEach((c,i)=>{if(c!==h&&c!==p)c.remove()});
    const d=document.createElement('div');d.style.cssText='margin-top:18px;padding:18px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;background:#fafafa';
    d.textContent=(totalProjects===0&&totalWork===0)?'Nenhum achado PMO: a carteira está vazia.':'Achados automáticos serão calculados somente a partir dos dados reais cadastrados.';
    panel.appendChild(d);
  }

  async function executiveSync(){
    if(!token())return;const now=Date.now();if(loading||now-refreshAt<2500)return;refreshAt=now;loading=true;
    try{
      const [companies,projects,work]=await Promise.all([api('companies'),api('projects'),api('work-items')]);
      const cs=Array.isArray(companies)?companies:[],ps=Array.isArray(projects)?projects:[],ws=Array.isArray(work)?work:[];
      const started=ps.filter(p=>p.badge==='started'||p.status==='Em andamento').length;
      const backlog=ps.filter(p=>p.badge==='backlog'||p.status==='Backlog').length;
      const complete=ps.filter(p=>p.badge==='completed'||p.status==='Completo').length;
      const canceled=ps.filter(p=>p.badge==='canceled'||p.status==='Cancelado').length;
      setCard('Empresas',cs.length,'empresas cadastradas');setCard('Projetos',ps.length,'portfólio atual');setCard('Demandas',ws.filter(i=>i.item_type==='DEMANDA').length,'demandas ativas');setCard('Em andamento',started,'projetos');setCard('Backlog',backlog,'projetos');setCard('Completo',complete,'projetos');setCard('Cancelado',canceled,'projetos');
      updateDistribution(ps);clearLegacyFindings(ps.length,ws.length);
    }catch(e){console.error('[executive-sync]',e)}finally{loading=false}
  }

  function tick(){workMenu();executiveSync()}
  const obs=new MutationObserver(()=>tick());
  const start=()=>{obs.observe(document.documentElement,{subtree:true,childList:true});tick();setInterval(tick,1500)};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
