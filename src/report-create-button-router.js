(()=>{
  if(window.__allamoReportCreateButtonRouterLoaded)return;
  window.__allamoReportCreateButtonRouterLoaded=true;

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
    x.textContent=msg;x.style.opacity='1';clearTimeout(x._t);x._t=setTimeout(()=>{x.style.opacity='0'},1800);
  };
  const prefill=(companyId,projectId)=>{
    let attempt=0;
    const apply=()=>{
      const company=document.querySelector('#arc-company');
      const project=document.querySelector('#arc-project');
      if(!company){if(attempt++<30)setTimeout(apply,100);return;}
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
  const open=async()=>{
    const ctx=context();
    const creator=window.AllamoOfficialReportCreate;
    if(!creator?.open){
      console.error('[report-create] Criador oficial não carregado.');
      feedback('Não foi possível carregar o criador de Report. Atualize a página.');
      return;
    }
    feedback('Abrindo criação de Report…');
    try{
      await creator.open();
      prefill(ctx.company,ctx.project);
    }catch(err){
      console.error('[report-create] falha ao abrir',err);
      feedback('Erro ao abrir a criação de Report. Tente novamente.');
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

  window.AllamoCreateReportButton={open};
})();
