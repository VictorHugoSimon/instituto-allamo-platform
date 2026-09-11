(()=>{
  if(window.__allamoPortfolioWorkDistributionLoaded)return;
  window.__allamoPortfolioWorkDistributionLoaded=true;

  const ACTIONABLE_TYPES=new Set(['DEMANDA','STORY','TASK','SUBTASK','BUG','INCIDENT','MELHORIA','AÇÃO','REQUISITO']);
  const COLORS={running:'#2f67a5',backlog:'#98a2b3',done:'#16865c',cancelled:'#b42318',other:'#7c3aed'};
  const LABELS={running:'Em andamento',backlog:'Backlog',done:'Completo',cancelled:'Cancelado',other:'Outros'};
  const ORDER=['running','backlog','done','cancelled','other'];
  let lastIssues=null,lastWork=null,lastRender=0,refreshing=false;

  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  function bucket(value){
    const s=norm(value);
    if(/cancel/.test(s))return'cancelled';
    if(/conclu|complet|\bdone\b|\bclosed\b|finaliz|resolvid/.test(s))return'done';
    if(/em andamento|in progress|\bdoing\b|desenvolv|code review|\breview\b|revis|\bqa\b|teste|homolog/.test(s))return'running';
    if(!s||/backlog|fila|prioriz|a fazer|to do|\btodo\b|pendente|aberto|\bopen\b|nao iniciado|planejad/.test(s))return'backlog';
    return'other';
  }
  function pct(n,total){return total?((n/total)*100).toFixed(1).replace('.',','):'0,0'}
  async function readApi(path){
    const res=await fetch('/api/'+path,{headers:{accept:'application/json'},cache:'no-store'});
    if(!res.ok)throw new Error(path+' HTTP '+res.status);
    const data=await res.json();
    if(!Array.isArray(data))throw new Error(path+' respondeu formato inesperado');
    return data;
  }
  function locate(){
    const h=Array.from(document.querySelectorAll('h2')).find(el=>el.textContent.trim()==='Distribuição do portfólio');
    if(!h)return null;
    const card=h.parentElement;if(!card)return null;
    const ring=Array.from(card.querySelectorAll('div')).find(el=>{
      const s=el.getAttribute('style')||'';
      return s.includes('width:180px')&&s.includes('height:180px')&&s.includes('border-radius:50%');
    });
    if(!ring||!ring.parentElement)return null;
    const subtitle=h.nextElementSibling&&h.nextElementSibling.tagName==='P'?h.nextElementSibling:null;
    const legend=Array.from(ring.parentElement.children).find(el=>el!==ring)||null;
    const center=ring.firstElementChild||null;
    return{card,ring,subtitle,legend,center};
  }
  function render(){
    const dom=locate();
    if(!dom)return false;
    if(lastIssues===null&&lastWork===null)return false;

    const issues=Array.isArray(lastIssues)?lastIssues:[];
    const allWork=Array.isArray(lastWork)?lastWork:[];
    const work=allWork.filter(item=>ACTIONABLE_TYPES.has(String(item.item_type||'').toUpperCase()));
    const counts={running:0,backlog:0,done:0,cancelled:0,other:0};
    for(const item of issues)counts[bucket(item.status)]++;
    for(const item of work)counts[bucket(item.status)]++;
    const total=ORDER.reduce((sum,key)=>sum+counts[key],0);

    const active=ORDER.filter(key=>counts[key]>0);
    if(!total){
      dom.ring.style.background='#e5e7eb';
    }else{
      let cursor=0;const parts=[];
      for(const key of active){
        const start=cursor;cursor+=(counts[key]/total)*360;
        parts.push(`${COLORS[key]} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`);
      }
      dom.ring.style.background=`conic-gradient(${parts.join(',')})`;
    }

    if(dom.center){
      dom.center.textContent='';
      const wrap=document.createElement('div');wrap.style.textAlign='center';
      const n=document.createElement('div');n.textContent=String(total);n.style.fontWeight='900';n.style.fontSize='18px';n.style.color='#302f39';
      const label=document.createElement('span');label.textContent='itens';label.style.fontSize='11px';label.style.fontWeight='700';label.style.color='#64748b';
      wrap.append(n,label);dom.center.appendChild(wrap);
    }

    if(dom.legend){
      dom.legend.textContent='';dom.legend.style.display='grid';dom.legend.style.gap='10px';
      for(const key of ORDER){
        if(key==='other'&&counts[key]===0)continue;
        const row=document.createElement('div');row.style.display='flex';row.style.alignItems='center';row.style.gap='9px';row.style.fontSize='14px';row.style.color='#10233b';
        const swatch=document.createElement('span');swatch.style.width='12px';swatch.style.height='12px';swatch.style.borderRadius='3px';swatch.style.background=COLORS[key];swatch.style.flex='0 0 auto';
        const text=document.createElement('span');text.textContent=`${counts[key]} ${LABELS[key]} — ${pct(counts[key],total)}%`;
        row.append(swatch,text);dom.legend.appendChild(row);
      }
    }

    if(dom.subtitle){
      const partial=(lastIssues===null||lastWork===null)?' · fonte parcial':'';
      dom.subtitle.textContent=`Status de demandas e tarefas · ${issues.length} demandas · ${work.length} itens de trabalho${partial}`;
    }
    lastRender=Date.now();
    return true;
  }
  async function refresh(force=false){
    if(refreshing)return;
    if(!force&&Date.now()-lastRender<10000){render();return}
    refreshing=true;
    const [issuesResult,workResult]=await Promise.allSettled([readApi('issues'),readApi('work-items')]);
    if(issuesResult.status==='fulfilled')lastIssues=issuesResult.value;
    if(workResult.status==='fulfilled')lastWork=workResult.value;
    render();refreshing=false;
  }

  const observer=new MutationObserver(()=>{if(locate())render()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('focus',()=>refresh(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
  setInterval(()=>refresh(false),30000);
  setTimeout(()=>refresh(true),250);
})();
