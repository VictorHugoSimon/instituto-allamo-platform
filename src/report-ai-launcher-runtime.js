(()=>{
  if(window.__allamoReportAiLauncherLoaded)return;
  window.__allamoReportAiLauncherLoaded=true;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v}};
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
    return q;
  }

  // Observa o Report realmente carregado pelo Portal sem alterar o resultado da API.
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
  function resolveQuery(){return rememberQuery(lastQuery||window.__allamoReportAiCurrentQuery||queryFromContext()||queryFromSelect()||queryFromUrl())}

  // Usa o transporte original já protegido por no-store, evitando que o interceptor
  // legado de campos dinâmicos altere silenciosamente o payload deste novo Copiloto.
  const transport=(input,init)=>{
    const fn=window.__allamoOrigFetch||previousFetch;
    return fn(input,init);
  };
  async function api(path,opts={}){
    const t=token();
    if(!t)throw new Error('Sua sessão não foi encontrada. Entre novamente no portal.');
    const r=await transport('/api/'+path,{...opts,headers:{'content-type':'application/json','authorization':'Bearer '+t,...(opts.headers||{})},cache:'no-store',credentials:'same-origin'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  }

  const fileData=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result||''));r.onerror=no;r.readAsDataURL(f)});
  function draftKey(q){return 'allamo_report_ai_draft:'+(q||'pendente')}
  function readDraft(q){try{return JSON.parse(sessionStorage.getItem(draftKey(q))||'{}')}catch(_){return {}}}
  function saveDraft(d,q){
    try{sessionStorage.setItem(draftKey(q),JSON.stringify({meeting:d.querySelector('#meeting')?.value||'',sname:d.querySelector('#sname')?.value||'',sdate:d.querySelector('#sdate')?.value||'',stext:d.querySelector('#stext')?.value||'',inst:d.querySelector('#inst')?.value||''}))}catch(_){}
  }
  function restoreDraft(d,q){
    const x=readDraft(q);
    for(const [id,key] of [['meeting','meeting'],['sname','sname'],['sdate','sdate'],['stext','stext'],['inst','inst']]){const el=d.querySelector('#'+id);if(el&&x[key])el.value=x[key]}
  }
  function clearDraft(q){try{sessionStorage.removeItem(draftKey(q))}catch(_){}}

  function ensureStyle(){
    if(document.getElementById('allamo-report-ai-launcher-style'))return;
    const s=document.createElement('style');s.id='allamo-report-ai-launcher-style';s.textContent=`
.arai[data-allamo-ai-launcher="1"]{position:fixed;inset:0;z-index:2147482500;background:rgba(16,24,40,.64);display:flex;align-items:center;justify-content:center;padding:18px}
.arai[data-allamo-ai-launcher="1"] .arai-box{width:min(960px,96vw);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.3);font-family:inherit}
.arai[data-allamo-ai-launcher="1"] textarea,.arai[data-allamo-ai-launcher="1"] input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d5dd;border-radius:9px;font:inherit;background:#fff;color:#101828}
.arai[data-allamo-ai-launcher="1"] textarea:focus,.arai[data-allamo-ai-launcher="1"] input:focus{outline:2px solid rgba(143,113,94,.18);border-color:#8f715e}
.allamo-ai-launcher-primary{margin:14px 0 10px;padding:14px 16px;border:1px solid #e4e1dc;border-radius:14px;background:#fffaf7}
.allamo-ai-launcher-status{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f8f5f2;color:#5d4b40;font-size:12px;line-height:1.45}
.allamo-ai-launcher-status.ok{background:#ecfdf3;color:#166534}.allamo-ai-launcher-status.err{background:#fff1f0;color:#b42318}.allamo-ai-launcher-status.wait{background:#f8f5f2;color:#5d4b40}
.allamo-ai-launcher-advanced{margin-top:12px;border:1px solid #e4e1dc;border-radius:12px;background:#fff}.allamo-ai-launcher-advanced>summary{cursor:pointer;padding:11px 13px;font-size:12px;font-weight:800;color:#5d4b40}.allamo-ai-launcher-advanced-body{padding:0 13px 13px}.allamo-ai-launcher-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.allamo-ai-launcher-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}.allamo-ai-launcher-btn{border:1px solid #d0d5dd;background:#fff;color:#344054;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}.allamo-ai-launcher-btn.primary{background:#8f715e;color:#fff;border-color:#8f715e}.allamo-ai-launcher-btn.dark{background:#302f39;color:#fff;border-color:#302f39}.allamo-ai-launcher-btn:disabled{opacity:.5;cursor:not-allowed}.allamo-ai-launcher-note{font-size:11px;color:#667085;line-height:1.45;margin-top:6px}.allamo-ai-result-card{border:1px solid #e4e1dc;border-radius:11px;padding:11px;margin:8px 0;background:#fff}.allamo-ai-result-card.warn{background:#fff7e8}.allamo-ai-result-card.crit{background:#fff1f0}.allamo-ai-result-card.ok{background:#ecfdf3}.allamo-ai-result-row{display:flex;gap:9px;align-items:flex-start}.allamo-ai-result-row input[type=checkbox]{width:auto;margin-top:4px}.allamo-ai-tag{display:inline-block;margin:4px 4px 0 0;padding:3px 7px;border-radius:999px;background:#eef1f4;font-size:10px;font-weight:800}.allamo-ai-section-title{margin:18px 0 6px;color:#302f39;font-size:15px}.allamo-ai-old{text-decoration:line-through;color:#98a2b3}.allamo-ai-new{font-weight:800;color:#302f39}.allamo-ai-empty{border:1px dashed #d0d5dd;border-radius:10px;padding:12px;text-align:center;color:#667085;font-size:12px;background:#fff}
@media(max-width:700px){.allamo-ai-launcher-grid{grid-template-columns:1fr}.arai[data-allamo-ai-launcher="1"]{padding:8px}.arai[data-allamo-ai-launcher="1"] .arai-box{padding:16px}}
`;(document.head||document.documentElement).appendChild(s);
  }

  function setStatus(d,type,html){const el=d.querySelector('#aistatus');if(!el)return;el.className='allamo-ai-launcher-status '+type;el.innerHTML=html}
  function setMessage(d,type,html){const el=d.querySelector('#aimsg');if(!el)return;el.innerHTML=html?`<div class="allamo-ai-launcher-status ${type}">${html}</div>`:''}
  function close(d){if(d&&d.isConnected)d.remove()}

  async function checkReady(d){
    const gen=d.querySelector('#gen');if(gen)gen.disabled=true;
    setStatus(d,'wait','Verificando o Assistente IA e o projeto selecionado…');
    try{
      const st=await api('report-ai/status');
      const q=resolveQuery();
      if(!st.configured){setStatus(d,'err','O Assistente IA não está habilitado neste ambiente. O campo da reunião continua disponível, mas a geração fica bloqueada até o serviço de IA estar configurado.');return}
      if(!q){setStatus(d,'err','Assistente disponível, mas não consegui identificar o projeto deste Report. Feche, abra novamente o Status Report do projeto e tente de novo.');return}
      // Confirma que o Report existe/é acessível no mesmo tenant antes de habilitar a IA.
      await api('report?'+q);
      if(gen)gen.disabled=false;
      const provider=esc(st.provider||'Assistente IA'),model=st.model?(' · '+esc(st.model)):'';
      setStatus(d,'ok','✓ Assistente pronto · '+provider+model+(st.free_mode?' · modo gratuito Cloudflare':'')+'. Nada será salvo sem sua aprovação.');
    }catch(err){
      setStatus(d,'err','Não foi possível validar o Assistente agora: '+esc(err.message||err)+' <button type="button" id="airetry" class="allamo-ai-launcher-btn" style="margin-left:8px;padding:6px 9px">Tentar novamente</button>');
      d.querySelector('#airetry')?.addEventListener('click',()=>checkReady(d),{once:true});
    }
  }

  function parts(p){return String(p||'').replace(/\[(\d+)\]/g,'.$1').split('.').filter(Boolean)}
  function setPath(o,p,v){
    const a=parts(p);if(!a.length)return;let x=o;
    for(let i=0;i<a.length-1;i++){const k=a[i],n=a[i+1];if(x[k]==null)x[k]=/^\d+$/.test(n)?[]:{};x=x[k]}
    const k=a.at(-1),old=x[k];
    if(typeof old==='number'){const n=Number(String(v).replace(',','.'));if(Number.isFinite(n))x[k]=n}
    else if(typeof old==='boolean')x[k]=/^(true|1|sim)$/i.test(String(v));
    else x[k]=v;
  }
  function aiSection(data){
    data.custom_sections=Array.isArray(data.custom_sections)?data.custom_sections:[];
    let s=data.custom_sections.find(x=>x.id==='CS-AI-GOV');
    if(!s){s={id:'CS-AI-GOV',title:'Governança PMO — IA',client_visible:true,fields:[]};data.custom_sections.push(s)}
    s.fields=Array.isArray(s.fields)?s.fields:[];return s;
  }
  function upsert(s,id,label,value){
    let f=s.fields.find(x=>x.id===id);
    if(!f){f={id,label,type:'textarea',value:'',unit:'',note:'Gerado por IA · validar PMO',client_visible:true,ai_editable:true};s.fields.push(f)}
    f.value=value||'';
  }
  function listCards(items,titleKey,detailKey){
    if(!Array.isArray(items)||!items.length)return '<div class="allamo-ai-empty">Nenhum item novo.</div>';
    return items.map(x=>`<div class="allamo-ai-result-card"><b>${esc(x[titleKey]||'')}</b><div class="allamo-ai-launcher-note">${esc(x[detailKey]||'')} · Fonte: ${esc(x.source_name||'A confirmar')} · ${esc(x.confidence||'')}</div></div>`).join('');
  }

  async function projectContext(q){
    const p=new URLSearchParams(q),pid=p.get('project'),cid=p.get('company');
    if(pid){
      const ps=await api('projects');const row=(Array.isArray(ps)?ps:[]).find(x=>String(x.id)===String(pid));
      return {company_id:row?.company_id||'',project_id:Number(pid),project:row?.name||''};
    }
    return {company_id:cid||'',project_id:null,project:''};
  }
  async function createTask(a,b,q){
    try{
      const c=await projectContext(q);if(!c.company_id)throw new Error('Empresa não identificada para a tarefa.');
      await api('work-items',{method:'POST',body:JSON.stringify({company_id:c.company_id,project_id:c.project_id,project:c.project,item_type:'AÇÃO',title:a.title||'Ação do Report',description:`${a.description||''}\nFonte IA: ${a.source_name||'A confirmar'}`,status:'BACKLOG',priority:'Média',owner:a.responsible||'',due_date:/^\d{4}-\d{2}-\d{2}$/.test(a.due_date||'')?a.due_date:null,labels:['report-ai']})});
      b.disabled=true;b.textContent='✓ Tarefa criada';
    }catch(err){alert(err.message||err)}
  }
  async function createRoad(a,b,q){
    try{
      const c=await projectContext(q);if(!c.company_id)throw new Error('Empresa não identificada para o roadmap.');
      const status=a.status==='CONCLUÍDO'?'concluido':a.status==='EM ANDAMENTO'?'andamento':'pendente';
      const owner={CLIENTE:'Cliente',DEV:'Dev',TERCEIRO:'Fornecedor',PMO:'PMO'}[a.responsible_party]||'PMO';
      await api('plan',{method:'POST',body:JSON.stringify({company_id:c.company_id,project_id:c.project_id||'',fase:'Roadmap IA',etapa:a.title||'Marco do Report',responsavel:a.responsible||'',owner_tipo:owner,horas_prev:0,horas_real:0,inicio:a.start_date||'',fim:a.due_date||'',status})});
      b.disabled=true;b.textContent='✓ Adicionado';
    }catch(err){alert(err.message||err)}
  }

  function renderResult(d,q,result,runId){
    const out=d.querySelector('#aiout');if(!out)return;
    const changes=Array.isArray(result?.changes)?result.changes:[];
    out.innerHTML=`
      <h3 class="allamo-ai-section-title">Rascunho sugerido · ${esc(result?.overall_status||'A_CONFIRMAR')}</h3>
      <div class="allamo-ai-result-card"><b>Resumo executivo sugerido</b><div style="white-space:pre-wrap;margin-top:5px">${esc(result?.executive_summary_suggestion||'A confirmar')}</div></div>
      <h4 class="allamo-ai-section-title">Alterações propostas</h4>
      ${changes.length?changes.map((c,i)=>`<div class="allamo-ai-result-card ${c.critical?'crit':c.requires_manual_validation?'warn':'ok'}"><div class="allamo-ai-result-row"><input type="checkbox" data-change="${i}" ${!c.critical&&!c.requires_manual_validation?'checked':''}><div><b>${esc(c.label||c.target||'Alteração')}</b><div class="allamo-ai-launcher-note">${esc(c.target||'')}</div><div><span class="allamo-ai-old">${esc(c.old_value)}</span> → <span class="allamo-ai-new">${esc(c.suggested_value)}</span></div><div class="allamo-ai-launcher-note">${esc(c.reason||'')}</div><span class="allamo-ai-tag">${esc(c.confidence||'')}</span>${c.critical?'<span class="allamo-ai-tag">CRÍTICA</span>':''}${c.requires_manual_validation?'<span class="allamo-ai-tag">VALIDAÇÃO MANUAL</span>':''}<span class="allamo-ai-tag">Fonte: ${esc(c.source_name||'A confirmar')}</span></div></div></div>`).join(''):'<div class="allamo-ai-empty">Nenhuma alteração direta foi sugerida.</div>'}
      <h4 class="allamo-ai-section-title">Riscos</h4>${listCards(result?.risks,'risk','mitigation')}
      <h4 class="allamo-ai-section-title">Decisões</h4>${listCards(result?.decisions,'decision','impact')}
      <h4 class="allamo-ai-section-title">Ações</h4>${Array.isArray(result?.actions)&&result.actions.length?result.actions.map((a,i)=>`<div class="allamo-ai-result-card"><b>${esc(a.title||'Ação')}</b><div class="allamo-ai-launcher-note">${esc(a.description||'')} · ${esc(a.responsible||'A confirmar')} · ${esc(a.due_date||'sem prazo')}</div><button type="button" class="allamo-ai-launcher-btn" data-task="${i}" style="margin-top:8px">Criar tarefa no Trabalho</button></div>`).join(''):'<div class="allamo-ai-empty">Nenhuma ação nova.</div>'}
      <h4 class="allamo-ai-section-title">Roadmap</h4>${Array.isArray(result?.roadmap_updates)&&result.roadmap_updates.length?result.roadmap_updates.map((a,i)=>`<div class="allamo-ai-result-card"><b>${esc(a.title||'Marco')}</b><div class="allamo-ai-launcher-note">${esc(a.status||'')} · ${esc(a.responsible_party||'')} · ${esc(a.due_date||'sem prazo')}</div><button type="button" class="allamo-ai-launcher-btn" data-road="${i}" style="margin-top:8px">Adicionar ao plano/roadmap</button></div>`).join(''):'<div class="allamo-ai-empty">Nenhum marco novo.</div>'}
      ${Array.isArray(result?.quantitative_fields_without_evidence)&&result.quantitative_fields_without_evidence.length?`<div class="allamo-ai-result-card warn"><b>Quantitativos preservados por falta de evidência</b><div class="allamo-ai-launcher-note">${esc(result.quantitative_fields_without_evidence.join(' · '))}</div></div>`:''}
      ${Array.isArray(result?.warnings)&&result.warnings.length?`<div class="allamo-ai-result-card warn"><b>Avisos da análise</b><div class="allamo-ai-launcher-note">${esc(result.warnings.join(' · '))}</div></div>`:''}
      <label style="display:block;margin-top:12px"><input type="checkbox" id="gov" checked style="width:auto"> incluir resumo, riscos e decisões em uma seção adicional “Governança PMO — IA”</label>
      <div class="allamo-ai-launcher-actions"><button type="button" class="allamo-ai-launcher-btn dark" id="apply">Aplicar selecionadas e salvar nova versão</button></div>`;
    out.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>createTask(result.actions[Number(b.dataset.task)],b,q));
    out.querySelectorAll('[data-road]').forEach(b=>b.onclick=()=>createRoad(result.roadmap_updates[Number(b.dataset.road)],b,q));
    out.querySelector('#apply').onclick=()=>applyApproved(d,q,result,runId);
  }

  async function generateDraft(d,q){
    const btn=d.querySelector('#gen'),meeting=d.querySelector('#meeting')?.value.trim()||'',extra=d.querySelector('#stext')?.value.trim()||'';
    if(!meeting&&!extra){setMessage(d,'err','Cole o resumo/transcrição da reunião ou inclua uma evidência textual antes de gerar o Report.');d.querySelector('#meeting')?.focus();return}
    btn.disabled=true;btn.textContent='Analisando reunião…';setMessage(d,'wait','A IA está comparando a reunião com o Status Report atual. Nenhuma alteração será salva nesta etapa.');
    try{
      const sources=[],name=d.querySelector('#sname')?.value.trim()||'',date=d.querySelector('#sdate')?.value||'',files=[...(d.querySelector('#files')?.files||[])].slice(0,3);
      if(name||extra)sources.push({name:name||'Evidência textual',type:'text',date,text:extra});
      for(const f of files){if(f.size>5*1024*1024)throw new Error(`${f.name}: máximo 5 MB`);sources.push({name:f.name,type:'file',date,mime:f.type||'application/octet-stream',file_data:await fileData(f)})}
      const z=await api('report-ai?'+q,{method:'POST',body:JSON.stringify({meeting_summary:meeting,instructions:d.querySelector('#inst')?.value||'',sources})});
      if(!z?.result)throw new Error('O Assistente não devolveu um rascunho válido.');
      setMessage(d,'ok','✓ Rascunho gerado. Revise as sugestões abaixo; itens críticos e quantitativos sem evidência ficam desmarcados para validação manual.');
      renderResult(d,q,z.result,z.run_id||'');
    }catch(err){setMessage(d,'err',esc(err.message||err))}
    finally{btn.disabled=false;btn.textContent='✨ Analisar reunião e gerar rascunho'}
  }

  // GOVERNANÇA: o Report só é gravado a partir deste método, chamado exclusivamente
  // pelo clique explícito em #apply depois que o PMO revisa as sugestões.
  async function applyApproved(d,q,result,runId){
    const apply=d.querySelector('#apply');if(apply){apply.disabled=true;apply.textContent='Salvando nova versão…'}
    try{
      const current=await api('report?'+q),data=clone(current?.data||{});
      const selected=[...d.querySelectorAll('[data-change]:checked')].map(x=>Number(x.dataset.change));
      for(const i of selected){const c=result?.changes?.[i];if(c&&c.target)setPath(data,c.target,c.suggested_value)}
      if(d.querySelector('#gov')?.checked){
        const s=aiSection(data);
        upsert(s,'AI-EXEC','Resumo executivo sugerido',result?.executive_summary_suggestion||'');
        upsert(s,'AI-RISKS','Riscos identificados',(result?.risks||[]).map(x=>`• ${x.risk} | ${x.probability||'A confirmar'}/${x.impact||'A confirmar'} | ${x.mitigation||'A confirmar'}`).join('\n'));
        upsert(s,'AI-DECISIONS','Decisões identificadas',(result?.decisions||[]).map(x=>`• ${x.decision} | ${x.owner||'A confirmar'} | ${x.date||'sem data'}`).join('\n'));
      }
      data.ai_audit=Array.isArray(data.ai_audit)?data.ai_audit:[];
      data.ai_audit.push({run_id:runId,applied_at:new Date().toISOString(),sources:result?.sources_used||[],selected_changes:selected.length,overall_status:result?.overall_status||'A_CONFIRMAR'});
      await api('report?'+q,{method:'POST',body:JSON.stringify({data,source:'AI',change_note:'Atualização assistida pelo Copiloto PMO'})});
      if(runId)await api('report-ai/mark-applied',{method:'POST',body:JSON.stringify({run_id:runId})});
      clearDraft(q);setMessage(d,'ok','✓ Nova versão do Status Report salva com as alterações que você aprovou.');
      if(apply){apply.textContent='✓ Nova versão salva'}
      setTimeout(()=>location.reload(),900);
    }catch(err){setMessage(d,'err',esc(err.message||err));if(apply){apply.disabled=false;apply.textContent='Tentar salvar novamente'}}
  }

  function open(){
    ensureStyle();
    const existing=document.querySelector('.arai[data-allamo-ai-launcher="1"]');if(existing){existing.querySelector('#meeting')?.focus();return existing}
    const q=resolveQuery();
    const d=document.createElement('div');d.className='arai';d.dataset.allamoAiLauncher='1';
    d.innerHTML=`<div class="arai-box" data-simplified="1" role="dialog" aria-modal="true" aria-label="Assistente IA do Status Report">
      <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h2 style="margin:0;color:#302f39">✨ Assistente IA do Status Report</h2><div style="font-size:12px;color:#667085;margin-top:3px">Cole o que aconteceu na reunião. A IA prepara o rascunho e você decide o que entra no Report.</div></div><span style="flex:1"></span><button type="button" id="close" class="allamo-ai-launcher-btn">Fechar</button></div>
      <div id="aistatus" class="allamo-ai-launcher-status wait">Abrindo o assistente…</div>
      <div class="allamo-ai-launcher-primary"><label style="display:block;font-size:12px;font-weight:800;color:#302f39">Resumo ou transcrição da reunião<textarea id="meeting" rows="10" placeholder="Cole aqui a reunião. Ex.: cadastros continuam em andamento; fornecedor aguarda validação do cliente; Go-live segue sem alteração..."></textarea></label><div class="allamo-ai-launcher-note">Você pode colar uma ata, transcrição completa ou apenas os principais pontos da reunião.</div></div>
      <details class="allamo-ai-launcher-advanced"><summary>＋ Adicionar evidências, anexo ou orientação</summary><div class="allamo-ai-launcher-advanced-body"><div class="allamo-ai-launcher-grid"><label>Nome da evidência<input id="sname" placeholder="Ex.: Cronograma fornecedor v3"></label><label>Data da evidência<input id="sdate" type="date"></label></div><label style="display:block;margin-top:10px">Texto adicional da evidência<textarea id="stext" rows="4"></textarea></label><label style="display:block;margin-top:10px">Arquivos (até 3)<input id="files" type="file" multiple accept=".pdf,.txt,.md,.csv,.json,image/png,image/jpeg,image/webp"></label><label style="display:block;margin-top:10px">Orientação para a análise<textarea id="inst" rows="3" placeholder="Ex.: priorizar riscos que podem afetar o Go-live e apontar decisões pendentes."></textarea></label><div class="allamo-ai-launcher-note">No modo gratuito Cloudflare, use sempre texto da reunião. Arquivos podem servir como apoio quando o provedor suportar o formato.</div></div></details>
      <div id="aimsg"></div><div class="allamo-ai-launcher-actions"><button type="button" id="clear" class="allamo-ai-launcher-btn">Limpar texto</button><button type="button" id="gen" class="allamo-ai-launcher-btn primary" disabled>✨ Analisar reunião e gerar rascunho</button></div><div id="aiout"></div>
    </div>`;
    document.body.appendChild(d);restoreDraft(d,q);
    const persist=()=>saveDraft(d,resolveQuery()||q);d.addEventListener('input',persist);
    d.querySelector('#close').onclick=()=>close(d);
    d.querySelector('#clear').onclick=()=>{if(confirm('Limpar o texto desta reunião?')){for(const id of ['meeting','sname','sdate','stext','inst']){const el=d.querySelector('#'+id);if(el)el.value=''}persist();d.querySelector('#meeting')?.focus()}};
    d.addEventListener('click',e=>{if(e.target===d)close(d)});
    const escClose=e=>{if(e.key==='Escape'&&d.isConnected){close(d);window.removeEventListener('keydown',escClose)}};window.addEventListener('keydown',escClose);
    d.querySelector('#gen').onclick=()=>{const current=resolveQuery()||q;if(!current){setMessage(d,'err','Projeto do Report não identificado. Abra o Report do projeto novamente.');return}rememberQuery(current);persist();generateDraft(d,current)};
    setTimeout(()=>d.querySelector('#meeting')?.focus(),20);checkReady(d);return d;
  }

  // Window/capture executa antes do fallback legado registrado no document. Assim o
  // clique não depende de p.onclick e o campo da reunião aparece imediatamente.
  window.addEventListener('click',e=>{
    const b=e.target?.closest?.('#ard-panel [data-act="ai"]');if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open();
  },true);

  window.__allamoOpenReportAi=open;
})();
