(() => {
  const state = {
    token: null,
    apiMode: false,
    session: null,
    conversationId: null,
    escalations: [],
    knowledge: [],
    insights: null,
    lastEvidence: []
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const demoQuestions = [
    'Onde consigo criar forma de pagamento débito automático e guia?',
    'O DRE deixou de mostrar um centro de custo depois da atualização',
    'Por que a nota de setembro do cliente saiu com imposto retido errado?'
  ];

  const fallback = {
    knowledge: [
      {source_type:'doc',title:'Manual financeiro — formas de pagamento',module:'financeiro',version:'4.2.0',status:'homologado',owner:'Suporte'},
      {source_type:'release',title:'Release notes 4.2.0',module:'todos',version:'4.2.0',status:'homologado',owner:'Tech Lead'},
      {source_type:'code',title:'PaymentMethodForm.tsx',module:'financeiro',version:'a91f3c2',status:'indexado',owner:'Engenharia'},
      {source_type:'doc',title:'Estrutura de DRE e centros de custo',module:'dre',version:'4.2.0',status:'homologado',owner:'Produto'},
      {source_type:'doc',title:'Retenções fiscais — referência preliminar',module:'fiscal',version:'4.2.0',status:'sem_owner',owner:'—'}
    ],
    overview: {interactions:28,averageConfidence:.71,openEscalations:3,knowledgeDocuments:5,feedbackCount:19,solvedRate:.68},
    insights: {
      decisions:[{decision:'answer',total:19,avg_confidence:.84},{decision:'clarify',total:6,avg_confidence:.61},{decision:'escalate',total:3,avg_confidence:.34}],
      risks:[{risk_level:'low',total:14},{risk_level:'medium',total:9},{risk_level:'high',total:5}]
    }
  };

  async function boot() {
    bindNav();
    renderSourceHierarchy();
    renderSuggestions();
    bindActions();

    try {
      const health = await fetch('/health', {cache:'no-store'}).then(r => r.ok ? r.json() : Promise.reject());
      if (health.ok) {
        const demo = await fetch('/api/ai/demo/session', {method:'POST'}).then(r => r.ok ? r.json() : Promise.reject());
        state.token = demo.token;
        state.session = demo;
        state.apiMode = true;
        $('#runtimeBadge').className = 'badge badge-ok';
        $('#runtimeBadge').innerHTML = '<i></i><span>Cloudflare Worker</span>';
        $('#tenantBadge').textContent = `tenant: ${demo.tenant} · v${demo.version}`;
      }
    } catch {
      state.apiMode = false;
      state.session = {tenant:'esposende-calcados',version:'4.2.0'};
      $('#runtimeBadge').className = 'badge badge-warn';
      $('#runtimeBadge').innerHTML = '<i></i><span>demo estática</span>';
      $('#tenantBadge').textContent = 'tenant: esposende-calcados · v4.2.0';
    }

    await Promise.all([loadOverview(), loadEscalations(), loadKnowledge(), loadInsights()]);
  }

  function bindNav() {
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
    $('#question').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    $('#resetChat').addEventListener('click', () => {
      state.conversationId = null;
      $('#messages').innerHTML = '<div class="empty-chat"><strong>POC pronta para teste</strong><span>Escolha uma sugestão ou escreva sua pergunta.</span></div>';
      $('#tracePanel').className = 'trace-empty';
      $('#tracePanel').textContent = 'Nenhuma consulta executada.';
    });
    $('#refreshEsc').addEventListener('click', loadEscalations);
    $('#refreshKnowledge').addEventListener('click', loadKnowledge);
    $('#refreshInsights').addEventListener('click', loadInsights);
  }

  function renderSuggestions() {
    $('#suggestions').innerHTML = demoQuestions.map(q => `<button>${escapeHtml(q)}</button>`).join('');
    $$('#suggestions button').forEach((b,i) => b.addEventListener('click', () => { $('#question').value = demoQuestions[i]; submit(); }));
  }

  async function submit() {
    const q = $('#question').value.trim();
    if (!q) return;
    $('#question').value = '';
    clearEmptyChat();
    appendUser(q);
    const thinking = appendThinking();

    try {
      const out = state.apiMode ? await api('/api/ai/support/query', {
        method:'POST',
        body: JSON.stringify({conversationId:state.conversationId,message:q,clientContext:{currentRoute:'ai-support'}})
      }) : await mockQuery(q);
      thinking.remove();
      state.conversationId = out.conversationId || state.conversationId;
      appendBot(out);
      renderEvidence(out);
      if (out.status === 'escalated') {
        await ensureEscalation(out, q);
        await loadEscalations();
      }
      await loadOverview();
    } catch (e) {
      thinking.remove();
      appendError('Não foi possível concluir a consulta. ' + (e.message || 'Erro inesperado.'));
    }
  }

  async function api(path, init={}) {
    const headers = {'content-type':'application/json', ...(init.headers||{})};
    if (state.token) headers.authorization = 'Bearer ' + state.token;
    const res = await fetch(path, {...init, headers, cache:'no-store'});
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    return out;
  }

  async function mockQuery(q) {
    await wait(700);
    const lower = q.toLowerCase();
    if (lower.includes('débito') || lower.includes('debito') || lower.includes('forma de pagamento')) {
      return {
        status:'answered',conversationId:state.conversationId||crypto.randomUUID(),responseId:crypto.randomUUID(),confidence:.87,
        answer:'A configuração fica em Financeiro › Cadastros › Formas de pagamento. O tipo Débito automático exige convênio bancário preenchido antes de emitir guia.',
        steps:['Acesse Financeiro › Cadastros › Formas de pagamento e clique em Nova forma.','Selecione Débito automático e informe banco, convênio e código do cedente.','Marque Emite guia e escolha o layout correspondente ao convênio.','Salve e valide em homologação.'],
        sources:[{type:'doc',id:'financeiro/formas-pagamento',version:'4.2.0'},{type:'code',id:'PaymentMethodForm.tsx',version:'a91f3c2'},{type:'release',id:'4.2.0'}],
        evidence:[{type:'doc',id:'demo:doc:formas-pagamento',score:.91,origin:'semantic'},{type:'code',id:'demo:code:payment-method',score:.84,origin:'lexical'},{type:'release',id:'demo:release:4.2.0',score:.78,origin:'semantic'}]
      };
    }
    if (lower.includes('dre') || lower.includes('centro de custo')) {
      return {
        status:'needs_clarification',conversationId:state.conversationId||crypto.randomUUID(),responseId:crypto.randomUUID(),confidence:.58,
        answer:'Há duas causas conhecidas para um centro de custo desaparecer do DRE: ele pode estar inativo ou ter perdido o vínculo com um grupo de resultado. A versão do tenant deve ser confirmada antes de concluir a causa.',
        steps:['Confirme se o centro de custo está ativo.','Valide o vínculo com o grupo de resultado na estrutura do DRE.','Se ambos estiverem corretos, recalcule o período.'],
        missing_context:['Confirmar versão e estrutura de DRE do tenant'],
        sources:[{type:'doc',id:'dre/estrutura',version:'4.2.0'}],
        evidence:[{type:'doc',id:'demo:doc:dre',score:.74,origin:'semantic'}]
      };
    }
    if (lower.includes('imposto') || lower.includes('retid') || lower.includes('fiscal') || lower.includes('nota')) {
      return {
        status:'escalated',conversationId:state.conversationId||crypto.randomUUID(),responseId:crypto.randomUUID(),confidence:.31,reason:'high_risk_topic',
        missing_context:['Regra de retenção do tomador','Documento fiscal específico','Parametrização fiscal do tenant'],
        sources:[{type:'doc',id:'fiscal/retencoes',version:'4.2.0'}],
        evidence:[{type:'doc',id:'demo:doc:fiscal',score:.52,origin:'semantic'}],
        diagnostic:{question:q,module:'fiscal',confidence:.31,attempts:['busca semântica e lexical','validação de contexto read-only','regra de risco alto aplicada']}
      };
    }
    return {
      status:'escalated',conversationId:state.conversationId||crypto.randomUUID(),responseId:crypto.randomUUID(),confidence:.34,reason:'insufficient_evidence',
      missing_context:['Fonte oficial homologada para o tema','Módulo e tela de origem'],sources:[],evidence:[],
      diagnostic:{question:q,module:'não classificado',confidence:.34,attempts:['busca híbrida sem evidência acima do limiar']}
    };
  }

  function appendUser(text) {
    const el = document.createElement('div'); el.className='message user'; el.textContent=text; $('#messages').appendChild(el); scrollMessages();
  }
  function appendThinking() {
    const el=document.createElement('div');el.className='message bot';el.innerHTML='<span class="mono small muted">Valkíria está classificando, recuperando evidências e validando guardrails…</span>';$('#messages').appendChild(el);scrollMessages();return el;
  }
  function appendError(text) { const el=document.createElement('div');el.className='message bot';el.innerHTML=`<span class="decision escalate">erro</span><p>${escapeHtml(text)}</p>`;$('#messages').appendChild(el);scrollMessages(); }

  function appendBot(out) {
    const kind = out.status === 'answered' ? 'answer' : out.status === 'needs_clarification' ? 'clarify' : 'escalate';
    const label = kind === 'answer' ? 'resposta fundamentada' : kind === 'clarify' ? 'resposta com ressalva' : 'escalado — revisão humana';
    const el = document.createElement('div');
    el.className='message bot';
    const answer = out.answer || (kind==='escalate' ? 'Não tenho evidência suficiente para orientar com segurança. O caso foi preparado para revisão humana.' : 'Preciso de mais contexto para concluir.');
    el.innerHTML = `<div class="message-head"><span class="decision ${kind}">${label}</span><span class="confidence">confiança ${fmt(out.confidence)}</span></div><p>${escapeHtml(answer)}</p>`+
      ((out.steps||[]).length ? `<ol class="steps">${out.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>`:'')+
      ((out.missing_context||[]).length ? `<div class="trace-context"><b>Contexto faltante</b>${out.missing_context.map(x=>`<div>• ${escapeHtml(x)}</div>`).join('')}</div>`:'')+
      ((out.sources||[]).length ? `<div class="source-chips">${out.sources.map(s=>`<span class="source-chip">${escapeHtml(s.type||'fonte')} · ${escapeHtml(s.id||String(s))}${s.version?' · v'+escapeHtml(s.version):''}</span>`).join('')}</div>`:'')+
      (kind!=='escalate' ? `<div class="feedback"><span>Resolveu sua dúvida?</span><button data-fb="yes">Sim</button><button data-fb="no">Não</button></div>`:'');
    $('#messages').appendChild(el);
    el.querySelectorAll('[data-fb]').forEach(b=>b.addEventListener('click',()=>sendFeedback(out,b.dataset.fb==='yes',el)));
    scrollMessages();
  }

  async function sendFeedback(out, solved, el) {
    const box=el.querySelector('.feedback');
    if (!box) return;
    if (state.apiMode && out.responseId) {
      try { await api(`/api/ai/conversations/${state.conversationId||'current'}/feedback`,{method:'POST',body:JSON.stringify({responseId:out.responseId,solved,rating:solved?5:2})}); } catch {}
    }
    box.innerHTML=`<span>${solved?'Feedback registrado. Obrigado.':'Registrado como knowledge gap para revisão.'}</span>`;
    toast('Feedback registrado');
  }

  async function ensureEscalation(out, question) {
    const item={id:'ESC-'+Date.now().toString(36).toUpperCase(),status:'aguardando',reason:out.reason||'insufficient_evidence',diagnostic:out.diagnostic||{question,confidence:out.confidence}};
    if (state.apiMode) {
      try {
        const r=await api('/api/ai/escalations',{method:'POST',body:JSON.stringify({conversationId:out.conversationId,reason:item.reason,diagnostic:item.diagnostic})});
        item.id=r.escalationId||item.id;
      } catch {}
    }
    state.escalations.unshift(item);
  }

  function renderEvidence(out) {
    const ev=out.evidence||[];
    state.lastEvidence=ev;
    let html=`<div class="trace-context"><b>Decisão</b><div>${escapeHtml(out.status)} · confiança ${fmt(out.confidence)}</div></div>`;
    if (out.diagnostic?.attempts) html+=out.diagnostic.attempts.map((a,i)=>`<div class="trace-step"><b>${i+1}. ${escapeHtml(a)}</b></div>`).join('');
    if (ev.length) html+=ev.map(e=>`<div class="trace-step"><div class="trace-score">${escapeHtml(e.type||'fonte')} · score ${fmt(e.score)}</div><b>${escapeHtml(e.id||'')}</b><p>${escapeHtml(e.origin||'retrieval')} ${e.path?'· '+escapeHtml(e.path):''}</p></div>`).join('');
    else html+='<div class="trace-empty">Nenhuma evidência homologada acima do limiar.</div>';
    $('#tracePanel').className=''; $('#tracePanel').innerHTML=html;
  }

  async function loadOverview() {
    let k=fallback.overview;
    if (state.apiMode) {
      try { k=(await api('/api/ai/overview')).kpis; } catch {}
    }
    const items=[
      ['interações',k.interactions||0,'volume registrado'],
      ['confiança média',fmt(k.averageConfidence),'pipeline'],
      ['escalonamentos',k.openEscalations||0,'abertos'],
      ['fontes',k.knowledgeDocuments||0,'knowledge base'],
      ['resolução feedback',pct(k.solvedRate),'feedback explícito']
    ];
    $('#overviewKpis').innerHTML=items.map(([l,v,d])=>`<article class="kpi"><small>${l}</small><strong>${v}</strong><span>${d}</span></article>`).join('');
  }

  async function loadKnowledge() {
    let items=fallback.knowledge;
    if (state.apiMode) { try { items=(await api('/api/ai/knowledge')).items; } catch {} }
    state.knowledge=items;
    $('#knowledgeRows').innerHTML=items.length?items.map(r=>`<tr><td class="mono">${escapeHtml(r.source_type||'—')}</td><td>${escapeHtml(r.title||r.id||'—')}</td><td>${escapeHtml(r.module||'—')}</td><td>${escapeHtml(r.version||'—')}</td><td><span class="status-pill">${escapeHtml(r.status||'—')}</span></td><td>${escapeHtml(r.owner||'—')}</td></tr>`).join(''):'<tr><td colspan="6">Nenhuma fonte indexada.</td></tr>';
  }

  async function loadEscalations() {
    let items=state.escalations;
    if (state.apiMode) { try { items=(await api('/api/ai/escalations')).items; state.escalations=items; } catch {} }
    $('#escCount').textContent=String(items.length);
    $('#escalationList').innerHTML=items.length?items.map(e=>{const d=e.diagnostic||{};return `<article class="esc-card"><div class="esc-top"><span class="esc-id">${escapeHtml(e.id||'ESC')}</span><span class="esc-status">${escapeHtml(e.status||'aguardando')}</span></div><h3>${escapeHtml(d.question||e.reason||'Caso escalado')}</h3><p><strong>Motivo:</strong> ${escapeHtml(e.reason||'insufficient_evidence')} · confiança ${fmt(d.confidence)}</p>${(d.attempts||[]).length?`<p><strong>Tentativas:</strong> ${d.attempts.map(escapeHtml).join(' · ')}</p>`:''}</article>`}).join(''):'<div class="panel"><p class="muted">Nenhum escalonamento registrado.</p></div>';
  }

  async function loadInsights() {
    let data=fallback.insights;
    if (state.apiMode) { try { data=await api('/api/ai/insights'); } catch {} }
    state.insights=data;
    const total=(data.decisions||[]).reduce((a,x)=>a+Number(x.total||0),0);
    const answers=(data.decisions||[]).find(x=>x.decision==='answer')?.total||0;
    const escal=(data.decisions||[]).find(x=>x.decision==='escalate')?.total||0;
    const high=(data.risks||[]).find(x=>x.risk_level==='high')?.total||0;
    $('#insightKpis').innerHTML=[['interações',total,'dataset operacional'],['resolução IA',pct(total?answers/total:0),'decision=answer'],['escalados',escal,'fallback humano'],['alto risco',high,'guardrail'],['prompt','v1.1','versão ativa']].map(([l,v,d])=>`<article class="kpi"><small>${l}</small><strong>${v}</strong><span>${d}</span></article>`).join('');
    renderBars('#decisionBars',data.decisions||[],'decision');
    renderBars('#riskBars',data.risks||[],'risk_level');
  }

  function renderBars(sel,items,key){const max=Math.max(1,...items.map(x=>Number(x.total||0)));$(sel).innerHTML=items.length?items.map(x=>`<div class="bar-row"><span>${escapeHtml(x[key]||'—')}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(Number(x.total||0)/max*100)}%"></div></div><b>${Number(x.total||0)}</b></div>`).join(''):'<p class="muted small">Sem dados.</p>'}

  function renderSourceHierarchy(){const rows=[['1','Contexto do tenant','configuração e permissões reais'],['2','Documentação oficial','procedimentos e regras'],['3','Release notes','comportamento da versão'],['4','Código-fonte','validação técnica'],['5','FAQs homologados','soluções recorrentes'],['6','Histórico','somente pista']];$('#sourceHierarchy').innerHTML=rows.map(r=>`<div class="rank-row"><b>${r[0]}</b><strong>${r[1]}</strong><span>${r[2]}</span></div>`).join('')}
  function clearEmptyChat(){const e=$('#messages .empty-chat');if(e)e.remove()}
  function scrollMessages(){requestAnimationFrame(()=>{$('#messages').scrollTop=$('#messages').scrollHeight})}
  function fmt(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(2):'—'}
  function pct(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100)+'%':'—'}
  function wait(ms){return new Promise(r=>setTimeout(r,ms))}
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
  boot();
})();
