(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const sessionKey='allamo_session',company='semeali';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n,d=1)=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:0});
  const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  const dt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})};
  const date=v=>{if(!v)return '—';const d=new Date(v+'T12:00:00');return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})};
  const getSession=()=>{try{return JSON.parse(localStorage.getItem(sessionKey)||'null')}catch{return null}};
  const token=()=>getSession()?.token||localStorage.getItem('allamo_session_token')||localStorage.getItem('token')||localStorage.getItem('allamo_token')||sessionStorage.getItem('token')||'';
  const api=async(path,options={})=>{const headers={'content-type':'application/json',...(options.headers||{})};const t=token();if(t)headers.authorization='Bearer '+t;const response=await fetch('/api/'+path,{...options,headers,cache:'no-store'});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||('Erro '+response.status));return payload};
  const openModal=id=>$('#'+id)?.classList.add('open'),closeModal=id=>$('#'+id)?.classList.remove('open');
  const managerRoles=new Set(['admin','pmo','gestor','gerente','diretoria','techlead','comercial']);
  const liveState={market:null,weather:null,seller:null,marketLoading:false,weatherLoading:false,sellerLoading:false};

  function injectNavigation(){
    const firstNav=$('.sidebar .nav');
    if(firstNav&&!$('[data-live-view="seller"]'))firstNav.insertAdjacentHTML('beforeend','<button data-live-view="seller"><span class="ico">☷</span>Área do Vendedor <span class="tag">novo</span></button>');
    const territoryBtn=$('[data-view="territories"]');
    if(territoryBtn&&!$('[data-live-view="weather"]'))territoryBtn.insertAdjacentHTML('afterend','<button data-live-view="weather"><span class="ico">☁</span>Clima Agrícola <span class="tag">online</span></button>');
  }

  function injectViews(){
    const content=$('.content');if(!content)return;
    if(!$('#view-seller'))content.insertAdjacentHTML('beforeend',`<section class="view" id="view-seller">
      <div class="page-head"><div><h1>Área do Vendedor</h1><p id="sellerSubtitle">Meu dia, carteira, campo e oportunidades</p></div><div class="actions"><button class="btn" id="sellerRefresh">Atualizar</button></div></div>
      <div id="sellerLogin" class="panel panel-pad" hidden><div class="locked"><b>Entre para abrir sua área comercial</b><p>Carteira, oportunidades, visitas e rotas são carregadas do tenant Semeali.</p><button class="btn primary" id="sellerLoginBtn">Entrar</button></div></div>
      <div id="sellerContent">
        <div class="kpis" id="sellerKpis"></div>
        <div class="section seller-actions">
          <button data-seller-action="prospect">◎<b>Novo prospect</b><small>Cadastrar produtor, revenda ou cooperativa</small></button>
          <button data-seller-action="opportunity">↗<b>Nova oportunidade</b><small>Registrar potencial comercial</small></button>
          <button data-seller-action="visit">◉<b>Registrar visita</b><small>Salvar contato e próxima ação</small></button>
          <button data-seller-action="route">⌖<b>Criar rota</b><small>Planejar agenda de campo</small></button>
        </div>
        <div class="section seller-hero">
          <div class="seller-block"><div class="section-head"><div><h3>Prioridades comerciais</h3><p>Oportunidades e próximas ações atribuídas</p></div></div><div id="sellerPriorities" class="seller-list"></div></div>
          <div class="seller-block"><div class="section-head"><div><h3>Mercado & clima</h3><p>Sinais para preparar a abordagem</p></div></div><div id="sellerSignals" class="seller-list"></div></div>
        </div>
        <div class="section grid2">
          <div class="panel"><div class="panel-pad"><div class="section-head"><div><h3>Minha carteira</h3><p>Contas atribuídas ao vendedor</p></div></div></div><div class="table-wrap"><table><thead><tr><th>Conta</th><th>Local</th><th>Culturas</th><th>Score</th><th>Próxima ação</th></tr></thead><tbody id="sellerAccounts"></tbody></table></div></div>
          <div class="panel"><div class="panel-pad"><div class="section-head"><div><h3>Campo</h3><p>Visitas e rotas recentes</p></div></div><div id="sellerField" class="seller-list"></div></div>
        </div>
      </div>
    </section>`);
    if(!$('#view-weather'))content.insertAdjacentHTML('beforeend',`<section class="view" id="view-weather">
      <div class="page-head"><div><h1>Clima Agrícola</h1><p>Previsão de 7 dias para apoiar rotas, visitas e inteligência territorial</p></div><div class="actions"><button class="btn" id="weatherRefresh">Atualizar</button></div></div>
      <div class="panel panel-pad"><div class="weather-search"><label>Cidade<input id="weatherCity" value="Araçatuba" /></label><label>UF<input id="weatherState" value="SP" maxlength="2" /></label><button class="btn primary" id="weatherSearch">Carregar previsão</button><span class="live-status" id="weatherStatus">Open-Meteo</span></div></div>
      <div class="section live-grid" id="weatherKpis"></div>
      <div class="section panel panel-pad"><div class="section-head"><div><h3>Próximos 7 dias</h3><p id="weatherLocation">—</p></div></div><div class="weather-days" id="weatherDays"></div></div>
      <div class="section callout" id="weatherSignal">Carregando sinal operacional...</div>
    </section>`);
    if(!$('#marketLivePanel')){
      const market=$('#view-market');
      const head=market?.querySelector('.page-head');
      head?.insertAdjacentHTML('afterend',`<div class="section" id="marketLivePanel"><div class="section-head"><div><h3>Mercado agora</h3><p>Soja e milho CBOT, dólar/real e referência de contexto para sorgo</p></div><div class="live-strip"><span class="live-status warn">indicativo / pode ter atraso</span><button class="btn" id="marketRefresh">Atualizar</button></div></div><div class="live-grid" id="marketQuotes"></div><div class="section market-insights" id="marketInsights"></div><div class="live-meta" id="marketMeta"></div></div>`);
    }
  }

  function injectModals(){
    if(!$('#visitModal'))document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="visitModal"><div class="modal-card"><h2>Registrar visita</h2><p>Salve a interação de campo e a próxima ação.</p><form id="visitForm" class="form"><label class="full">Conta<select id="visitAccount" required></select></label><label>Tipo<select id="visitType"><option value="VISIT">Visita</option><option value="TECHNICAL_VISIT">Visita técnica</option><option value="CALL">Ligação</option><option value="WHATSAPP">WhatsApp</option></select></label><label>Data e hora<input id="visitWhen" type="datetime-local" /></label><label class="full">Resumo<textarea id="visitSummary" rows="4" required></textarea></label><label>Próxima ação<input id="visitNext" placeholder="Ex.: enviar proposta" /></label><label>Data próxima ação<input id="visitNextAt" type="date" /></label><input id="visitLat" type="hidden"/><input id="visitLon" type="hidden"/><div class="full live-strip"><button class="btn" type="button" id="visitLocation">Usar minha localização</button><span class="live-meta" id="visitLocationStatus">Localização opcional.</span></div><div class="full error" id="visitError"></div><div class="full modal-actions"><button class="btn" type="button" data-live-close="visitModal">Cancelar</button><button class="btn primary" type="submit">Salvar visita</button></div></form></div></div>`);
    if(!$('#routeModal'))document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="routeModal"><div class="modal-card"><h2>Criar rota</h2><p>Selecione as contas que farão parte da agenda de campo.</p><form id="routeForm" class="form"><label class="full">Nome da rota<input id="routeName" required placeholder="Ex.: Araçatuba Norte" /></label><label>Data<input id="routeDate" type="date" required /></label><label class="full">Contas<select id="routeAccounts" class="multi-select" multiple></select></label><label class="full">Observações<textarea id="routeNotes" rows="3"></textarea></label><div class="full error" id="routeError"></div><div class="full modal-actions"><button class="btn" type="button" data-live-close="routeModal">Cancelar</button><button class="btn primary" type="submit">Criar rota</button></div></form></div></div>`);
  }

  function showLive(name){
    $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
    $$('[data-view]').forEach(b=>b.classList.remove('active'));
    $$('[data-live-view]').forEach(b=>b.classList.toggle('active',b.dataset.liveView===name));
    const meta=name==='seller'?['Área do Vendedor','Meu dia, carteira e campo']:['Clima Agrícola','Previsão para a operação comercial'];
    $('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];
    history.replaceState(null,'','#'+name);$('#sidebar')?.classList.remove('open');$('#mobileOverlay')?.classList.remove('open');
    if(name==='seller')loadSeller(true);if(name==='weather')loadWeather(true);
  }

  function bindNavigation(){
    $$('[data-live-view]').forEach(b=>b.addEventListener('click',()=>showLive(b.dataset.liveView)));
    document.addEventListener('click',e=>{if(e.target.closest('[data-view]'))$$('[data-live-view]').forEach(b=>b.classList.remove('active'))});
  }

  const quoteValue=q=>q.status!=='ok'||q.price==null?'—':(q.id==='usdbrl'?fmt(q.price,4):fmt(q.price,2));
  const quoteChange=q=>q.status!=='ok'||q.change_pct==null?'indisponível':`${q.change_pct>=0?'+':''}${fmt(q.change_pct,2)}%`;
  async function loadMarket(force=false){
    if(liveState.marketLoading||(!force&&liveState.market))return liveState.market;liveState.marketLoading=true;
    $('#marketQuotes')&&( $('#marketQuotes').innerHTML='<div class="empty">Carregando mercado...</div>' );
    try{
      const data=await api('semeali-live-market');liveState.market=data;renderMarketLive(data);return data;
    }catch(err){
      $('#marketQuotes')&&( $('#marketQuotes').innerHTML=`<div class="live-error">${esc(err.message||'Mercado temporariamente indisponível.')}</div>` );
      $('#marketMeta')&&( $('#marketMeta').textContent='O restante do portal continua disponível.' );return null;
    }finally{liveState.marketLoading=false}
  }
  function renderMarketLive(data){
    const quotes=data?.quotes||[];
    $('#marketQuotes').innerHTML=quotes.map(q=>`<div class="live-quote"><div class="live-label">${esc(q.label)}</div><div class="live-value">${quoteValue(q)}</div><div class="live-change ${Number(q.change_pct)>0?'up':Number(q.change_pct)<0?'down':''}">${esc(quoteChange(q))}</div><div class="live-meta">${esc(q.unit||'')} ${q.proxy?'· proxy de contexto':''}<br>${q.market_time?'Atualização '+esc(dt(q.market_time)):'Fonte indisponível'}</div></div>`).join('');
    $('#marketInsights').innerHTML=(data?.insights||[]).map(x=>`<div class="market-insight"><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`).join('');
    $('#marketMeta').textContent=`Fonte: ${data?.provider||'—'} · atualização do painel ${dt(data?.as_of)}. ${data?.notice||''}`;
    renderSellerSignals();
  }

  const weatherLabel=code=>({0:'Céu limpo',1:'Predomínio de sol',2:'Parcialmente nublado',3:'Nublado',45:'Neblina',48:'Neblina',51:'Garoa',53:'Garoa',55:'Garoa forte',61:'Chuva fraca',63:'Chuva',65:'Chuva forte',80:'Pancadas',81:'Pancadas',82:'Pancadas fortes',95:'Trovoadas',96:'Trovoadas',99:'Trovoadas fortes'})[Number(code)]||'Condição variável';
  async function loadWeather(force=false){
    if(liveState.weatherLoading)return liveState.weather;
    const city=($('#weatherCity')?.value||localStorage.getItem('semeali_weather_city')||'Araçatuba').trim();
    const state=($('#weatherState')?.value||localStorage.getItem('semeali_weather_state')||'SP').trim().toUpperCase();
    if(!force&&liveState.weather&&liveState.weather._key===city+'|'+state)return liveState.weather;
    liveState.weatherLoading=true;$('#weatherStatus')&&( $('#weatherStatus').textContent='Atualizando...' );
    try{
      const data=await api('semeali-weather?city='+encodeURIComponent(city)+'&state='+encodeURIComponent(state));data._key=city+'|'+state;liveState.weather=data;localStorage.setItem('semeali_weather_city',city);localStorage.setItem('semeali_weather_state',state);renderWeather(data);return data;
    }catch(err){
      $('#weatherKpis')&&( $('#weatherKpis').innerHTML=`<div class="live-error">${esc(err.message||'Previsão temporariamente indisponível.')}</div>` );$('#weatherStatus')&&( $('#weatherStatus').textContent='indisponível' );return null;
    }finally{liveState.weatherLoading=false}
  }
  function renderWeather(data){
    const c=data?.current||{},a=data?.agriculture||{},loc=data?.location||{};
    $('#weatherCity')&&($('#weatherCity').value=loc.name||$('#weatherCity').value);$('#weatherState')&&($('#weatherState').value=($('#weatherState').value||'SP').toUpperCase());
    $('#weatherStatus').textContent=`${data?.provider||'Clima'} · ${dt(data?.as_of)}`;
    $('#weatherLocation').textContent=`${loc.name||'—'} · ${loc.state||'—'} · ${Number(loc.latitude).toFixed(3)}, ${Number(loc.longitude).toFixed(3)}`;
    $('#weatherKpis').innerHTML=[['Temperatura',c.temperature_2m==null?'—':fmt(c.temperature_2m,1)+' °C',weatherLabel(c.weather_code)],['Umidade',c.relative_humidity_2m==null?'—':fmt(c.relative_humidity_2m,0)+'%','agora'],['Chuva 7 dias',fmt(a.rain_7d_mm,1)+' mm','prob. máx. '+fmt(a.max_precip_probability_7d,0)+'%'],['Vento',c.wind_speed_10m==null?'—':fmt(c.wind_speed_10m,1)+' km/h','rajada '+fmt(c.wind_gusts_10m,1)+' km/h'],['Umidade do solo',c.soil_moisture_0_to_1cm==null?'—':fmt(c.soil_moisture_0_to_1cm,3)+' m³/m³','superfície 0–1 cm']].map(x=>`<div class="live-quote"><div class="live-label">${esc(x[0])}</div><div class="live-value">${esc(x[1])}</div><div class="live-meta">${esc(x[2])}</div></div>`).join('');
    $('#weatherDays').innerHTML=(data?.daily||[]).map(d=>`<div class="weather-day"><strong>${esc(date(d.date))}</strong><div class="temp">${fmt(d.temp_max,0)}° / ${fmt(d.temp_min,0)}°</div><div class="mini">${esc(weatherLabel(d.weather_code))}<br>Chuva: ${fmt(d.precipitation_sum,1)} mm · ${fmt(d.precipitation_probability_max,0)}%<br>Vento: ${fmt(d.wind_speed_max,0)} km/h<br>ET₀: ${fmt(d.et0,1)} mm</div></div>`).join('');
    $('#weatherSignal').textContent=(a.operational_signal||'')+' '+(data?.notice||'');renderSellerSignals();
  }

  const same=(a,b)=>String(a||'').trim().toLocaleLowerCase('pt-BR')===String(b||'').trim().toLocaleLowerCase('pt-BR');
  const belongs=(row,userName,isManager)=>isManager||[row.owner,row.actor,row.created_by,row.updated_by].some(v=>same(v,userName));
  async function loadSeller(force=false){
    const logged=!!token();$('#sellerLogin').hidden=logged;$('#sellerContent').hidden=!logged;if(!logged)return;
    if(liveState.sellerLoading||(!force&&liveState.seller))return;liveState.sellerLoading=true;
    try{
      const [summary,accounts,opps,approvals,routes,visits]=await Promise.all([api('commercial-summary?company='+company),api('commercial-accounts?company='+company),api('commercial-opportunities?company='+company+'&status=OPEN'),api('commercial-approvals?company='+company),api('commercial-routes?company='+company),api('commercial-interactions?company='+company)]);
      const session=getSession()||{},name=session.name||'',isManager=managerRoles.has(String(session.role||'').toLowerCase());
      const ownAccounts=(accounts||[]).filter(x=>belongs(x,name,isManager));const ownOpps=(opps||[]).filter(x=>belongs(x,name,isManager));const ownApprovals=(approvals||[]).filter(x=>belongs(x,name,isManager));const ownRoutes=(routes||[]).filter(x=>belongs(x,name,isManager));const ownVisits=(visits||[]).filter(x=>belongs(x,name,isManager));
      liveState.seller={summary,accounts:ownAccounts,allAccounts:accounts||[],opps:ownOpps,approvals:ownApprovals,routes:ownRoutes,visits:ownVisits,isManager,name,role:session.role||''};renderSeller();
      await Promise.all([loadMarket(false),loadWeather(false)]);
    }catch(err){$('#sellerPriorities').innerHTML=`<div class="live-error">${esc(err.message||'Não foi possível carregar a área do vendedor.')}</div>`}finally{liveState.sellerLoading=false}
  }
  function renderSeller(){
    const s=liveState.seller;if(!s)return;
    $('#sellerSubtitle').textContent=s.isManager?'Visão da equipe comercial e prioridades do dia':`Operação atribuída a ${s.name||'vendedor'}`;
    const pipeline=s.opps.reduce((sum,x)=>sum+Number(x.potential_value||0),0),pending=s.approvals.filter(x=>String(x.status).toUpperCase()==='PENDING').length,visits30=s.visits.filter(x=>new Date(x.occurred_at||x.created_at)>=new Date(Date.now()-30*86400000)).length;
    $('#sellerKpis').innerHTML=[['Carteira',s.accounts.length,'contas atribuídas'],['Oportunidades',s.opps.length,'em aberto'],['Pipeline',money(pipeline),'potencial'],['Visitas 30 dias',visits30,'registradas'],['Aprovações',pending,'pendentes']].map(x=>`<div class="card"><div class="label">${esc(x[0])}</div><div class="value">${esc(x[1])}</div><div class="note">${esc(x[2])}</div></div>`).join('');
    const priorities=[...s.opps].sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,6);
    $('#sellerPriorities').innerHTML=priorities.length?priorities.map(x=>`<div class="seller-row"><div><b>${esc(x.account_name||x.title||'Oportunidade')}</b><small>${esc(x.title||'')} · ${esc(x.crop||'—')} · ${esc(x.stage||'—')}</small></div><span class="badge high">score ${fmt(x.score,0)}</span></div>`).join(''):'<div class="empty">Nenhuma oportunidade atribuída.</div>';
    $('#sellerAccounts').innerHTML=s.accounts.length?s.accounts.slice(0,15).map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc([x.city,x.state].filter(Boolean).join('/'))||'—'}</td><td>${esc((x.crops||[]).join(', '))||'—'}</td><td class="score">${fmt(x.score,0)}</td><td>${x.next_action_at?esc(dt(x.next_action_at)):'—'}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Nenhuma conta atribuída ao usuário.</td></tr>';
    const field=[...s.routes.slice(0,3).map(x=>({title:x.name||'Rota',sub:`Rota · ${x.route_date||'sem data'}`,badge:x.status||'PLANNED'})),...s.visits.slice(0,4).map(x=>({title:x.account_name||'Visita',sub:`${x.interaction_type||'VISIT'} · ${dt(x.occurred_at||x.created_at)}`,badge:'campo'}))];
    $('#sellerField').innerHTML=field.length?field.map(x=>`<div class="seller-row"><div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div><span class="badge">${esc(x.badge)}</span></div>`).join(''):'<div class="empty">Sem atividade de campo registrada.</div>';
    fillSellerForms();renderSellerSignals();
  }
  function renderSellerSignals(){const box=$('#sellerSignals');if(!box)return;const market=liveState.market,weather=liveState.weather;const soy=market?.quotes?.find(x=>x.id==='soy'),corn=market?.quotes?.find(x=>x.id==='corn'),w=weather?.agriculture;box.innerHTML=[{t:'Soja CBOT',s:soy?.status==='ok'?`${quoteValue(soy)} · ${quoteChange(soy)}`:'Aguardando mercado'},{t:'Milho CBOT',s:corn?.status==='ok'?`${quoteValue(corn)} · ${quoteChange(corn)}`:'Aguardando mercado'},{t:weather?.location?.name?'Clima · '+weather.location.name:'Clima',s:w?`${fmt(w.rain_7d_mm,1)} mm em 7 dias · prob. máx. ${fmt(w.max_precip_probability_7d,0)}%`:'Aguardando previsão'}].map(x=>`<div class="seller-row"><div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div></div>`).join('')}
  function fillSellerForms(){const s=liveState.seller;if(!s)return;const rows=s.allAccounts||s.accounts||[];const options='<option value="">Selecione...</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.city?' · '+esc(x.city):''}</option>`).join('');$('#visitAccount')&&($('#visitAccount').innerHTML=options);$('#routeAccounts')&&($('#routeAccounts').innerHTML=rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.city?' · '+esc(x.city):''}</option>`).join(''))}

  function bindActions(){
    $('#marketRefresh')?.addEventListener('click',()=>loadMarket(true));$('#weatherRefresh')?.addEventListener('click',()=>loadWeather(true));$('#weatherSearch')?.addEventListener('click',()=>loadWeather(true));$('#sellerRefresh')?.addEventListener('click',()=>loadSeller(true));$('#sellerLoginBtn')?.addEventListener('click',()=>$('#loginBtn')?.click());
    $$('[data-live-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.liveClose)));
    $$('[data-seller-action]').forEach(b=>b.addEventListener('click',()=>{const action=b.dataset.sellerAction;if(!token()){ $('#loginBtn')?.click();return }if(action==='prospect'){document.querySelector('#newProspectBtn')?.click()||document.querySelector('[data-view="prospecting"]')?.click()}else if(action==='opportunity'){document.querySelector('#newOpportunityBtn')?.click()||document.querySelector('[data-view="opportunities"]')?.click()}else if(action==='visit'){fillSellerForms();const now=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);$('#visitWhen').value=now;openModal('visitModal')}else if(action==='route'){fillSellerForms();$('#routeDate').value=new Date().toISOString().slice(0,10);openModal('routeModal')}}));
    $('#visitLocation')?.addEventListener('click',()=>{if(!navigator.geolocation){$('#visitLocationStatus').textContent='Geolocalização não disponível.';return}$('#visitLocationStatus').textContent='Obtendo localização...';navigator.geolocation.getCurrentPosition(p=>{$('#visitLat').value=p.coords.latitude;$('#visitLon').value=p.coords.longitude;$('#visitLocationStatus').textContent=`Localização capturada · precisão ~${Math.round(p.coords.accuracy)} m`},()=>{$('#visitLocationStatus').textContent='Não foi possível obter a localização.'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})});
    $('#visitForm')?.addEventListener('submit',async e=>{e.preventDefault();$('#visitError').textContent='';try{await api('commercial-interactions',{method:'POST',body:JSON.stringify({company_id:company,account_id:$('#visitAccount').value,interaction_type:$('#visitType').value,occurred_at:$('#visitWhen').value?new Date($('#visitWhen').value).toISOString():new Date().toISOString(),summary:$('#visitSummary').value.trim(),next_action:$('#visitNext').value.trim()||null,next_action_at:$('#visitNextAt').value||null,latitude:$('#visitLat').value||null,longitude:$('#visitLon').value||null})});e.target.reset();closeModal('visitModal');liveState.seller=null;await loadSeller(true)}catch(err){$('#visitError').textContent=err.message||'Não foi possível salvar a visita.'}});
    $('#routeForm')?.addEventListener('submit',async e=>{e.preventDefault();$('#routeError').textContent='';try{const account_ids=[...$('#routeAccounts').selectedOptions].map(x=>x.value);await api('commercial-routes',{method:'POST',body:JSON.stringify({company_id:company,name:$('#routeName').value.trim(),route_date:$('#routeDate').value,account_ids,notes:$('#routeNotes').value.trim()||null})});e.target.reset();closeModal('routeModal');liveState.seller=null;await loadSeller(true)}catch(err){$('#routeError').textContent=err.message||'Não foi possível criar a rota.'}});
  }

  injectNavigation();injectViews();injectModals();bindNavigation();bindActions();
  const savedCity=localStorage.getItem('semeali_weather_city'),savedState=localStorage.getItem('semeali_weather_state');if(savedCity&&$('#weatherCity'))$('#weatherCity').value=savedCity;if(savedState&&$('#weatherState'))$('#weatherState').value=savedState;
  loadMarket(false);loadWeather(false);
  setInterval(()=>loadMarket(true),300000);
})();
