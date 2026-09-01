(()=>{
  if(window.__allamoInteractionFeedbackLoaded)return;
  window.__allamoInteractionFeedbackLoaded=true;

  const API_PREFIX='/api/';
  const pending=new Map();
  let seq=0;
  let lastActionButton=null;
  let hud=null;
  let ticker=null;

  function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
  function isWrite(method){return !['GET','HEAD','OPTIONS'].includes(String(method||'GET').toUpperCase())}

  function ensureStyle(){
    if(document.getElementById('allamo-operation-style'))return;
    const s=document.createElement('style');
    s.id='allamo-operation-style';
    s.textContent=`
      @keyframes allamoSpin{to{transform:rotate(360deg)}}
      #allamo-operation-hud{position:fixed;left:50%;top:18px;transform:translateX(-50%) translateY(-8px);z-index:2147483000;min-width:min(420px,calc(100vw - 28px));max-width:min(620px,calc(100vw - 28px));display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid rgba(255,255,255,.16);border-radius:13px;background:#302f39;color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.22);font:700 12px/1.35 Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;opacity:0;visibility:hidden;transition:opacity .18s ease,transform .18s ease;pointer-events:none}
      #allamo-operation-hud[data-show="1"]{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
      #allamo-operation-hud .allamo-op-spin{width:18px;height:18px;flex:0 0 18px;border:2px solid rgba(255,255,255,.28);border-top-color:#fff;border-radius:50%;animation:allamoSpin .75s linear infinite}
      #allamo-operation-hud .allamo-op-copy{min-width:0;flex:1}
      #allamo-operation-hud .allamo-op-title{font-size:12.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #allamo-operation-hud .allamo-op-detail{margin-top:2px;color:#ddd9d5;font-size:10.5px;font-weight:650}
      button[data-allamo-processing="1"],a[data-allamo-processing="1"]{cursor:wait!important;opacity:.78!important}
      button[data-allamo-processing="1"]::after,a[data-allamo-processing="1"]::after{content:"";display:inline-block;width:11px;height:11px;margin-left:7px;vertical-align:-1px;border:1.7px solid currentColor;border-right-color:transparent;border-radius:50%;animation:allamoSpin .7s linear infinite}
    `;
    document.head.appendChild(s);
  }

  function ensureHud(){
    ensureStyle();
    if(hud&&hud.isConnected)return hud;
    hud=document.createElement('div');
    hud.id='allamo-operation-hud';
    hud.setAttribute('role','status');
    hud.setAttribute('aria-live','polite');
    hud.setAttribute('aria-atomic','true');
    hud.innerHTML='<span class="allamo-op-spin" aria-hidden="true"></span><div class="allamo-op-copy"><div class="allamo-op-title">Processando…</div><div class="allamo-op-detail">Aguarde a conclusão da operação.</div></div>';
    (document.body||document.documentElement).appendChild(hud);
    return hud;
  }

  function toast(msg,kind='info'){
    let x=document.getElementById('allamo-global-toast');
    if(!x){
      x=document.createElement('div');x.id='allamo-global-toast';x.setAttribute('role','status');x.setAttribute('aria-live','polite');
      x.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483001;max-width:min(390px,calc(100vw - 36px));border-radius:11px;padding:11px 14px;color:#fff;font:750 12px/1.4 Inter,Arial,sans-serif;box-shadow:0 10px 32px #0004;transition:.2s;pointer-events:none';
      (document.body||document.documentElement).appendChild(x);
    }
    x.style.background=kind==='ok'?'#027a48':kind==='error'?'#b42318':'#302f39';
    x.textContent=msg;x.style.opacity='1';clearTimeout(x._t);x._t=setTimeout(()=>{x.style.opacity='0'},2600);
  }

  function visibleOps(){return [...pending.values()].filter(o=>o.visible)}
  function render(){
    const el=ensureHud();
    const ops=visibleOps();
    document.documentElement.setAttribute('aria-busy',pending.size?'true':'false');
    if(!ops.length){el.dataset.show='0';return}
    const current=ops[ops.length-1];
    const elapsed=Date.now()-current.startedAt;
    let detail='Aguarde a conclusão da operação.';
    if(pending.size>1)detail=`${pending.size} operações em andamento.`;
    else if(elapsed>12000)detail='A operação continua em andamento. Não feche esta página.';
    else if(elapsed>5000)detail='Ainda processando. Você pode continuar aguardando.';
    el.querySelector('.allamo-op-title').textContent=current.label||'Processando…';
    el.querySelector('.allamo-op-detail').textContent=detail;
    el.dataset.show='1';
  }

  function bindButton(op){
    const c=lastActionButton;
    if(!c||Date.now()-c.at>1500||!c.el?.isConnected)return;
    const b=c.el;
    op.button=b;
    op.buttonWasDisabled=!!b.disabled;
    b.dataset.allamoProcessing='1';
    b.setAttribute('aria-busy','true');
    if('disabled' in b)b.disabled=true;
    lastActionButton=null;
  }

  function releaseButton(op){
    const b=op&&op.button;
    if(!b||!b.isConnected)return;
    delete b.dataset.allamoProcessing;
    b.removeAttribute('aria-busy');
    if('disabled' in b)b.disabled=!!op.buttonWasDisabled;
  }

  function start(label,opts={}){
    const id='op-'+Date.now().toString(36)+'-'+(++seq).toString(36);
    const op={id,label:label||'Processando…',startedAt:Date.now(),visible:false,timer:null,button:null,buttonWasDisabled:false,kind:opts.kind||'generic'};
    pending.set(id,op);
    bindButton(op);
    const delay=Math.max(0,Number(opts.delay??0));
    op.timer=setTimeout(()=>{if(!pending.has(id))return;op.visible=true;render()},delay);
    if(!ticker)ticker=setInterval(()=>{if(pending.size)render();else{clearInterval(ticker);ticker=null}},1000);
    render();
    return id;
  }

  function finish(id,opts={}){
    const op=pending.get(id);if(!op)return;
    clearTimeout(op.timer);pending.delete(id);releaseButton(op);render();
    if(opts.ok===false&&opts.error)toast(opts.error,'error');
    else if(opts.ok!==false&&opts.success)toast(opts.success,'ok');
  }

  function requestInfo(url,method){
    const p=url.pathname.replace(/^\/api\//,'');
    const m=String(method||'GET').toUpperCase();
    const write=isWrite(m);
    let label=write?'Processando alteração…':'Carregando dados atualizados…';
    let success=write?'Alteração concluída.':'';

    if(/^login(?:\/|$)/.test(p)){label='Entrando no portal…';success='Login realizado.'}
    else if(/report-ai/.test(p)){label='Gerando Status Report com IA…';success='Análise da IA concluída.'}
    else if(/doc-upload|tenant-files|milestone.*(?:file|asset|evidence)|upload/.test(p)){label='Enviando arquivo…';success='Arquivo enviado.'}
    else if(/public-update/.test(p)){label='Enviando atualização…';success='Atualização enviada.'}
    else if(/report/.test(p)&&/publish|publicar/.test(p)){label='Publicando Report…';success='Report publicado.'}
    else if(/report/.test(p)&&write){label='Salvando Status Report…';success='Report salvo.'}
    else if(/linear-sync/.test(p)){label='Sincronizando Linear…';success='Sincronização do Linear concluída.'}
    else if(/horas-sync/.test(p)){label='Sincronizando horas…';success='Sincronização de horas concluída.'}
    else if(/company-create|companies/.test(p)&&write){label='Salvando empresa…';success='Empresa salva.'}
    else if(/projects/.test(p)&&write){label=m==='DELETE'?'Excluindo projeto…':'Salvando projeto…';success=m==='DELETE'?'Projeto excluído.':'Projeto salvo.'}
    else if(/users/.test(p)&&write){label=m==='DELETE'?'Excluindo usuário…':'Salvando usuário…';success=m==='DELETE'?'Usuário excluído.':'Usuário salvo.'}
    else if(/gmud/.test(p)&&write){label='Salvando GMUD…';success='GMUD salva.'}
    else if(/releases/.test(p)&&write){label='Registrando virada / versão…';success='Virada / versão registrada.'}
    else if(/work/.test(p)&&write){label='Salvando demanda / tarefa…';success='Demanda / tarefa salva.'}
    else if(/plan/.test(p)&&write){label='Salvando etapa…';success='Etapa salva.'}
    else if(m==='DELETE'){label='Excluindo registro…';success='Registro excluído.'}

    return {label,success,write,delay:write?0:500};
  }

  const previousFetch=window.fetch.bind(window);
  window.fetch=function(input,init={}){
    const raw=String((input&&input.url)||input||'');
    let url;try{url=new URL(raw,location.href)}catch(_){return previousFetch(input,init)}
    if(url.origin!==location.origin||!url.pathname.startsWith(API_PREFIX))return previousFetch(input,init);
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    const info=requestInfo(url,method);
    const opId=start(info.label,{delay:info.delay,kind:info.write?'write':'read'});
    return previousFetch(input,init).then(res=>{
      finish(opId,{ok:res.ok,success:info.write&&res.ok?info.success:'',error:info.write&&!res.ok?`Não foi possível concluir a operação (HTTP ${res.status}).`:''});
      return res;
    }).catch(err=>{
      finish(opId,{ok:false,error:info.write?'Não foi possível concluir a operação. Verifique a conexão e tente novamente.':''});
      throw err;
    });
  };

  const ACTION_RE=/(salvar|publicar|enviar|gerar|sincronizar|atualizar|excluir|registrar|aprovar|reprovar|concluir|entrar|importar|exportar|processar)/i;
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('button,a[role="button"]');if(!b)return;
    if(ACTION_RE.test(norm(b.textContent)))lastActionButton={el:b,at:Date.now()};
  },true);

  document.addEventListener('change',e=>{
    const input=e.target;
    if(!(input instanceof HTMLInputElement)||String(input.type).toLowerCase()!=='file'||!input.files?.length)return;
    const id=start('Preparando arquivo para envio…',{delay:120,kind:'file'});
    setTimeout(()=>finish(id),900);
  },true);

  window.AllamoToast=toast;
  window.AllamoOperation={start,finish,toast,pending:()=>pending.size};
})();
