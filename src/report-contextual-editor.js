(()=>{
  if(window.__allamoContextualReportEditor)return;
  window.__allamoContextualReportEditor=true;

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const sections=[
    { anchor:'sec-tap', needles:['pilares do projeto','termo de abertura','tap'] },
    { anchor:'sec-kpis', needles:['painel de situacao','indicadores','visao de escopo'] },
    { anchor:'sec-crono', needles:['cronograma sugerido','marcos e fases','fases e principais marcos','editar tarefas/fases','cronograma'] },
    { anchor:'sec-horas', needles:['evolucao das horas','horas consumidas','horas'] },
    { anchor:'sec-curva', needles:['curva s'] },
    { anchor:'sec-cap', needles:['capacidade'] },
    { anchor:'sec-golive', needles:['go-live','golive','hypercare'] },
    { anchor:'sec-riscos', needles:['matriz de riscos','riscos e alertas','riscos'] },
    { anchor:'sec-prox', needles:['proximos passos'] }
  ];

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

  function openBridge(anchor=''){
    const fn=window.__allamoOpenLegacyReportEditor;
    if(typeof fn!=='function')return false;
    try{
      fn(anchor||'');
      try{sessionStorage.setItem('allamo_contextual_report_anchor',anchor||'')}catch(_){}
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
    return true;
  }

  // Fallback pós-unpack: o evento do framework pode se perder quando o DOM inteiro é substituído.
  // Quando a ponte da instância existe, assumimos somente cliques de edição do Status Report.
  document.addEventListener('click',e=>{
    const button=e.target&&e.target.closest?e.target.closest('button'):null;
    if(!button)return;
    const anchor=anchorForButton(button);
    if(anchor===null)return;
    if(typeof window.__allamoOpenLegacyReportEditor!=='function')return; // deixa o handler nativo tentar
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    openBridge(anchor);
  },true);

  window.addEventListener('allamo:report-editor-open',e=>open((e&&e.detail&&e.detail.anchor)||''));
  window.AllamoContextualReportEditor={open,anchorForButton};
})();
