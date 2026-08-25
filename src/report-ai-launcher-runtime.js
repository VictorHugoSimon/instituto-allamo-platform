(()=>{
  if(window.__allamoReportAiLauncherLoaded)return;
  window.__allamoReportAiLauncherLoaded=true;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=()=>{try{const s=JSON.parse(localStorage.getItem('allamo_session')||'null');if(s?.token)return s.token}catch(_){}return localStorage.getItem('allamo_session_token')||localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||''};
  let lastQuery='';

  function queryFromApi(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      if(!raw)return '';
      const u=new URL(raw,location.href);
      if(u.origin!==location.origin||u.pathname!=='/api/report')return '';
      const p=u.searchParams.get('project'),c=u.searchParams.get('company');
      if(p)return 'project='+encodeURIComponent(p);
      if(c)return 'company='+encodeURIComponent(c);
    }catch(_){}
    return '';
  }
  function rememberQuery(q){
    if(!q)return '';
    lastQuery=q;
    window.__allamoReportAiCurrentQuery=q;
    try{window.__allamoLegacyReportAiSetQuery?.(q)}catch(_){}
    return q;
  }

  // Captura o escopo real do Report sempre que o portal lê/salva /api/report.
  const previousFetch=window.fetch.bind(window);
  window.fetch=function(input,init={}){
    const q=queryFromApi(input);
    if(q)rememberQuery(q);
    return previousFetch(input,init);
  };

  function queryFromSelect(){
    try{
      for(const s of document.querySelectorAll('select')){
        const opts=[...s.options];
        if(!opts.some(o=>String(o.value||'').startsWith('p:'))||!opts.some(o=>/\(empresa\)/i.test(o.textContent||'')))continue;
        const v=String(s.value||'');
        if(v.startsWith('p:')&&v.length>2)return 'project='+encodeURIComponent(v.slice(2));
        if(v&&v!=='all')return 'company='+encodeURIComponent(v);
      }
    }catch(_){}
    return '';
  }
  function queryFromContext(){
    try{
      const c=window.__allamoReportContext||{};
      const pid=c.project_id||c.projectId||(/^\d+$/.test(String(c.project||''))?c.project:'');
      const cid=c.company_id||c.companyId||c.company||'';
      if(pid)return 'project='+encodeURIComponent(pid);
      if(cid&&cid!=='all')return 'company='+encodeURIComponent(cid);
    }catch(_){}
    return '';
  }
  function queryFromUrl(){
    try{
      const q=new URLSearchParams(location.search);
      const p=q.get('project'),c=q.get('company');
      if(p)return 'project='+encodeURIComponent(p);
      if(c)return 'company='+encodeURIComponent(c);
    }catch(_){}
    return '';
  }
  function resolveQuery(){
    try{const q=window.__allamoLegacyReportAiGetQuery?.();if(q)return rememberQuery(q)}catch(_){}
    return rememberQuery(lastQuery||window.__allamoReportAiCurrentQuery||queryFromContext()||queryFromSelect()||queryFromUrl());
  }

  async function api(path,opts={}){
    const t=token();
    if(!t)throw new Error('Sua sessão não foi encontrada. Entre novamente no portal.');
    const r=await fetch('/api/'+path,{...opts,headers:{'content-type':'application/json','authorization':'Bearer '+t,...(opts.headers||{})},cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  }

  function draftKey(q){return 'allamo_report_ai_draft:'+(q||'pendente')}
  function readDraft(q){try{return JSON.parse(sessionStorage.getItem(draftKey(q))||'{}')}catch(_){return {}}}
  function saveDraft(d,q){
    try{
      sessionStorage.setItem(draftKey(q),JSON.stringify({
        meeting:d.querySelector('#meeting')?.value||'',
        sname:d.querySelector('#sname')?.value||'',
        sdate:d.querySelector('#sdate')?.value||'',
        stext:d.querySelector('#stext')?.value||'',
        inst:d.querySelector('#inst')?.value||''
      }));
    }catch(_){}
  }
  function restoreDraft(d,q){
    const x=readDraft(q);
    for(const [id,key] of [['meeting','meeting'],['sname','sname'],['sdate','sdate'],['stext','stext'],['inst','inst']]){
      const el=d.querySelector('#'+id);if(el&&x[key])el.value=x[key];
    }
  }

  function ensureStyle(){
    if(document.getElementById('allamo-report-ai-launcher-style'))return;
    const s=document.createElement('style');s.id='allamo-report-ai-launcher-style';s.textContent=`
.arai[data-allamo-ai-launcher="1"]{position:fixed;inset:0;z-index:2147482500;background:rgba(16,24,40,.64);display:flex;align-items:center;justify-content:center;padding:18px}
.arai[data-allamo-ai-launcher="1"] .arai-box{width:min(920px,96vw);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.3)}
.arai[data-allamo-ai-launcher="1"] textarea,.arai[data-allamo-ai-launcher="1"] input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d5dd;border-radius:9px;font:inherit;background:#fff}
.arai[data-allamo-ai-launcher="1"] textarea:focus,.arai[data-allamo-ai-launcher="1"] input:focus{outline:2px solid rgba(143,113,94,.18);border-color:#8f715e}
.allamo-ai-launcher-primary{margin:14px 0 10px;padding:14px 16px;border:1px solid #e4e1dc;border-radius:14px;background:#fffaf7}
.allamo-ai-launcher-status{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f8f5f2;color:#5d4b40;font-size:12px;line-height:1.45}
.allamo-ai-launcher-status.ok{background:#ecfdf3;color:#166534}.allamo-ai-launcher-status.err{background:#fff1f0;color:#b42318}.allamo-ai-launcher-status.wait{background:#f8f5f2;color:#5d4b40}
.allamo-ai-launcher-advanced{margin-top:12px;border:1px solid #e4e1dc;border-radius:12px;background:#fff}.allamo-ai-launcher-advanced>summary{cursor:pointer;padding:11px 13px;font-size:12px;font-weight:800;color:#5d4b40}.allamo-ai-launcher-advanced-body{padding:0 13px 13px}.allamo-ai-launcher-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.allamo-ai-launcher-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}.allamo-ai-launcher-btn{border:1px solid #d0d5dd;background:#fff;color:#344054;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}.allamo-ai-launcher-btn.primary{background:#8f715e;color:#fff;border-color:#8f715e}.allamo-ai-launcher-btn:disabled{opacity:.5;cursor:not-allowed}.allamo-ai-launcher-note{font-size:11px;color:#667085;line-height:1.45;margin-top:6px}
@media(max-width:700px){.allamo-ai-launcher-grid{grid-template-columns:1fr}.arai[data-allamo-ai-launcher="1"]{padding:8px}.arai[data-allamo-ai-launcher="1"] .arai-box{padding:16px}}
`;(document.head||document.documentElement).appendChild(s);
  }

  function setStatus(d,type,html){
    const el=d.querySelector('#aistatus');if(!el)return;
    el.className='allamo-ai-launcher-status '+type;
    el.innerHTML=html;
  }
  function close(d){if(d&&d.isConnected)d.remove()}

  async function checkReady(d){
    let q=resolveQuery();
    const gen=d.querySelector('#gen');
    if(gen)gen.disabled=true;
    setStatus(d,'wait','Verificando o Assistente IA e o projeto selecionado…');
    try{
      const st=await api('report-ai/status');
      q=resolveQuery();
      const provider=esc(st.provider||'Assistente IA');
      const model=st.model?(' · '+esc(st.model)):'';
      if(!st.configured){
        setStatus(d,'err','O Assistente IA não está habilitado neste ambiente. O campo da reunião continua disponível, mas a geração fica bloqueada até o serviço de IA estar configurado.');
        return;
      }
      if(!q){
        setStatus(d,'err','Assistente disponível, mas não consegui identificar o projeto deste Report. Feche e abra novamente o Status Report do projeto e tente de novo.');
        return;
      }
      rememberQuery(q);
      if(typeof window.__allamoLegacyReportAiGenerate!=='function'){
        setStatus(d,'err','O módulo de geração do Report não terminou de carregar. Atualize a página e tente novamente.');
        return;
      }
      if(gen)gen.disabled=false;
      setStatus(d,'ok','✓ Assistente pronto · '+provider+model+(st.free_mode?' · modo gratuito Cloudflare':'')+'. Nada será salvo sem sua aprovação.');
    }catch(err){
      setStatus(d,'err','Não foi possível validar o Assistente agora: '+esc(err.message||err)+' <button type="button" id="airetry" class="allamo-ai-launcher-btn" style="margin-left:8px;padding:6px 9px">Tentar novamente</button>');
      d.querySelector('#airetry')?.addEventListener('click',()=>checkReady(d),{once:true});
    }
  }

  function open(){
    ensureStyle();
    const existing=document.querySelector('.arai[data-allamo-ai-launcher="1"]');
    if(existing){existing.querySelector('#meeting')?.focus();return existing}
    const q=resolveQuery();
    try{window.__allamoLegacyReportAiSetQuery?.(q)}catch(_){}
    const d=document.createElement('div');
    d.className='arai';d.dataset.allamoAiLauncher='1';
    d.innerHTML=`<div class="arai-box" data-simplified="1" role="dialog" aria-modal="true" aria-label="Assistente IA do Status Report">
      <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h2 style="margin:0;color:#302f39">✨ Assistente IA do Status Report</h2><div style="font-size:12px;color:#667085;margin-top:3px">Cole o que aconteceu na reunião. A IA prepara o rascunho e você decide o que entra no Report.</div></div><span style="flex:1"></span><button type="button" id="close" class="allamo-ai-launcher-btn">Fechar</button></div>
      <div id="aistatus" class="allamo-ai-launcher-status wait">Abrindo o assistente…</div>
      <div class="allamo-ai-launcher-primary"><label style="display:block;font-size:12px;font-weight:800;color:#302f39">Resumo ou transcrição da reunião<textarea id="meeting" rows="10" placeholder="Cole aqui a reunião. Ex.: cadastros continuam em andamento; fornecedor aguarda validação do cliente; Go-live segue sem alteração..."></textarea></label><div class="allamo-ai-launcher-note">Você pode colar uma ata, transcrição completa ou apenas os principais pontos da reunião.</div></div>
      <details class="allamo-ai-launcher-advanced"><summary>＋ Adicionar evidências, anexo ou orientação</summary><div class="allamo-ai-launcher-advanced-body">
        <div class="allamo-ai-launcher-grid"><label>Nome da evidência<input id="sname" placeholder="Ex.: Cronograma fornecedor v3"></label><label>Data da evidência<input id="sdate" type="date"></label></div>
        <label style="display:block;margin-top:10px">Texto adicional da evidência<textarea id="stext" rows="4"></textarea></label>
        <label style="display:block;margin-top:10px">Arquivos (até 3)<input id="files" type="file" multiple accept=".pdf,.txt,.md,.csv,.json,image/png,image/jpeg,image/webp"></label>
        <label style="display:block;margin-top:10px">Orientação para a análise<textarea id="inst" rows="3" placeholder="Ex.: priorizar riscos que podem afetar o Go-live e apontar decisões pendentes."></textarea></label>
        <div class="allamo-ai-launcher-note">No modo gratuito Cloudflare, use sempre texto da reunião. Arquivos podem servir como apoio quando o provedor suportar o formato.</div>
      </div></details>
      <div id="aimsg"></div>
      <div class="allamo-ai-launcher-actions"><button type="button" id="clear" class="allamo-ai-launcher-btn">Limpar texto</button><button type="button" id="gen" class="allamo-ai-launcher-btn primary" disabled>✨ Analisar reunião e gerar rascunho</button></div>
      <div id="aiout"></div>
    </div>`;
    document.body.appendChild(d);
    restoreDraft(d,q);
    const persist=()=>saveDraft(d,resolveQuery()||q);
    d.addEventListener('input',persist);
    d.querySelector('#close').onclick=()=>close(d);
    d.querySelector('#clear').onclick=()=>{if(confirm('Limpar o texto desta reunião?')){for(const id of ['meeting','sname','sdate','stext','inst']){const el=d.querySelector('#'+id);if(el)el.value=''}persist();d.querySelector('#meeting')?.focus()}};
    d.addEventListener('click',e=>{if(e.target===d)close(d)});
    const escClose=e=>{if(e.key==='Escape'&&d.isConnected){close(d);window.removeEventListener('keydown',escClose)}};window.addEventListener('keydown',escClose);
    d.querySelector('#gen').onclick=async()=>{
      const current=resolveQuery()||q;
      if(!current){setStatus(d,'err','Projeto do Report não identificado. Abra o Report do projeto novamente.');return}
      rememberQuery(current);persist();
      if(typeof window.__allamoLegacyReportAiGenerate!=='function'){setStatus(d,'err','Módulo de geração indisponível. Atualize a página.');return}
      await window.__allamoLegacyReportAiGenerate(d);
    };
    setTimeout(()=>d.querySelector('#meeting')?.focus(),20);
    checkReady(d);
    return d;
  }

  // Window/capture executa antes do fallback legado registrado no document.
  // Assim o clique nunca depende de p.onclick e o modal abre imediatamente.
  window.addEventListener('click',e=>{
    const b=e.target?.closest?.('#ard-panel [data-act="ai"]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    open();
  },true);

  window.__allamoOpenReportAi=open;
})();
