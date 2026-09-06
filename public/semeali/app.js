(()=>{
  const D=window.SEMEALI_MARKET_DATA||{};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
  const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cls=p=>String(p||'').includes('MÁX')?'max':String(p||'').includes('ALTA')?'high':String(p||'').includes('MÉD')?'mid':'sel';
  const sessionKey='allamo_session';
  const getSession=()=>{try{return JSON.parse(localStorage.getItem(sessionKey)||'null')}catch{return null}};
  const setSession=s=>localStorage.setItem(sessionKey,JSON.stringify(s));
  const token=()=>getSession()?.token||localStorage.getItem('allamo_session_token')||localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||'';
  const api=async(path,options={})=>{
    const headers={'content-type':'application/json',...(options.headers||{})};const t=token();if(t)headers.authorization='Bearer '+t;
    const r=await fetch('/api/'+path,{...options,headers,cache:'no-store'});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('Erro '+r.status));return d;
  };
  const go=tab=>{ $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+tab)); history.replaceState(null,'','#'+tab); if(tab==='prospecting')loadCrm(); };
  $$('.tab').forEach(b=>b.addEventListener('click',()=>go(b.dataset.tab))); $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

  function renderMarket(){
    const k=D.kpis||{};
    $('#overviewKpis').innerHTML=[
      ['Municípios-piloto',fmt(k.municipios),'base atual'],['Soja PAM mapeada',fmt(k.sojaHa/1e6)+' Mha','11 municípios'],['Milho PAM mapeado',fmt(k.milhoHa/1e6)+' Mha','11 municípios'],['Sorgo confirmado',fmt(k.sorgoHa/1000)+' mil ha','dado conhecido na base']
    ].map(x=>`<div class="kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="note">${x[2]}</div></div>`).join('');
    $('#marketKpis').innerHTML=[
      ['Soja · produção',fmt(k.sojaMt)+' Mt','CONAB 2025/26'],['Milho · produção',fmt(k.milhoMt)+' Mt','CONAB 2025/26'],['Milho 2ª safra',fmt(k.milho2Mt)+' Mt','janela prioritária'],['Sorgo · produção',fmt(k.sorgoMt)+' Mt','patamar nacional informado na base']
    ].map(x=>`<div class="kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="note">${x[2]}</div></div>`).join('');
    $('#thesisBody').innerHTML=(D.thesis||[]).map(r=>`<tr><td><strong>${esc(r.territorio)}</strong></td><td class="score">${fmt(r.score)}</td><td>${esc(r.cultura)}</td><td>${esc(r.fato)}</td><td>${esc(r.tese)}</td><td>${esc(r.produto)}</td><td>${esc(r.canal)}</td><td><span class="badge ${cls(r.prioridade)}">${esc(r.prioridade)}</span></td></tr>`).join('');
    $('#rankings').innerHTML=['soja','milho','sorgo'].map(c=>`<div class="panel"><div class="panel-pad"><div class="eyebrow" style="color:var(--green2)">${c.toUpperCase()}</div><h2 style="margin:6px 0 12px">Top 5 territórios</h2>${(D.rankings?.[c]||[]).map((r,i)=>`<div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eef1ee"><strong>${i+1}</strong><div><strong>${esc(r[0])}</strong><div style="font-size:10px;color:var(--muted)"><span class="badge ${cls(r[2])}">${esc(r[2])}</span></div></div><div class="score">${fmt(r[1])}</div></div>`).join('')}</div></div>`).join('');
    $('#roadmapBody').innerHTML=(D.roadmap||[]).map(r=>`<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td><span class="badge ${r[3]==='EM ANDAMENTO'?'high':'sel'}">${esc(r[3])}</span></td></tr>`).join('');
    renderTerritories();
  }
  function renderTerritories(){
    const q=($('#territorySearch')?.value||'').toLowerCase().trim(), crop=$('#cropFilter')?.value||'';
    const rows=(D.territories||[]).filter(r=>(!q||(`${r.municipio} ${r.uf}`).toLowerCase().includes(q))&&(!crop||r.melhor===crop));
    $('#territoriesBody').innerHTML=rows.map(r=>`<tr><td><strong>${esc(r.municipio)}</strong></td><td>${esc(r.uf)}</td><td>${esc(r.bioma)}</td><td>${r.pamSoja==null?'—':fmt(r.pamSoja)+' ha'}</td><td>${r.pamMilho==null?'—':fmt(r.pamMilho)+' ha'}</td><td>${r.pamSorgo==null?'Não informado':fmt(r.pamSorgo)+' ha'}</td><td class="score">${fmt(r.scoreSoja)}</td><td class="score">${fmt(r.scoreMilho)}</td><td class="score">${fmt(r.scoreSorgo)}</td><td><span class="badge ${cls(r.prioridade)}">${esc(r.melhor)}</span></td><td>${esc(r.acao)}</td></tr>`).join('')||'<tr><td colspan="11" class="empty">Nenhum território encontrado.</td></tr>';
  }
  $('#territorySearch')?.addEventListener('input',renderTerritories);$('#cropFilter')?.addEventListener('change',renderTerritories);

  function syncUser(){
    const s=getSession(); const logged=!!token();
    $('#userChip').textContent=logged?`${s?.name||'Usuário'} · ${s?.role||'perfil'}`:'Acesso não autenticado';
    $('#loginBtn').hidden=logged;$('#logoutBtn').hidden=!logged;
    if(!logged){$('#crmLocked').hidden=false;$('#crmLive').hidden=true;}
  }
  $('#loginBtn').addEventListener('click',()=>$('#loginModal').classList.add('open'));$('#closeLogin').addEventListener('click',()=>$('#loginModal').classList.remove('open'));
  $('#logoutBtn').addEventListener('click',()=>{localStorage.removeItem(sessionKey);localStorage.removeItem('allamo_session_token');localStorage.removeItem('token');localStorage.removeItem('allamo_token');sessionStorage.removeItem('token');syncUser();go('overview')});
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('#loginError').textContent='';
    try{
      const d=await api('login',{method:'POST',body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});
      const s={token:d.token||d.session_token,name:d.name||d.user?.name||$('#email').value.trim(),role:d.role||d.user?.role||'',company_id:d.company_id||d.company||d.user?.company_id||''};
      if(!s.token)throw new Error('Login concluído sem token de sessão.');setSession(s);$('#loginModal').classList.remove('open');syncUser();await loadCrm();go('prospecting');
    }catch(err){$('#loginError').textContent=err.message||'Falha no login.'}
  });

  let crmLoading=false;
  async function validateTenantAccess(){
    const s=getSession()||{};const role=String(s.role||'').toLowerCase();
    if(['admin','pmo'].includes(role))return true;
    const company=String(s.company_id||s.company||'').toLowerCase();return company==='semeali'||company.includes('semeali');
  }
  async function loadCrm(){
    if(crmLoading)return;if(!token()){syncUser();return}crmLoading=true;
    try{
      if(!(await validateTenantAccess()))throw new Error('Este usuário não pertence ao tenant Semeali.');
      const company='semeali';
      const [sum,accounts,opps,approvals,routes]=await Promise.all([
        api('commercial-summary?company='+company),api('commercial-accounts?company='+company),api('commercial-opportunities?company='+company+'&status=OPEN'),api('commercial-approvals?company='+company),api('commercial-routes?company='+company)
      ]);
      $('#crmLocked').hidden=true;$('#crmLive').hidden=false;
      $('#crmKpis').innerHTML=[['Contas ativas',sum.accounts,'carteira'],['Prospects',sum.prospects,'mapeados'],['Oportunidades',sum.open_opportunities,'em aberto'],['Pipeline',money(sum.pipeline_value),'potencial informado']].map(x=>`<div class="kpi"><div class="label">${x[0]}</div><div class="value">${esc(x[1])}</div><div class="note">${x[2]}</div></div>`).join('');
      $('#accountsBody').innerHTML=(accounts||[]).slice(0,30).map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${esc(r.account_type)}</td><td>${esc([r.city,r.state].filter(Boolean).join('/'))||'—'}</td><td class="score">${fmt(r.score)}</td><td>${esc(r.owner||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma conta cadastrada.</td></tr>';
      $('#oppsBody').innerHTML=(opps||[]).slice(0,30).map(r=>`<tr><td><strong>${esc(r.account_name)}</strong></td><td>${esc(r.title)}</td><td>${esc(r.crop||'—')}</td><td>${esc(r.stage)}</td><td>${r.potential_value==null?'—':money(r.potential_value)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma oportunidade aberta.</td></tr>';
      const pending=(approvals||[]).filter(x=>x.status==='PENDING');$('#approvalsBox').innerHTML=pending.length?`<strong>${pending.length}</strong> solicitação(ões) pendente(s) de decisão.`:'Nenhuma aprovação pendente.';
      $('#routesBox').innerHTML=(routes||[]).length?`<strong>${routes.length}</strong> rota(s) cadastrada(s). Última: ${esc(routes[0].name||'—')} · ${esc(routes[0].route_date||'—')}`:'Nenhuma rota cadastrada.';
    }catch(err){$('#crmLocked').hidden=false;$('#crmLive').hidden=true;$('#crmLocked').textContent=err.message||'Não foi possível carregar o CRM.'}
    finally{crmLoading=false}
  }
  $('#refreshCrm').addEventListener('click',loadCrm);
  $('#newProspectBtn').addEventListener('click',async()=>{
    if(!token()){ $('#loginModal').classList.add('open'); return; }
    const name=prompt('Nome do prospect / conta:');if(!name)return;const city=prompt('Cidade:')||'';const state=(prompt('UF:')||'').toUpperCase();
    try{await api('commercial-accounts',{method:'POST',body:JSON.stringify({company_id:'semeali',name,account_type:'PROSPECT',city,state,score:0,source:'Portal Semeali'})});await loadCrm();alert('Prospect cadastrado com sucesso.')}catch(err){alert(err.message||'Falha ao cadastrar prospect.')}
  });

  renderMarket();syncUser();const initial=(location.hash||'#overview').slice(1);if(['overview','market','territories','prospecting','roadmap'].includes(initial))go(initial);else go('overview');
})();
