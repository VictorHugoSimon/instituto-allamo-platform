(()=>{
  const D=window.SEMEALI_MARKET_DATA||{};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const company='semeali';
  const sessionKey='allamo_session';
  const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
  const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('pt-BR')};
  const getSession=()=>{try{return JSON.parse(localStorage.getItem(sessionKey)||'null')}catch{return null}};
  const setSession=s=>localStorage.setItem(sessionKey,JSON.stringify(s));
  const token=()=>getSession()?.token||localStorage.getItem('allamo_session_token')||localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||'';
  const api=async(path,options={})=>{const headers={'content-type':'application/json',...(options.headers||{})};const t=token();if(t)headers.authorization='Bearer '+t;const r=await fetch('/api/'+path,{...options,headers,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('Erro '+r.status));return d};
  const viewMeta={
    dashboard:['Início','Resumo do dia e atalhos comerciais'],prospecting:['Prospecção','Onde buscar e quem abordar'],accounts:['Clientes & Carteira','Gestão de contas comerciais'],opportunities:['Oportunidades','Funil e potencial comercial'],approvals:['Aprovações','Solicitações e decisões comerciais'],routes:['Rotas','Planejamento de campo'],visits:['Visitas','Histórico de contatos e visitas'],market:['Inteligência de Mercado','Soja, milho e sorgo'],territories:['Territórios & Scores','Priorização geográfica'],goals:['Metas & Campanhas','Gestão comercial']
  };
  let state={summary:null,accounts:[],opps:[],approvals:[],routes:[],visits:[],loaded:false,loading:false};

  function showView(name){
    if(!viewMeta[name])name='dashboard';
    $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
    $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    $('#pageTitle').textContent=viewMeta[name][0];$('#pageSubtitle').textContent=viewMeta[name][1];
    history.replaceState(null,'','#'+name);closeSidebar();
    if(['dashboard','prospecting','accounts','opportunities','approvals','routes','visits'].includes(name))loadCommercial();
  }
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));

  function openSidebar(){$('#sidebar').classList.add('open');$('#mobileOverlay').classList.add('open')}
  function closeSidebar(){$('#sidebar').classList.remove('open');$('#mobileOverlay').classList.remove('open')}
  $('#mobileMenu')?.addEventListener('click',openSidebar);$('#mobileOverlay')?.addEventListener('click',closeSidebar);
  const openModal=id=>$('#'+id)?.classList.add('open'),closeModal=id=>$('#'+id)?.classList.remove('open');
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));

  function syncUser(){const s=getSession();const logged=!!token();$('#userChip').textContent=logged?`${s?.name||'Usuário'} · ${s?.role||'perfil'}`:'Não autenticado';$('#loginBtn').hidden=logged;$('#logoutBtn').hidden=!logged;if(!logged){state={summary:null,accounts:[],opps:[],approvals:[],routes:[],visits:[],loaded:false,loading:false};renderCommercial()}}
  $('#loginBtn')?.addEventListener('click',()=>openModal('loginModal'));
  $('#logoutBtn')?.addEventListener('click',()=>{for(const k of [sessionKey,'allamo_session_token','token','allamo_token'])localStorage.removeItem(k);sessionStorage.removeItem('token');syncUser();showView('dashboard')});
  $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{const d=await api('login',{method:'POST',body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});const s={token:d.token||d.session_token,name:d.name||d.user?.name||$('#email').value.trim(),role:d.role||d.user?.role||'',company_id:d.company_id||d.company||d.user?.company_id||''};if(!s.token)throw new Error('Login concluído sem token de sessão.');if(!['admin','pmo'].includes(String(s.role).toLowerCase())&&!String(s.company_id||'').toLowerCase().includes('semeali'))throw new Error('Este acesso não pertence à Semeali.');setSession(s);closeModal('loginModal');syncUser();await loadCommercial(true);showView('dashboard')}catch(err){$('#loginError').textContent=err.message||'Falha no login.'}});

  function renderMarket(){
    const k=D.kpis||{};
    $('#marketKpis').innerHTML=[['Soja · produção',fmt(k.sojaMt)+' Mt','CONAB 2025/26'],['Milho · produção',fmt(k.milhoMt)+' Mt','CONAB 2025/26'],['Milho 2ª safra',fmt(k.milho2Mt)+' Mt','janela prioritária'],['Sorgo · produção',fmt(k.sorgoMt)+' Mt','base atual'],['Municípios-piloto',fmt(k.municipios),'estudo carregado']].map(x=>`<div class="card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="note">${x[2]}</div></div>`).join('');
    $('#rankings').innerHTML=['soja','milho','sorgo'].map(c=>`<div class="panel panel-pad"><div class="eyebrow" style="color:var(--green2)">${c.toUpperCase()}</div><h3 style="margin:6px 0 10px">Top territórios</h3>${(D.rankings?.[c]||[]).map((r,i)=>`<div style="display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1ed"><b>${i+1}</b><div><strong style="font-size:11px">${esc(r[0])}</strong><div><span class="badge">${esc(r[2])}</span></div></div><div class="score">${fmt(r[1])}</div></div>`).join('')}</div>`).join('');
    renderTerritories();renderProspectingTerritories();renderDashTerritories();
  }
  function territoryRows(){const q=($('#territorySearch')?.value||'').toLowerCase().trim(),crop=$('#cropFilter')?.value||'';return (D.territories||[]).filter(r=>(!q||(`${r.municipio} ${r.uf}`).toLowerCase().includes(q))&&(!crop||r.melhor===crop))}
  function renderTerritories(){$('#territoriesBody').innerHTML=territoryRows().map(r=>`<tr><td><strong>${esc(r.municipio)}</strong></td><td>${esc(r.uf)}</td><td>${esc(r.bioma)}</td><td>${r.pamSoja==null?'—':fmt(r.pamSoja)+' ha'}</td><td>${r.pamMilho==null?'—':fmt(r.pamMilho)+' ha'}</td><td>${r.pamSorgo==null?'Não informado':fmt(r.pamSorgo)+' ha'}</td><td class="score">${fmt(r.scoreSoja)}</td><td class="score">${fmt(r.scoreMilho)}</td><td class="score">${fmt(r.scoreSorgo)}</td><td><span class="badge high">${esc(r.melhor)}</span></td><td>${esc(r.acao)}</td></tr>`).join('')||'<tr><td colspan="11" class="empty">Nenhum território encontrado.</td></tr>'}
  $('#territorySearch')?.addEventListener('input',renderTerritories);$('#cropFilter')?.addEventListener('change',renderTerritories);
  function topTerritories(){return [...(D.territories||[])].sort((a,b)=>Math.max(b.scoreSoja,b.scoreMilho,b.scoreSorgo)-Math.max(a.scoreSoja,a.scoreMilho,a.scoreSorgo)).slice(0,5)}
  function renderDashTerritories(){$('#dashTerritories').innerHTML=topTerritories().map(r=>`<tr><td><strong>${esc(r.municipio)}/${esc(r.uf)}</strong></td><td>${esc(r.melhor)}</td><td class="score">${fmt(Math.max(r.scoreSoja,r.scoreMilho,r.scoreSorgo))}</td><td>${esc(r.acao||'Priorizar prospecção')}</td></tr>`).join('')}
  function renderProspectingTerritories(){$('#prospectingTerritories').innerHTML=topTerritories().slice(0,4).map(r=>`<div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 0;border-bottom:1px solid #edf1ed"><div><strong style="font-size:11px">${esc(r.municipio)}/${esc(r.uf)}</strong><div style="font-size:9px;color:var(--muted)">${esc(r.melhor)} · ${esc(r.acao||'Priorizar')}</div></div><span class="score">${fmt(Math.max(r.scoreSoja,r.scoreMilho,r.scoreSorgo))}</span></div>`).join('')}

  function lockedRow(cols,msg='Entre para carregar os dados comerciais.') {return `<tr><td colspan="${cols}" class="empty">${esc(msg)}</td></tr>`}
  function renderCommercial(){
    const logged=!!token(),s=state.summary;
    $('#dashboardKpis').innerHTML=[['Prospects',logged?(s?.prospects??0):'—','na carteira'],['Oportunidades',logged?(s?.open_opportunities??0):'—','em aberto'],['Pipeline',logged?money(s?.pipeline_value||0):'—','potencial'],['Visitas 30 dias',logged?(s?.visits_last_30_days??0):'—','realizadas'],['Aprovações',logged?(s?.pending_approvals??0):'—','pendentes']].map(x=>`<div class="card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="note">${x[2]}</div></div>`).join('');
    $('#todayBox').innerHTML=logged?`${Number(s?.pending_approvals||0)} aprovação(ões) pendente(s)<br>${Number(s?.open_opportunities||0)} oportunidade(s) aberta(s)<br>${Number(s?.visits_last_30_days||0)} visita(s) nos últimos 30 dias`:'Entre para carregar sua operação comercial.';
    $('#dashOpps').innerHTML=logged?(state.opps.slice(0,6).map(oppRowShort).join('')||lockedRow(5,'Nenhuma oportunidade aberta.')):lockedRow(5);
    $('#accountsBody').innerHTML=logged?(filteredAccounts().map(accountRow).join('')||lockedRow(7,'Nenhuma conta cadastrada.')):lockedRow(7);
    $('#opportunitiesBody').innerHTML=logged?(state.opps.map(oppRow).join('')||lockedRow(8,'Nenhuma oportunidade cadastrada.')):lockedRow(8);
    $('#approvalsBody').innerHTML=logged?(state.approvals.map(approvalRow).join('')||lockedRow(6,'Nenhuma aprovação encontrada.')):lockedRow(6);
    $('#routesBody').innerHTML=logged?(state.routes.map(routeRow).join('')||lockedRow(5,'Nenhuma rota cadastrada.')):lockedRow(5);
    $('#visitsBody').innerHTML=logged?(state.visits.map(visitRow).join('')||lockedRow(6,'Nenhuma visita registrada.')):lockedRow(6);
    renderFunnel();renderProspectingAccounts();fillOpportunityAccounts();
  }
  function filteredAccounts(){const q=($('#accountSearch')?.value||'').trim().toLowerCase();return state.accounts.filter(r=>!q||`${r.name} ${r.city||''} ${r.state||''}`.toLowerCase().includes(q))}
  $('#accountSearch')?.addEventListener('input',()=>renderCommercial());
  const accountRow=r=>`<tr><td><strong>${esc(r.name)}</strong></td><td><span class="badge">${esc(r.account_type||'—')}</span></td><td>${esc([r.city,r.state].filter(Boolean).join('/'))||'—'}</td><td>${esc((r.crops||[]).join(', '))||'—'}</td><td class="score">${fmt(r.score)}</td><td>${esc(r.owner||'—')}</td><td>${date(r.next_action_at)}</td></tr>`;
  const oppRowShort=r=>`<tr><td><strong>${esc(r.account_name||'—')}</strong></td><td>${esc(r.title)}</td><td>${esc(r.crop||'—')}</td><td><span class="badge dark">${stageLabel(r.stage)}</span></td><td>${r.potential_value==null?'—':money(r.potential_value)}</td></tr>`;
  const oppRow=r=>`<tr><td><strong>${esc(r.account_name||'—')}</strong></td><td>${esc(r.title)}</td><td>${esc(r.crop||'—')}</td><td><span class="badge dark">${stageLabel(r.stage)}</span></td><td class="score">${fmt(r.score)}</td><td>${r.potential_hectares==null?'—':fmt(r.potential_hectares)}</td><td>${r.potential_value==null?'—':money(r.potential_value)}</td><td>${esc(r.owner||'—')}</td></tr>`;
  const approvalRow=r=>`<tr><td><strong>${esc(r.account_name||r.account_id||'—')}</strong></td><td>${esc(r.opportunity_title||r.opportunity_id||'—')}</td><td>${esc(r.approval_type||r.type||'COMERCIAL')}</td><td><span class="badge ${String(r.status).toUpperCase()==='PENDING'?'warn':'high'}">${esc(r.status||'—')}</span></td><td>${esc(r.requested_by||r.created_by||'—')}</td><td>${date(r.created_at)}</td></tr>`;
  const routeRow=r=>`<tr><td><strong>${esc(r.name||r.title||'Rota')}</strong></td><td>${date(r.route_date||r.date)}</td><td><span class="badge">${esc(r.status||'—')}</span></td><td>${esc(r.owner||r.created_by||'—')}</td><td>${esc(r.notes||'—')}</td></tr>`;
  const visitRow=r=>`<tr><td>${date(r.occurred_at||r.created_at)}</td><td><strong>${esc(r.account_name||'—')}</strong></td><td><span class="badge">${esc(r.interaction_type||r.type||'CONTATO')}</span></td><td>${esc(r.opportunity_title||'—')}</td><td>${esc(r.owner||r.created_by||'—')}</td><td>${esc(r.notes||r.summary||'—')}</td></tr>`;
  function stageLabel(s){return ({MAPPED:'Mapeada',QUALIFIED:'Qualificada',CONTACT:'Contato',DIAGNOSIS:'Diagnóstico',PROPOSAL:'Proposta',NEGOTIATION:'Negociação',WON:'Ganha',LOST:'Perdida'})[s]||s||'—'}
  function renderFunnel(){const stages=[['MAPPED','Mapeadas'],['QUALIFIED','Qualificadas'],['CONTACT','Contato'],['PROPOSAL','Proposta'],['NEGOTIATION','Negociação']];$('#funnel').innerHTML=stages.map(([key,label])=>`<div class="stage"><div class="n">${token()?state.opps.filter(x=>x.stage===key).length:'—'}</div><div class="t">${label}</div></div>`).join('')}
  function renderProspectingAccounts(){if(!token()){$('#prospectingAccounts').className='empty';$('#prospectingAccounts').textContent='Entre para carregar prospects.';return}const rows=state.accounts.filter(x=>['PROSPECT','LEAD'].includes(String(x.account_type).toUpperCase())).slice(0,8);$('#prospectingAccounts').className='';$('#prospectingAccounts').innerHTML=rows.length?rows.map(r=>`<div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 0;border-bottom:1px solid #edf1ed"><div><strong style="font-size:11px">${esc(r.name)}</strong><div style="font-size:9px;color:var(--muted)">${esc([r.city,r.state].filter(Boolean).join('/'))||'Local não informado'} · ${esc(r.owner||'sem responsável')}</div></div><span class="badge">score ${fmt(r.score)}</span></div>`).join(''):'<div class="empty">Nenhum prospect cadastrado.</div>'}
  function fillOpportunityAccounts(){const sel=$('#oppAccount');if(!sel)return;sel.innerHTML='<option value="">Selecione...</option>'+state.accounts.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}${r.city?' · '+esc(r.city):''}</option>`).join('')}

  async function loadCommercial(force=false){
    if(!token()){renderCommercial();return}if(state.loading||(!force&&state.loaded))return;state.loading=true;
    try{const [summary,accounts,opps,approvals,routes,visits]=await Promise.all([api('commercial-summary?company='+company),api('commercial-accounts?company='+company),api('commercial-opportunities?company='+company+'&status=OPEN'),api('commercial-approvals?company='+company),api('commercial-routes?company='+company),api('commercial-interactions?company='+company)]);state={summary,accounts:accounts||[],opps:opps||[],approvals:approvals||[],routes:routes||[],visits:visits||[],loaded:true,loading:false};renderCommercial()}catch(err){state.loading=false;console.error(err);$('#todayBox').textContent=err.message||'Não foi possível carregar a operação comercial.';renderCommercial()}
  }

  function requireLogin(){if(token())return true;openModal('loginModal');return false}
  $('#newProspectBtn')?.addEventListener('click',()=>{if(requireLogin()){ $('#accountType').value='PROSPECT';openModal('accountModal')}});
  $('#newAccountBtn')?.addEventListener('click',()=>{if(requireLogin())openModal('accountModal')});
  $('#accountForm')?.addEventListener('submit',async e=>{e.preventDefault();$('#accountError').textContent='';try{const crops=$('#accountCrops').value.split(',').map(x=>x.trim()).filter(Boolean);await api('commercial-accounts',{method:'POST',body:JSON.stringify({company_id:company,name:$('#accountName').value.trim(),account_type:$('#accountType').value,city:$('#accountCity').value.trim(),state:$('#accountState').value.trim().toUpperCase(),score:Number($('#accountScore').value||0),crops,source:'Portal Comercial Semeali'})});e.target.reset();$('#accountScore').value='0';closeModal('accountModal');await loadCommercial(true);showView('accounts')}catch(err){$('#accountError').textContent=err.message||'Não foi possível salvar a conta.'}});
  $('#newOpportunityBtn')?.addEventListener('click',()=>{if(!requireLogin())return;if(!state.accounts.length){alert('Cadastre uma conta antes de criar uma oportunidade.');showView('accounts');return}fillOpportunityAccounts();openModal('opportunityModal')});
  $('#opportunityForm')?.addEventListener('submit',async e=>{e.preventDefault();$('#oppError').textContent='';try{await api('commercial-opportunities',{method:'POST',body:JSON.stringify({company_id:company,account_id:$('#oppAccount').value,title:$('#oppTitle').value.trim(),crop:$('#oppCrop').value,stage:$('#oppStage').value,potential_hectares:$('#oppHectares').value===''?null:Number($('#oppHectares').value),potential_value:$('#oppValue').value===''?null:Number($('#oppValue').value)})});e.target.reset();closeModal('opportunityModal');await loadCommercial(true);showView('opportunities')}catch(err){$('#oppError').textContent=err.message||'Não foi possível salvar a oportunidade.'}});

  renderMarket();syncUser();renderCommercial();const initial=(location.hash||'#dashboard').slice(1);showView(viewMeta[initial]?initial:'dashboard');
})();
