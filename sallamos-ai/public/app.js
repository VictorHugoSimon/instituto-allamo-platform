(() => {
  const state = { token: null, session: null, health: null, conversationId: null };
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const suggestions = [
    'Onde consigo criar forma de pagamento débito automático e guia?',
    'O DRE deixou de mostrar um centro de custo depois da atualização',
    'Por que a nota do cliente saiu com imposto retido errado?'
  ];

  window.SallamosAI = {
    setSessionToken: async (token, session = {}) => {
      state.token = String(token || '');
      state.session = session;
      if (state.token) sessionStorage.setItem('sallamos_ai_session', state.token);
      updateIdentity();
      await refreshAll();
      toast('Sessão Sallamos conectada');
    },
    clearSession: () => {
      state.token = null; state.session = null; sessionStorage.removeItem('sallamos_ai_session');
      lockUi('Sessão encerrada. Aguardando autenticação do Sallamos.');
    }
  };

  async function boot() {
    bindNavigation(); bindActions(); renderSuggestions(); renderSourceHierarchy();
    try {
      state.health = await fetch('/health', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error('health')));
      $('#runtimeBadge').className = 'badge badge-ok';
      $('#runtimeBadge').innerHTML = `<i></i><span>${escapeHtml(state.health.environment || 'online')}</span>`;
    } catch {
      $('#runtimeBadge').className = 'badge badge-warn';
      $('#runtimeBadge').innerHTML = '<i></i><span>backend indisponível</span>';
      lockUi('Backend indisponível.'); return;
    }

    state.token = sessionStorage.getItem('sallamos_ai_session');
    if (!state.token && state.health.demo) {
      try {
        const demo = await fetch('/api/ai/demo/session', { method: 'POST', cache: 'no-store' }).then(async r => {
          const d = await r.json(); if (!r.ok) throw new Error(d.error || 'demo_disabled'); return d;
        });
        state.token = demo.token; state.session = demo;
      } catch {}
    }

    if (!state.token) {
      updateIdentity();
      lockUi('Ambiente seguro ativo. Aguardando a sessão autenticada do Sallamos.');
      return;
    }
    updateIdentity();
    await refreshAll();
  }

  function bindNavigation() {
    $$('.nav').forEach(btn => btn.addEventListener('click', () => show(btn.dataset.screen)));
    $$('[data-go]').forEach(btn => btn.addEventListener('click', () => show(btn.dataset.go)));
  }
  function show(name) {
    $$('.nav').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    if (name === 'escalations') loadEscalations();
    if (name === 'knowledge') loadKnowledge();
    if (name === 'insights') loadInsights();
  }
  function bindActions() {
    $('#send').addEventListener('click', submit);
    $('#question').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    $('#resetChat').addEventListener('click', resetChat);
    $('#refreshEsc').addEventListener('click', loadEscalations);
    $('#refreshKnowledge').addEventListener('click', loadKnowledge);
    $('#refreshInsights').addEventListener('click', loadInsights);
  }
  function renderSuggestions() {
    $('#suggestions').innerHTML = suggestions.map(q => `<button>${escapeHtml(q)}</button>`).join('');
    $$('#suggestions button').forEach((b, i) => b.addEventListener('click', () => { $('#question').value = suggestions[i]; submit(); }));
  }
  function renderSourceHierarchy() {
    const items = [['1','Documentação homologada'],['2','Regras de negócio'],['3','Releases versionadas'],['4','Código indexado'],['5','Histórico validado']];
    $('#sourceHierarchy').innerHTML = items.map(([n,t]) => `<div class="rank-item"><b class="mono">${n}</b><span>${t}</span></div>`).join('');
  }

  async function submit() {
    if (!state.token) return toast('Aguardando autenticação do Sallamos');
    const question = $('#question').value.trim(); if (!question) return;
    $('#question').value = ''; clearEmptyChat(); appendUser(question); const thinking = appendThinking();
    try {
      const out = await api('/api/ai/support/query', { method: 'POST', body: JSON.stringify({ conversationId: state.conversationId, message: question, clientContext: { currentRoute: 'ai-support' } }) });
      thinking.remove(); state.conversationId = out.conversationId || state.conversationId; appendBot(out); renderEvidence(out);
      if (out.status === 'escalated' && out.conversationId) await createEscalation(out, question);
      await loadOverview();
    } catch (e) { thinking.remove(); appendError(e.message || 'Erro inesperado.'); }
  }

  async function api(path, init = {}) {
    if (!state.token) throw new Error('missing_session');
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + state.token, ...(init.headers || {}) };
    const res = await fetch(path, { ...init, headers, cache: 'no-store' });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { state.token = null; sessionStorage.removeItem('sallamos_ai_session'); lockUi('Sessão inválida ou expirada.'); }
      throw new Error(out.error || `HTTP ${res.status}`);
    }
    return out;
  }

  async function refreshAll() { await Promise.all([loadOverview(), loadEscalations(), loadKnowledge(), loadInsights()]); unlockUi(); }
  async function loadOverview() {
    if (!state.token) return renderOverview({});
    try { const x = await api('/api/ai/overview'); renderOverview(x.kpis || {}); }
    catch { renderOverview({}); }
  }
  function renderOverview(k) {
    const items = [['interações',k.interactions||0,'tenant atual'],['confiança média',fmt(k.averageConfidence),'respostas'],['escalonamentos',k.openEscalations||0,'abertos'],['fontes',k.knowledgeDocuments||0,'homologadas'],['resolução',pct(k.solvedRate),'feedback']];
    $('#overviewKpis').innerHTML = items.map(([l,v,d]) => `<article class="kpi"><small>${l}</small><strong>${v}</strong><span>${d}</span></article>`).join('');
  }
  async function loadEscalations() {
    const el=$('#escalationList'); if (!state.token) { el.innerHTML='<div class="empty-state">Autenticação necessária.</div>'; return; }
    try {
      const x=await api('/api/ai/escalations'); const items=x.items||[]; $('#escCount').textContent=String(items.length);
      el.innerHTML=items.length?items.map(i=>`<article class="panel escalation-card"><div><span class="decision escalate">${escapeHtml(i.status||'aguardando')}</span><h3>${escapeHtml(i.id)}</h3><p>${escapeHtml(i.reason||'')}</p></div><small class="mono muted">${escapeHtml(i.created_at||'')}</small></article>`).join(''):'<div class="empty-state">Nenhum escalonamento para este tenant.</div>';
    } catch(e) { el.innerHTML=`<div class="empty-state">${escapeHtml(e.message)}</div>`; }
  }
  async function loadKnowledge() {
    const el=$('#knowledgeRows'); if(!state.token){el.innerHTML='<tr><td colspan="6">Autenticação necessária.</td></tr>';return;}
    try { const x=await api('/api/ai/knowledge'); const items=x.items||[]; el.innerHTML=items.length?items.map(i=>`<tr><td>${escapeHtml(i.source_type)}</td><td>${escapeHtml(i.title||i.id)}</td><td>${escapeHtml(i.module||'—')}</td><td>${escapeHtml(i.version||'—')}</td><td>${escapeHtml(i.status||'—')}</td><td>${escapeHtml(i.owner||'—')}</td></tr>`).join(''):'<tr><td colspan="6">Nenhuma fonte homologada.</td></tr>'; }
    catch(e){el.innerHTML=`<tr><td colspan="6">${escapeHtml(e.message)}</td></tr>`;}
  }
  async function loadInsights() {
    if(!state.token){renderInsights({decisions:[],risks:[]});return;}
    try { renderInsights(await api('/api/ai/insights')); } catch { renderInsights({decisions:[],risks:[]}); }
  }
  function renderInsights(x) {
    const decisions=x.decisions||[], risks=x.risks||[];
    $('#insightKpis').innerHTML=[['decisões',sum(decisions),'interações'],['risco alto',findTotal(risks,'risk_level','high'),'casos'],['escalados',findTotal(decisions,'decision','escalate'),'humano']].map(([l,v,d])=>`<article class="kpi"><small>${l}</small><strong>${v}</strong><span>${d}</span></article>`).join('');
    $('#decisionBars').innerHTML=bars(decisions,'decision'); $('#riskBars').innerHTML=bars(risks,'risk_level');
  }
  function bars(items,key){const max=Math.max(1,...items.map(i=>Number(i.total||0)));return items.length?items.map(i=>`<div class="bar-row"><span>${escapeHtml(i[key]||'—')}</span><div><i style="width:${Math.round(Number(i.total||0)/max*100)}%"></i></div><b>${Number(i.total||0)}</b></div>`).join(''):'<div class="empty-state">Sem dados.</div>'}

  async function createEscalation(out, question) {
    try { await api('/api/ai/escalations',{method:'POST',body:JSON.stringify({conversationId:out.conversationId,reason:out.reason||'insufficient_evidence',diagnostic:out.diagnostic||{question,confidence:out.confidence}})}); await loadEscalations(); } catch {}
  }
  async function sendFeedback(out, solved, el) {
    const box=el.querySelector('.feedback'); if(!box||!out.responseId)return;
    try { await api(`/api/ai/conversations/${state.conversationId||'current'}/feedback`,{method:'POST',body:JSON.stringify({responseId:out.responseId,solved,rating:solved?5:2})}); box.innerHTML='<span>Feedback registrado.</span>'; await loadOverview(); } catch {}
  }

  function appendUser(text){const e=document.createElement('div');e.className='message user';e.textContent=text;$('#messages').appendChild(e);scrollMessages()}
  function appendThinking(){const e=document.createElement('div');e.className='message bot';e.innerHTML='<span class="mono small muted">Valkíria está recuperando evidências e validando políticas…</span>';$('#messages').appendChild(e);scrollMessages();return e}
  function appendError(text){const e=document.createElement('div');e.className='message bot';e.innerHTML=`<span class="decision escalate">erro</span><p>${escapeHtml(text)}</p>`;$('#messages').appendChild(e);scrollMessages()}
  function appendBot(out){
    const kind=out.status==='answered'?'answer':out.status==='needs_clarification'?'clarify':'escalate';
    const label=kind==='answer'?'resposta fundamentada':kind==='clarify'?'precisa de contexto':'escalado — revisão humana';
    const e=document.createElement('div');e.className='message bot';
    const answer=out.answer||(kind==='escalate'?'Não há evidência suficiente para orientar com segurança.':'Preciso de mais contexto.');
    e.innerHTML=`<div class="message-head"><span class="decision ${kind}">${label}</span><span class="confidence">confiança ${fmt(out.confidence)}</span></div><p>${escapeHtml(answer)}</p>`+
      ((out.steps||[]).length?`<ol class="steps">${out.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>`:'')+
      ((out.missing_context||[]).length?`<div class="trace-context"><b>Contexto faltante</b>${out.missing_context.map(x=>`<div>• ${escapeHtml(x)}</div>`).join('')}</div>`:'')+
      (kind!=='escalate'?'<div class="feedback"><span>Resolveu?</span><button data-fb="yes">Sim</button><button data-fb="no">Não</button></div>':'');
    $('#messages').appendChild(e); e.querySelectorAll('[data-fb]').forEach(b=>b.addEventListener('click',()=>sendFeedback(out,b.dataset.fb==='yes',e))); scrollMessages();
  }
  function renderEvidence(out){const ev=out.evidence||[];let html=`<div class="trace-context"><b>Decisão</b><div>${escapeHtml(out.status)} · confiança ${fmt(out.confidence)}</div></div>`;if(out.diagnostic?.attempts)html+=out.diagnostic.attempts.map((a,i)=>`<div class="trace-step"><b>${i+1}. ${escapeHtml(a)}</b></div>`).join('');html+=ev.length?ev.map(e=>`<div class="trace-step"><div class="trace-score">${escapeHtml(e.type||'fonte')} · score ${fmt(e.score)}</div><b>${escapeHtml(e.id||'')}</b><p>${escapeHtml(e.origin||'retrieval')} ${e.path?'· '+escapeHtml(e.path):''}</p></div>`).join(''):'<div class="trace-empty">Nenhuma evidência homologada acima do limiar.</div>';$('#tracePanel').className='';$('#tracePanel').innerHTML=html}

  function resetChat(){state.conversationId=null;$('#messages').innerHTML='<div class="empty-chat"><strong>Nova conversa</strong><span>Escreva uma dúvida sobre o Sallamos.</span></div>';$('#tracePanel').className='trace-empty';$('#tracePanel').textContent='Nenhuma consulta executada.'}
  function lockUi(message){$('#question').disabled=true;$('#send').disabled=true;$('#messages').innerHTML=`<div class="empty-chat"><strong>Autenticação necessária</strong><span>${escapeHtml(message)}</span></div>`;renderOverview({});}
  function unlockUi(){ $('#question').disabled=false; $('#send').disabled=false; if($('#messages .empty-chat')?.textContent.includes('Autenticação')) resetChat(); }
  function updateIdentity(){const tenant=state.session?.tenant||state.session?.tenantId||'—',version=state.session?.version||state.session?.productVersion||'—';$('#tenantBadge').textContent=`tenant: ${tenant} · v${version}`}
  function clearEmptyChat(){const e=$('#messages .empty-chat');if(e)e.remove()}
  function scrollMessages(){const e=$('#messages');e.scrollTop=e.scrollHeight}
  function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
  function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function fmt(v){return Number.isFinite(Number(v))?(Number(v)*100).toFixed(0)+'%':'—'}
  function pct(v){return Number.isFinite(Number(v))?(Number(v)*100).toFixed(0)+'%':'—'}
  function sum(items){return items.reduce((a,b)=>a+Number(b.total||0),0)}
  function findTotal(items,key,value){return Number(items.find(x=>x[key]===value)?.total||0)}

  boot();
})();
