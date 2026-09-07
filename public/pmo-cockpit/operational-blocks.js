(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metricValue=m=>m&&m.available?m.value:'Não disponível';
  const metricNote=(m,fallback='')=>m&&m.available?fallback:(m?.reason||'Fonte não disponível.');
  const fmtDate=v=>{if(!v)return 'Não disponível';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})};
  const card=(label,m,note='',format='plain')=>{
    let value=metricValue(m);
    if(m?.available&&format==='hours')value=`${Number(value||0).toLocaleString('pt-BR',{maximumFractionDigits:2})} h`;
    if(m?.available&&format==='date')value=fmtDate(value);
    return `<article class="card kpi"><div class="label">${esc(label)}</div><div class="value" style="font-size:26px">${esc(value)}</div><div class="note">${esc(metricNote(m,note))}</div></article>`;
  };
  const section=(title,description,body)=>`<section class="section pmo-op-section"><div class="section-head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>${body}</section>`;
  const grid=cards=>`<div class="grid">${cards.join('')}</div>`;
  const findHealth=()=>[...document.querySelectorAll('.section h2')].find(h=>/saúde dos projetos/i.test(h.textContent||''))?.closest('.section');

  function render(data){
    document.getElementById('pmoOperationalBlocks')?.remove();
    const host=document.createElement('div');host.id='pmoOperationalBlocks';
    const m=data.management||{},c=data.capacity||{},g=data.governance||{},a=data.adoption||{};
    const management=section('Gestão e riscos','Sinais operacionais vindos de Work Management, governança e leitura PMO. Métricas sem fonte estruturada permanecem indisponíveis.',grid([
      card('Itens bloqueados',m.blocked_items,'Work Management em aberto'),
      card('Ações vencidas',m.overdue_actions,'Itens em aberto com prazo vencido'),
      card('Dependências',m.dependencies,'Vínculos tipados como dependência'),
      card('Decisões pendentes',m.open_decisions,'Decisões de governança ainda abertas'),
      card('Projetos críticos',m.critical_projects,'Leitura PMO explicitamente crítica'),
      card('Riscos críticos estruturados',m.structured_critical_risks)
    ]));
    const capacity=section('Capacidade e horas','Planejamento e realizado usam somente fontes persistidas. O consolidado realizado é deduplicado para não contar a mesma entrada física duas vezes.',grid([
      card('Horas planejadas',c.planned_hours,'Soma de estimativas dos itens de trabalho','hours'),
      card('Horas realizadas',c.actual_hours,'FCH mapeado aos projetos atuais e deduplicado','hours'),
      card('Capacidade de sprint',c.sprint_capacity_hours,'Capacidade declarada em sprints não encerradas','hours'),
      card('Pessoas com horas',c.people_with_actual_hours,'Pessoas distintas no FCH válido'),
      card('Utilização por profissional',c.utilization)
    ])+`<div class="pill" style="margin-top:12px"><strong>Regra:</strong> ${esc(c.no_double_count_rule||'Sem dupla contagem no consolidado.')}</div>`);
    const rites=g.next_rites?.available?(g.next_rites.items||[]):[];
    const ritesHtml=g.next_rites?.available?(rites.length?`<div class="panel" style="margin-top:12px;padding:14px"><strong>Próximos ritos/checkpoints</strong>${rites.map(r=>`<div style="padding:10px 0;border-bottom:1px solid #eee9e1"><strong>${esc(r.title||r.event_type||'Rito')}</strong><div class="sub">${esc(fmtDate(r.start_at))} · ${esc(r.status||'Não informado')}</div></div>`).join('')}</div>`:`<div class="panel empty" style="margin-top:12px">Nenhum rito futuro registrado.</div>`):`<div class="panel empty" style="margin-top:12px">${esc(g.next_rites?.reason||'Agenda de governança não disponível.')}</div>`;
    const governance=section('Governança','Status Reports, DoR/DoD, pendências críticas e agenda; sem inventar SLA de atualização.',grid([
      card('Último Status Report',g.latest_report_at,'Última atualização encontrada','date'),
      card('Projetos sem report',g.projects_without_report,'Projetos sem Status Report persistido'),
      card('DoR registrados',g.dor_documents,'Documentos de Definition of Ready'),
      card('DoD registrados',g.dod_documents,'Documentos de Definition of Done'),
      card('Pendências críticas',g.critical_pending,'Pendências registradas em DoR/DoD'),
      card('SLA de atualização',g.report_freshness_policy)
    ])+ritesHtml);
    const adoption=section('Adoção e telemetria','Estrutura preparada para o mapa de calor sem transformar eventos operacionais parciais em métricas fictícias de adoção.',grid([
      card('Mapa de calor',a.heatmap),
      card('Eventos Work Management',a.work_management_events,'Eventos operacionais persistidos'),
      card('Último evento operacional',a.last_work_management_event_at,'Work Management','date')
    ])+`<div class="pill" style="margin-top:12px">${esc(a.scope_note||'Telemetria global ainda não integrada.')}</div>`);
    host.innerHTML=management+capacity+governance+adoption;
    const anchor=findHealth();
    if(anchor)anchor.insertAdjacentElement('afterend',host);else document.querySelector('main')?.appendChild(host);
  }

  async function loadOperational(){
    try{const r=await fetch('/api/pmo-cockpit',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);render(await r.json())}
    catch(e){
      document.getElementById('pmoOperationalBlocks')?.remove();
      const host=document.createElement('div');host.id='pmoOperationalBlocks';host.innerHTML=section('Gestão, capacidade, governança e adoção','Não foi possível consultar as fontes reais neste momento.',`<div class="error">${esc(e.message)}</div>`);document.querySelector('main')?.appendChild(host);
    }
  }
  document.getElementById('refresh')?.addEventListener('click',()=>setTimeout(loadOperational,0));
  loadOperational();
})();
