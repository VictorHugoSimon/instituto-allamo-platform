(()=>{
  if(window.__allamoContextualReportEditor)return;
  window.__allamoContextualReportEditor=true;

  // Compatibilidade: o editor contextual NÃO captura mais cliques do Portal.
  // Os botões/lápis nativos já possuem handlers próprios e precisam receber o evento original.
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const map={
    pillars:['pilares do projeto'],
    semaphores:['painel de situacao'],
    phases:['marcos e fases','fases e principais marcos','editar tarefas/fases'],
    raci:['matriz raci'],
    tracks:['frentes de trabalho'],
    risks:['matriz de riscos','riscos e alertas'],
    next:['proximos passos'],
    methodology:['metodologia de implantacao','metodologia (fases)']
  };

  function visible(el){
    if(!el||!el.isConnected)return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0;
  }

  function sectionButton(section){
    const needles=map[section]||[];
    const buttons=[...document.querySelectorAll('button')].filter(visible);
    if(!section){
      return buttons.find(b=>/editar report/i.test((b.textContent||'').trim()))||null;
    }
    return buttons.find(b=>{
      const text=(b.textContent||'').trim();
      if(text!=='✎'&&!/editar tarefas\/fases/i.test(text))return false;
      let node=b;
      for(let i=0;i<5&&node;i++,node=node.parentElement){
        const t=norm(node.innerText||node.textContent||'');
        if(needles.some(n=>t.includes(norm(n))))return true;
      }
      return false;
    })||null;
  }

  function open(section=''){
    const b=sectionButton(section);
    if(!b){
      console.warn('[report-contextual-editor] controle nativo não localizado',section);
      return false;
    }
    // Não há listener global/capture aqui; o clique chega diretamente ao handler nativo do Portal.
    b.click();
    return true;
  }

  window.AllamoContextualReportEditor={open};
})();
