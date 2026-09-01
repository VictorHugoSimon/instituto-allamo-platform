(()=>{
  if(window.__allamoReportCreateButtonRouterLoaded)return;
  window.__allamoReportCreateButtonRouterLoaded=true;

  const CREATE_TITLE='Criar Status Report · Template oficial do cliente';
  const context=()=>{
    const c=window.__allamoReportContext||{};
    return {
      company:document.querySelector('#arm [data-f="company"]')?.value||c.company||'',
      project:document.querySelector('#arm [data-f="project"]')?.value||c.project||''
    };
  };
  const feedback=msg=>{
    if(window.AllamoActionFeedback){window.AllamoActionFeedback(msg);return;}
    let x=document.getElementById('allamo-action-feedback');
    if(!x){x=document.createElement('div');x.id='allamo-action-feedback';x.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#302f39;color:#fff;border-radius:10px;padding:10px 14px;font:700 12px/1.35 Inter,Arial,sans-serif;box-shadow:0 8px 28px #0004';document.body.appendChild(x)}
    x.textContent=msg;x.style.opacity='1';clearTimeout(x._t);x._t=setTimeout(()=>{x.style.opacity='0'},2600);
  };

  const ensureGuardStyle=()=>{
    if(document.getElementById('allamo-report-create-modal-guard'))return;
    const s=document.createElement('style');
    s.id='allamo-report-create-modal-guard';
    s.textContent=`
      body>[data-allamo-report-create-modal="1"]{
        position:fixed!important;inset:0!important;z-index:2147483000!important;
        display:flex!important;visibility:visible!important;opacity:1!important;
        pointer-events:auto!important;align-items:center!important;justify-content:center!important;
        background:rgba(0,0,0,.60)!important;padding:12px!important;overflow:hidden!important;
        transform:none!important;clip:auto!important;filter:none!important;
      }
      body>[data-allamo-report-create-modal="1"]>.arc-box{
        box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;
        visibility:visible!important;opacity:1!important;min-width:0!important;
        width:min(1180px,calc(100vw - 24px))!important;height:min(96dvh,980px)!important;
        max-width:1180px!important;max-height:calc(100dvh - 24px)!important;
        overflow:hidden!important;background:#f6f5f2!important;border-radius:16px!important;
        position:relative!important;z-index:1!important;transform:none!important;
      }
      body>[data-allamo-report-create-modal="1"]>.arc-box>.arc-head{
        box-sizing:border-box!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;
        display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;
      }
      body>[data-allamo-report-create-modal="1"]>.arc-box>.arc-head>.grow{
        flex:1 1 320px!important;min-width:220px!important;
      }
      body>[data-allamo-report-create-modal="1"]>.arc-box>.arc-body{
        box-sizing:border-box!important;flex:1 1 auto!important;min-height:0!important;min-width:0!important;
        width:100%!important;overflow-y:auto!important;overflow-x:hidden!important;padding:14px!important;
        overscroll-behavior:contain!important;
      }
      body>[data-allamo-report-create-modal="1"] .arc-meta{
        box-sizing:border-box!important;display:grid!important;
        grid-template-columns:minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1.5fr) minmax(0,1fr)!important;
        gap:9px!important;width:100%!important;min-width:0!important;align-items:start!important;
      }
      body>[data-allamo-report-create-modal="1"] .arc-tabs{
        box-sizing:border-box!important;display:flex!important;flex-wrap:nowrap!important;
        width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;
        -webkit-overflow-scrolling:touch!important;
      }
      body>[data-allamo-report-create-modal="1"] .arc-panel{
        box-sizing:border-box!important;width:100%!important;min-width:0!important;
      }
      body>[data-allamo-report-create-modal="1"] .arc-panel.on{display:block!important}
      body>[data-allamo-report-create-modal="1"] .arc-grid{
        box-sizing:border-box!important;display:grid!important;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
        gap:10px!important;width:100%!important;min-width:0!important;
      }
      body>[data-allamo-report-create-modal="1"] label,
      body>[data-allamo-report-create-modal="1"] input,
      body>[data-allamo-report-create-modal="1"] select,
      body>[data-allamo-report-create-modal="1"] textarea{
        box-sizing:border-box!important;min-width:0!important;max-width:100%!important;
      }
      body>[data-allamo-report-create-modal="1"] input,
      body>[data-allamo-report-create-modal="1"] select,
      body>[data-allamo-report-create-modal="1"] textarea{width:100%!important}
      body>[data-allamo-report-create-modal="1"] textarea{resize:vertical!important}
      @media(max-width:960px){
        body>[data-allamo-report-create-modal="1"] .arc-meta{
          grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
        }
      }
      @media(max-width:800px){
        body>[data-allamo-report-create-modal="1"]{padding:0!important;align-items:stretch!important}
        body>[data-allamo-report-create-modal="1"]>.arc-box{
          width:100vw!important;height:100dvh!important;max-width:100vw!important;max-height:100dvh!important;border-radius:0!important;
        }
        body>[data-allamo-report-create-modal="1"]>.arc-box>.arc-head>.grow{flex:1 1 100%!important;min-width:0!important}
        body>[data-allamo-report-create-modal="1"]>.arc-box>.arc-body{padding:10px!important}
        body>[data-allamo-report-create-modal="1"] .arc-meta,
        body>[data-allamo-report-create-modal="1"] .arc-grid{grid-template-columns:minmax(0,1fr)!important}
      }
    `;
    (document.head||document.documentElement).appendChild(s);
  };

  const isCreateModal=el=>{
    if(!el||el.nodeType!==1)return false;
    if(el.getAttribute?.('data-allamo-report-create-modal')==='1')return true;
    const box=el.querySelector?.('.arc-box');
    if(!box)return false;
    const text=String(box.textContent||'');
    return text.includes(CREATE_TITLE);
  };
  const findCreateModal=()=>{
    const marked=document.querySelector('body>[data-allamo-report-create-modal="1"]');
    if(marked)return marked;
    const nodes=[...(document.body?.children||[])].reverse();
    return nodes.find(isCreateModal)||null;
  };
  const forceVisible=modal=>{
    if(!modal)return null;
    ensureGuardStyle();
    modal.setAttribute('data-allamo-report-create-modal','1');
    const set=(k,v)=>modal.style.setProperty(k,v,'important');
    set('position','fixed');set('inset','0');set('z-index','2147483000');set('display','flex');
    set('visibility','visible');set('opacity','1');set('pointer-events','auto');set('align-items','center');
    set('justify-content','center');set('background','rgba(0,0,0,.60)');set('transform','none');set('clip','auto');
    const box=modal.querySelector('.arc-box');
    if(box){
      const b=(k,v)=>box.style.setProperty(k,v,'important');
      b('display','flex');b('flex-direction','column');b('align-items','stretch');b('visibility','visible');b('opacity','1');
      b('min-width','0');b('position','relative');b('z-index','1');b('transform','none');b('overflow','hidden');
    }
    return modal;
  };

  ensureGuardStyle();
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.addedNodes||[]){
        if(isCreateModal(node)){forceVisible(node);return}
        const nested=node?.querySelectorAll?.('.arc-box')||[];
        for(const box of nested){
          const root=box.parentElement;
          if(isCreateModal(root)){forceVisible(root);return}
        }
      }
    }
  });
  if(document.body)observer.observe(document.body,{childList:true});
  else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true}),{once:true});

  const prefill=(companyId,projectId)=>{
    let attempt=0;
    const apply=()=>{
      const company=document.querySelector('#arc-company');
      const project=document.querySelector('#arc-project');
      if(!company){if(attempt++<40)setTimeout(apply,100);return;}
      if(companyId){
        company.value=String(companyId);
        company.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(project&&projectId){
        project.value=String(projectId);
        project.dispatchEvent(new Event('change',{bubbles:true}));
      }
    };
    apply();
  };
  const timeout=(promise,ms)=>Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('O template de criação não respondeu em '+Math.round(ms/1000)+' segundos.')),ms))
  ]);
  const open=async()=>{
    const ctx=context();
    const creator=window.AllamoOfficialReportCreate;
    if(!creator?.open){
      console.error('[report-create] Criador oficial não carregado.');
      feedback('Não foi possível carregar o criador de Report. Atualize a página.');
      return;
    }
    const stale=findCreateModal();
    if(stale)stale.remove();
    feedback('Abrindo criação de Report…');
    try{
      await timeout(creator.open(),12000);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const modal=forceVisible(findCreateModal());
      if(!modal)throw new Error('O template oficial não foi montado na tela.');
      prefill(ctx.company,ctx.project);
      feedback('Template de Report aberto.');
    }catch(err){
      console.error('[report-create] falha ao abrir',err);
      const msg=String(err?.message||err||'Falha desconhecida');
      feedback('Não foi possível abrir o Report: '+msg);
    }
  };

  // Window + capture garante prioridade sobre os handlers legados registrados no document/#arm.
  window.addEventListener('click',e=>{
    const button=e.target?.closest?.('#arm [data-a="new-report"],[data-allamo-create-report="1"]');
    if(!button)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  },true);

  window.AllamoCreateReportButton={open,findCreateModal,forceVisible};
})();
