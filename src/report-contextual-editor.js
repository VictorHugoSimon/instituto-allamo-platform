(()=>{
  if(window.__allamoContextualReportEditor)return;
  window.__allamoContextualReportEditor=true;

  const STYLE_ID='allamo-contextual-report-editor-style';
  const NAV_ID='allamo-report-block-nav';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const sections=[
    { anchor:'sec-tap', label:'Escopo', needles:['pilares do projeto','termo de abertura','tap','visao geral e escopo'] },
    { anchor:'sec-kpis', label:'Indicadores', needles:['painel de situacao','indicadores','visao de escopo'] },
    { anchor:'sec-crono', label:'Fases & Marcos', needles:['cronograma sugerido','marcos e fases','fases e principais marcos','editar tarefas/fases','cronograma'] },
    { anchor:'sec-horas', label:'Horas', needles:['evolucao das horas','horas consumidas','horas'] },
    { anchor:'sec-curva', label:'Curva S', needles:['curva s'] },
    { anchor:'sec-cap', label:'Capacidade', needles:['capacidade'] },
    { anchor:'sec-golive', label:'Go-live', needles:['go-live','golive','hypercare'] },
    { anchor:'sec-riscos', label:'Riscos', needles:['matriz de riscos','riscos e alertas','riscos'] },
    { anchor:'sec-prox', label:'Próximos Passos', needles:['proximos passos'] }
  ];

  const css=`
#${NAV_ID}{position:sticky;top:0;z-index:12;display:flex;gap:7px;align-items:center;overflow-x:auto;padding:10px 2px 12px;margin:0 0 12px;background:linear-gradient(#fff 75%,rgba(255,255,255,.86));scrollbar-width:thin}
#${NAV_ID} button{flex:0 0 auto;border:1px solid #d7d2cd;background:#fff;color:#4d4844;border-radius:999px;padding:7px 10px;font:700 11px/1.2 inherit;cursor:pointer}
#${NAV_ID} button:hover,#${NAV_ID} button.on{background:#302f39;color:#fff;border-color:#302f39}
.allamo-report-editor-block,[data-allamo-report-block="1"]{position:relative;border:1px solid #e4e1dc!important;border-radius:14px!important;padding:16px!important;margin:14px 0!important;background:#fff!important;box-shadow:0 3px 12px rgba(48,47,57,.045);scroll-margin-top:92px}
.allamo-report-editor-block:before,[data-allamo-report-block="1"]:before{content:attr(data-allamo-block-label);display:block;margin:0 0 10px;color:#302f39;font-size:12px;font-weight:850;letter-spacing:.02em}
.allamo-report-target{outline:3px solid rgba(154,107,86,.22)!important;border-color:#9a6b56!important;box-shadow:0 0 0 5px rgba(154,107,86,.07),0 8px 22px rgba(48,47,57,.09)!important}
.allamo-report-target input:focus,.allamo-report-target textarea:focus,.allamo-report-target select:focus{outline:2px solid rgba(154,107,86,.22)!important;border-color:#9a6b56!important}
@media(max-width:760px){#${NAV_ID}{margin-left:-4px;margin-right:-4px}.allamo-report-editor-block,[data-allamo-report-block="1"]{padding:12px!important;margin:10px 0!important;border-radius:11px!important}}
`;

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
    const own=norm(button.innerText||button.textContent||'');
    if(/editar status report|editar report/.test(own))return '';
    if(/editar tarefas\/fases/.test(own))return 'sec-crono';
    const isPencil=(button.textContent||'').trim()==='✎'||norm(button.getAttribute('title'))==='editar';
    if(!isPencil)return null;
    const around=textAround(button);
    for(const s of sections){
      if(s.needles.some(n=>around.includes(norm(n))))return s.anchor;
    }
    return null;
  }

  function editorRoot(){
    const headings=[...document.querySelectorAll('h1,h2,h3,h4')].filter(visible);
    const h=headings.find(x=>/editar status report|editar report/i.test(norm(x.textContent||'')));
    if(!h)return null;
    return h.closest('[role="dialog"],.modal,.box,.report-modal,.modal-content')||h.parentElement?.parentElement||h.parentElement;
  }

  function blockFromHeading(h,root){
    if(!h)return null;
    let b=h.closest('[data-report-section],section,fieldset,.report-section,.form-section,.card,.panel');
    if(!b||b===root)b=h.parentElement;
    return b&&b!==root?b:null;
  }

  function findOrCreateBlock(section,root=editorRoot()){
    if(!section||!root)return null;
    let el=document.getElementById(section.anchor)||root.querySelector(`[data-report-anchor="${section.anchor}"]`);
    if(el&&!root.contains(el))el=null;
    if(!el){
      const candidates=[...root.querySelectorAll('h2,h3,h4,h5,legend,strong,b,.section-title,.form-section-title')];
      let heading=candidates.find(x=>{const t=norm(x.textContent||'');return t&&section.needles.some(n=>t.includes(norm(n)))});
      if(!heading){
        const fallback=[...root.querySelectorAll('label,div,span')].filter(x=>(x.children?.length||0)<4);
        heading=fallback.find(x=>{const t=norm(x.textContent||'');return t&&t.length<90&&section.needles.some(n=>t===norm(n)||t.startsWith(norm(n)))});
      }
      el=blockFromHeading(heading,root);
      if(el&&!el.id)el.id=section.anchor;
    }
    if(el){
      el.dataset.allamoReportBlock='1';
      el.dataset.allamoBlockLabel=section.label;
      el.classList.add('allamo-report-editor-block');
    }
    return el;
  }

  function decorateEditor(){
    ensureStyle();
    const root=editorRoot();
    if(!root)return null;
    const found=sections.map(s=>({s,el:findOrCreateBlock(s,root)})).filter(x=>x.el);
    if(found.length>=2&&!root.querySelector('#'+NAV_ID)){
      const nav=document.createElement('nav');nav.id=NAV_ID;nav.setAttribute('aria-label','Navegação rápida do Report');
      nav.innerHTML=found.map(x=>`<button type="button" data-anchor="${x.s.anchor}">${x.s.label}</button>`).join('');
      nav.addEventListener('click',e=>{const b=e.target.closest('button[data-anchor]');if(!b)return;focusAnchor(b.dataset.anchor,{smooth:true});});
      const heading=[...root.querySelectorAll('h1,h2,h3,h4')].find(x=>/editar status report|editar report/i.test(norm(x.textContent||'')));
      if(heading)heading.insertAdjacentElement('afterend',nav);else root.prepend(nav);
    }
    return root;
  }

  function resolveSection(anchor){
    if(!anchor)return null;
    return sections.find(s=>s.anchor===anchor)||sections.find(s=>s.needles.some(n=>norm(anchor).includes(norm(n))||norm(n).includes(norm(anchor))))||null;
  }

  function focusAnchor(anchor,{smooth=true}={}){
    const section=resolveSection(anchor);
    if(!section)return false;
    try{sessionStorage.setItem('allamo_contextual_report_anchor',section.anchor)}catch(_){}
    let tries=0;
    const tick=()=>{
      tries++;
      const root=decorateEditor();
      const el=root&&findOrCreateBlock(section,root);
      if(!el){if(tries<60)setTimeout(tick,45);return}
      const details=el.closest('details');if(details)details.open=true;
      root.querySelectorAll('.allamo-report-target').forEach(x=>x.classList.remove('allamo-report-target'));
      root.querySelectorAll(`#${NAV_ID} button`).forEach(x=>x.classList.toggle('on',x.dataset.anchor===section.anchor));
      el.classList.add('allamo-report-target');
      el.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start',inline:'nearest'});
      const field=el.querySelector('textarea:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),[contenteditable="true"]');
      if(field){setTimeout(()=>{try{field.focus({preventScroll:true});if(field.select&&field.tagName==='INPUT')field.select()}catch(_){}},smooth?260:30)}
      setTimeout(()=>el.classList.remove('allamo-report-target'),1800);
    };
    setTimeout(tick,30);
    return true;
  }

  function openBridge(anchor=''){
    const fn=window.__allamoOpenLegacyReportEditor;
    if(typeof fn!=='function')return false;
    try{
      try{sessionStorage.setItem('allamo_contextual_report_anchor',anchor||'')}catch(_){}
      fn(anchor||'');
      if(anchor)focusAnchor(anchor);else setTimeout(decorateEditor,50);
      return true;
    }catch(err){
      console.error('[report-contextual-editor] falha ao abrir editor pela ponte',err);
      return false;
    }
  }

  function sectionButton(anchor=''){
    const buttons=[...document.querySelectorAll('button')].filter(visible);
    if(!anchor)return buttons.find(b=>/editar status report|editar report/i.test((b.textContent||'').trim()))||null;
    return buttons.find(b=>anchorForButton(b)===anchor)||null;
  }

  function open(section=''){
    let anchor=section||'';
    if(section&&!String(section).startsWith('sec-')){
      const key=norm(section);
      const found=sections.find(s=>s.needles.some(n=>key.includes(norm(n))||norm(n).includes(key)));
      if(found)anchor=found.anchor;
    }
    if(openBridge(anchor))return true;
    const b=sectionButton(anchor);
    if(!b){console.warn('[report-contextual-editor] controle de edição não localizado',section);return false;}
    b.click();
    if(anchor)focusAnchor(anchor);else setTimeout(decorateEditor,50);
    return true;
  }

  // Fallback pós-unpack: cliques reconhecidos usam a ponte da instância real.
  document.addEventListener('click',e=>{
    const button=e.target&&e.target.closest?e.target.closest('button'):null;
    if(!button)return;
    const anchor=anchorForButton(button);
    if(anchor===null)return;
    if(typeof window.__allamoOpenLegacyReportEditor!=='function')return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    openBridge(anchor);
  },true);

  // Se o framework montar o modal em outro ciclo, aplica blocos sem polling agressivo.
  const observer=new MutationObserver(()=>{
    if(editorRoot())requestAnimationFrame(()=>{
      decorateEditor();
      let anchor='';try{anchor=sessionStorage.getItem('allamo_contextual_report_anchor')||''}catch(_){}
      if(anchor)focusAnchor(anchor,{smooth:false});
    });
  });
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('allamo:report-editor-open',e=>open((e&&e.detail&&e.detail.anchor)||''));
  window.AllamoContextualReportEditor={open,focus:focusAnchor,decorate:decorateEditor,anchorForButton};
})();
