(()=>{
  if(window.__allamoContextualReportEditor)return;
  window.__allamoContextualReportEditor=true;

  const STYLE_ID='allamo-contextual-report-editor-style';
  const NAV_ID='allamo-report-block-nav';
  const PENDING_KEY='allamo_contextual_report_anchor';
  const EDITABLE='textarea:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),[contenteditable="true"]';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  // Cada seção usa termos específicos do próprio editor. Evitamos termos genéricos
  // como "escopo" e "horas" sozinhos para não apontar várias abas para o mesmo bloco.
  const sections=[
    {anchor:'sec-tap',label:'Escopo',needles:['pilares do projeto','termo de abertura','visao geral e escopo','objetivo geral','escopo do projeto']},
    {anchor:'sec-kpis',label:'Indicadores',needles:['indicadores (escopo)','painel de situacao','indicadores de escopo','indicadores']},
    {anchor:'sec-crono',label:'Fases & Marcos',needles:['fases e principais marcos','marcos e fases','cronograma sugerido','editar tarefas/fases','cronograma de implantacao']},
    {anchor:'sec-horas',label:'Horas',needles:['evolucao das horas','horas consumidas','meta de horas/mes','meta de horas por mes','saldo de horas']},
    {anchor:'sec-curva',label:'Curva S',needles:['curva s','curva-s']},
    {anchor:'sec-cap',label:'Capacidade',needles:['capacidade do projeto','capacidade mensal','capacidade']},
    {anchor:'sec-golive',label:'Go-live',needles:['go-live','golive','hypercare','go live']},
    {anchor:'sec-riscos',label:'Riscos',needles:['matriz de riscos','riscos e alertas','riscos do projeto','riscos']},
    {anchor:'sec-prox',label:'Próximos Passos',needles:['proximos passos','proximas acoes','acoes seguintes']}
  ];

  const css=`
#${NAV_ID}{position:sticky;top:0;z-index:20;display:flex;gap:8px;overflow-x:auto;padding:10px 2px 12px;margin:0 0 12px;background:linear-gradient(#fff 76%,rgba(255,255,255,.90));scrollbar-width:thin}
#${NAV_ID} button{flex:0 0 auto;border:1px solid #d7d2cd;background:#fff;color:#4d4844;border-radius:999px;padding:8px 11px;font:700 12px/1.2 inherit;cursor:pointer;transition:.15s ease}
#${NAV_ID} button:hover,#${NAV_ID} button.on,#${NAV_ID} button[aria-selected="true"]{background:#302f39;color:#fff;border-color:#302f39;box-shadow:0 3px 10px rgba(48,47,57,.14)}
.allamo-report-editor-block{position:relative;border:1px solid #e4e1dc!important;border-radius:14px!important;padding:16px!important;margin:14px 0!important;background:#fff!important;box-shadow:0 3px 12px rgba(48,47,57,.045);scroll-margin-top:92px}
.allamo-report-landmark{scroll-margin-top:96px}
.allamo-report-target{outline:3px solid rgba(154,107,86,.22)!important;border-color:#9a6b56!important;box-shadow:0 0 0 5px rgba(154,107,86,.07),0 8px 22px rgba(48,47,57,.09)!important}
.allamo-report-field-target{outline:2px solid rgba(154,107,86,.25)!important;border-color:#9a6b56!important;box-shadow:0 0 0 4px rgba(154,107,86,.07)!important}
@media(max-width:760px){#${NAV_ID}{margin-left:-4px;margin-right:-4px}.allamo-report-editor-block{padding:12px!important;margin:10px 0!important;border-radius:11px!important}}
`;

  let decorating=false;
  let landmarkMap=new Map();

  function ensureStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;(document.head||document.documentElement).appendChild(s)}
    if(s.textContent!==css)s.textContent=css;
  }
  function visible(el){
    if(!el||!el.isConnected)return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0;
  }
  function textAround(el){
    let node=el,out='';
    for(let i=0;i<6&&node;i++,node=node.parentElement){
      const t=norm(node.innerText||node.textContent||'');
      if(t.length>out.length)out=t;
      if(t.length>1200)break;
    }
    return out;
  }
  function anchorForButton(button){
    if(!button)return null;
    if(button.closest('#'+NAV_ID))return null;
    const own=norm(button.innerText||button.textContent||'');
    if(/editar status report|editar report/.test(own))return '';
    if(/editar tarefas\/fases/.test(own))return 'sec-crono';
    const isPencil=(button.textContent||'').trim()==='✎'||norm(button.getAttribute('title'))==='editar';
    if(!isPencil)return null;
    const around=textAround(button);
    for(const s of sections)if(s.needles.some(n=>around.includes(norm(n))))return s.anchor;
    return null;
  }
  function editorRoot(){
    const hs=[...document.querySelectorAll('h1,h2,h3,h4')].filter(visible);
    const h=hs.find(x=>/editar status report|editar report/i.test(norm(x.textContent||'')));
    if(!h)return null;
    return h.closest('[role="dialog"],.modal,.box,.report-modal,.modal-content')||h.parentElement?.parentElement||h.parentElement;
  }
  function matchScore(el,section){
    if(!el||el.closest('#'+NAV_ID)||!visible(el))return -1;
    const t=norm(el.innerText||el.textContent||'');
    if(!t||t.length>180)return -1;
    let best=-1;
    for(const raw of section.needles){
      const n=norm(raw);if(!n)continue;
      if(t===n)best=Math.max(best,140);
      else if(t.startsWith(n)&&t.length<=n.length+55)best=Math.max(best,115);
      else if(t.includes(n)&&t.length<=n.length+80)best=Math.max(best,90);
    }
    if(best<0)return -1;
    if(/^H[2-5]$/.test(el.tagName)||el.tagName==='LEGEND')best+=28;
    if(['STRONG','B','LABEL'].includes(el.tagName))best+=18;
    if(/section-title|form-section-title|field-label/.test(String(el.className||'')))best+=22;
    if(el.querySelector&&el.querySelector(EDITABLE))best-=18;
    if((el.children?.length||0)>8)best-=15;
    return best;
  }
  function findLandmark(section,root=editorRoot()){
    if(!section||!root)return null;
    let existing=root.querySelector(`[data-allamo-report-landmark="${section.anchor}"]`);
    if(existing&&visible(existing))return existing;

    const primary=[...root.querySelectorAll('h2,h3,h4,h5,legend,strong,b,label,[data-report-section-title],.section-title,.form-section-title,.field-label')];
    const fallback=[...root.querySelectorAll('div,span,p')].filter(x=>(x.children?.length||0)<=3);
    let best=null,bestScore=-1;
    for(const el of primary.concat(fallback)){
      const score=matchScore(el,section);
      if(score>bestScore){best=el;bestScore=score}
    }
    if(!best)return null;
    best.dataset.allamoReportLandmark=section.anchor;
    best.classList.add('allamo-report-landmark');
    return best;
  }
  function cleanupBlocks(root){
    root.querySelectorAll('.allamo-report-editor-block').forEach(el=>{
      el.classList.remove('allamo-report-editor-block','allamo-report-target');
      delete el.dataset.allamoReportBlock;
      delete el.dataset.allamoBlockLabel;
    });
    root.querySelectorAll('.allamo-report-field-target').forEach(el=>el.classList.remove('allamo-report-field-target'));
  }
  function chooseDistinctBlock(landmark,root,allLandmarks,used){
    let node=landmark.parentElement;
    while(node&&node!==root){
      const controls=node.querySelectorAll?node.querySelectorAll(EDITABLE).length:0;
      const marks=allLandmarks.filter(x=>x&&node.contains(x)).length;
      const textLen=norm(node.innerText||node.textContent||'').length;
      if(controls>0&&marks===1&&textLen<5000&&!used.has(node))return node;
      node=node.parentElement;
    }
    const parent=landmark.parentElement;
    if(parent&&parent!==root&&!used.has(parent))return parent;
    return landmark;
  }
  function renderNav(root,entries){
    let nav=root.querySelector('#'+NAV_ID);
    if(!nav){
      nav=document.createElement('nav');
      nav.id=NAV_ID;
      nav.setAttribute('aria-label','Navegação rápida do Report');
      nav.setAttribute('role','tablist');
      const h=[...root.querySelectorAll('h1,h2,h3,h4')].find(x=>/editar status report|editar report/i.test(norm(x.textContent||'')));
      if(h)h.insertAdjacentElement('afterend',nav);else root.prepend(nav);
      nav.addEventListener('click',e=>{
        const b=e.target.closest('button[data-anchor]');
        if(!b)return;
        e.preventDefault();e.stopPropagation();
        focusAnchor(b.dataset.anchor,{smooth:true});
      });
    }
    const signature=entries.map(x=>x.section.anchor).join('|');
    if(nav.dataset.signature!==signature){
      nav.dataset.signature=signature;
      nav.innerHTML=entries.map(x=>`<button type="button" role="tab" aria-selected="false" data-anchor="${x.section.anchor}">${x.section.label}</button>`).join('');
    }
    const active=window.__allamoActiveReportAnchor||'';
    nav.querySelectorAll('button[data-anchor]').forEach(b=>{
      const on=b.dataset.anchor===active;
      b.classList.toggle('on',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
  }
  function decorateEditor(){
    if(decorating)return editorRoot();
    decorating=true;
    try{
      ensureStyle();
      const root=editorRoot();
      if(!root)return null;
      cleanupBlocks(root);

      const entries=sections.map(section=>({section,landmark:findLandmark(section,root)})).filter(x=>x.landmark);
      const allLandmarks=entries.map(x=>x.landmark);
      const used=new Set();
      landmarkMap=new Map();
      for(const entry of entries){
        const block=chooseDistinctBlock(entry.landmark,root,allLandmarks,used);
        if(block&&block!==entry.landmark){
          used.add(block);
          block.dataset.allamoReportBlock='1';
          block.dataset.allamoBlockLabel=entry.section.label;
          block.classList.add('allamo-report-editor-block');
        }
        entry.block=block||entry.landmark;
        landmarkMap.set(entry.section.anchor,entry);
      }
      if(entries.length>=2)renderNav(root,entries);
      return root;
    }finally{decorating=false}
  }
  function resolveSection(anchor){
    if(!anchor)return null;
    return sections.find(s=>s.anchor===anchor)||sections.find(s=>s.needles.some(n=>norm(anchor).includes(norm(n))||norm(n).includes(norm(anchor))))||null;
  }
  function follows(a,b){
    return !!(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));
  }
  function firstFieldFor(entry,root){
    if(!entry||!root)return null;
    if(entry.block&&entry.block!==entry.landmark){
      const inside=entry.block.querySelector(EDITABLE);
      if(inside&&visible(inside))return inside;
    }
    const ordered=[...landmarkMap.values()].map(x=>x.landmark).filter(Boolean);
    const next=ordered.filter(x=>x!==entry.landmark&&follows(entry.landmark,x)).sort((a,b)=>follows(a,b)?-1:1)[0]||null;
    const fields=[...root.querySelectorAll(EDITABLE)].filter(visible);
    return fields.find(f=>follows(entry.landmark,f)&&(!next||follows(f,next)))||fields.find(f=>follows(entry.landmark,f))||null;
  }
  function setPending(anchor){try{sessionStorage.setItem(PENDING_KEY,anchor||'')}catch(_){}}
  function clearPending(anchor){
    try{if((sessionStorage.getItem(PENDING_KEY)||'')===anchor)sessionStorage.removeItem(PENDING_KEY)}catch(_){}
  }
  function focusAnchor(anchor,{smooth=true}={}){
    const section=resolveSection(anchor);
    if(!section)return false;
    setPending(section.anchor);
    let tries=0;
    const tick=()=>{
      tries++;
      const root=decorateEditor();
      const entry=root&&landmarkMap.get(section.anchor);
      if(!entry||!entry.landmark){if(tries<80)setTimeout(tick,45);return}

      for(let d=entry.landmark.closest('details');d&&root.contains(d);d=d.parentElement?.closest?.('details'))d.open=true;
      root.querySelectorAll('.allamo-report-target').forEach(x=>x.classList.remove('allamo-report-target'));
      root.querySelectorAll('.allamo-report-field-target').forEach(x=>x.classList.remove('allamo-report-field-target'));
      window.__allamoActiveReportAnchor=section.anchor;
      root.querySelectorAll(`#${NAV_ID} button[data-anchor]`).forEach(b=>{
        const on=b.dataset.anchor===section.anchor;
        b.classList.toggle('on',on);
        b.setAttribute('aria-selected',on?'true':'false');
      });

      const target=entry.block||entry.landmark;
      target.classList.add('allamo-report-target');
      entry.landmark.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start',inline:'nearest'});
      const field=firstFieldFor(entry,root);
      if(field){
        field.classList.add('allamo-report-field-target');
        setTimeout(()=>{try{field.focus({preventScroll:true})}catch(_){}},smooth?280:40);
      }
      clearPending(section.anchor);
      setTimeout(()=>{target.classList.remove('allamo-report-target');if(field)field.classList.remove('allamo-report-field-target')},1900);
    };
    setTimeout(tick,30);
    return true;
  }
  function openBridge(anchor=''){
    const fn=window.__allamoOpenLegacyReportEditor;
    if(typeof fn!=='function')return false;
    try{
      setPending(anchor||'');
      fn(anchor||'');
      if(anchor)focusAnchor(anchor);else setTimeout(decorateEditor,50);
      return true;
    }catch(err){
      console.error('[report-contextual-editor] falha ao abrir editor pela ponte',err);
      return false;
    }
  }
  function sectionButton(anchor=''){
    const bs=[...document.querySelectorAll('button')].filter(visible);
    if(!anchor)return bs.find(b=>/editar status report|editar report/i.test((b.textContent||'').trim()))||null;
    return bs.find(b=>anchorForButton(b)===anchor)||null;
  }
  function open(section=''){
    let anchor=section||'';
    if(section&&!String(section).startsWith('sec-')){
      const key=norm(section),f=sections.find(s=>s.needles.some(n=>key.includes(norm(n))||norm(n).includes(key)));
      if(f)anchor=f.anchor;
    }
    if(openBridge(anchor))return true;
    const b=sectionButton(anchor);
    if(!b){console.warn('[report-contextual-editor] controle de edição não localizado',section);return false}
    b.click();
    if(anchor)focusAnchor(anchor);else setTimeout(decorateEditor,50);
    return true;
  }

  document.addEventListener('click',e=>{
    const button=e.target&&e.target.closest?e.target.closest('button'):null;
    if(!button||button.closest('#'+NAV_ID))return;
    const anchor=anchorForButton(button);
    if(anchor===null)return;
    if(typeof window.__allamoOpenLegacyReportEditor!=='function')return;
    e.preventDefault();e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    openBridge(anchor);
  },true);

  const observer=new MutationObserver(()=>{
    if(!editorRoot())return;
    requestAnimationFrame(()=>{
      decorateEditor();
      let anchor='';try{anchor=sessionStorage.getItem(PENDING_KEY)||''}catch(_){}
      if(anchor)focusAnchor(anchor,{smooth:false});
    });
  });
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('allamo:report-editor-open',e=>open((e&&e.detail&&e.detail.anchor)||''));

  window.AllamoContextualReportEditor={open};
  window.AllamoContextualReportEditor.focus=focusAnchor;
  window.AllamoContextualReportEditor.decorate=decorateEditor;
  window.AllamoContextualReportEditor.anchorForButton=anchorForButton;
  window.AllamoContextualReportEditor.findLandmark=findLandmark;
})();
