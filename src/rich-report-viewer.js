(()=>{
  if(window.AllamoRichReport)return;
  const TEMPLATE_ID='allamo-status-report-master-v1';
  const arr=v=>Array.isArray(v)?v:[];
  const txt=v=>v==null||v===''?'A confirmar':String(v);
  const num=v=>{const n=Number(String(v??'').replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null};
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const style=`
    .armv{position:fixed;inset:0;z-index:100005;background:#0009;display:flex;align-items:center;justify-content:center;padding:14px}
    .arm-exact-shell{width:min(1220px,98vw);height:min(94vh,1080px);background:#f4f3f0;border-radius:18px;overflow:hidden;box-shadow:0 30px 90px #0006;position:relative}
    .arm-inline{width:100%;min-height:760px;background:#f4f3f0;border:1px solid #dedbd5;border-radius:16px;overflow:hidden;box-shadow:0 8px 26px rgba(20,22,27,.06);position:relative}
    .arm-exact-frame{display:block;width:100%;height:100%;border:0;background:#f4f3f0}
    .arm-inline .arm-exact-frame{height:880px}
    .arm-exact-tools{position:absolute;right:14px;bottom:14px;z-index:4;display:flex;gap:7px}
    .arm-exact-tools button{border:1px solid #ffffff44;background:#302f39;color:#fff;border-radius:9px;padding:8px 11px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px #0002}
    .arm-exact-loading{display:grid;place-items:center;min-height:260px;color:#667085;font:700 13px system-ui}
    @media(max-width:900px){.arm-exact-shell{width:100vw;height:100dvh;border-radius:0}.armv{padding:0}.arm-inline{border-radius:12px}.arm-inline .arm-exact-frame{height:900px}}
    @media(max-width:560px){.arm-inline .arm-exact-frame{height:860px}.arm-exact-tools{right:8px;bottom:8px}.arm-exact-tools button{padding:7px 9px;font-size:11px}}
    @media print{.armv{position:static;background:#fff;padding:0}.arm-exact-shell,.arm-inline{width:100%;height:auto;box-shadow:none;border:0}.arm-exact-frame{min-height:100vh}.arm-exact-tools{display:none}}
  `;
  if(!document.getElementById('allamo-master-report-style')){const s=document.createElement('style');s.id='allamo-master-report-style';s.textContent=style;(document.head||document.documentElement).appendChild(s)}

  const reportData=r=>r?.data&&typeof r.data==='object'?r.data:(r&&typeof r==='object'?r:{});
  const stateClass=s=>{const v=String(s||'').toLowerCase();if(/concl|verde|ok|ritmo|normal/.test(v))return 'g-good';if(/crít|crit|vermel|bloq|atras/.test(v))return 'g-crit';if(/serious|sério|laranja/.test(v))return 'g-ser';return 'g-warn'};
  const firstFour=(list,fallback)=>Array.from({length:4},(_,i)=>list[i]||fallback(i));
  const kpiFallback=i=>({label:['Avanço oficial','Step / fase atual','Pendências abertas','Dias até Go-live'][i],value:'—',unit:'',note:'A confirmar'});
  const hourFallback=i=>({label:['Horas lançadas','Saldo contratual','Aderência ao plano','Go-live baseline'][i],value:'—',unit:'',note:'A confirmar'});
  const curveData=d=>arr(d.curveS||d.sCurve||d.hoursBars).map((x,i)=>({label:x.label||x.month||x.mes||String(i+1),planned:num(x.planned??x.previsto??x.plan??x.horas_prev),actual:num(x.actual??x.real??x.executado??x.horas_real)})).filter(x=>x.planned!=null||x.actual!=null);

  function setKpis(grid,items){
    const cards=[...grid.querySelectorAll('.kpi')];
    firstFour(items,kpiFallback).forEach((k,i)=>{const c=cards[i];if(!c)return;const pct=num(k.pct??k.progress??(String(k.unit||'').includes('%')?k.value:null));const l=c.querySelector('.k-l'),v=c.querySelector('.k-v'),s=c.querySelector('.k-s'),bar=c.querySelector('.prog>i');if(l)l.textContent=txt(k.label);if(v){v.textContent=txt(k.value??'—');const sm=document.createElement('small');sm.textContent=k.unit||'';v.appendChild(sm)}if(s)s.textContent=k.note||k.description||'A confirmar';if(bar)bar.style.width=(pct==null?0:clamp(pct))+'%';});
  }
  function drawCurve(doc,d){
    const data=curveData(d),svg=doc.getElementById('curvaChart'),tbody=doc.getElementById('curvaTbody'),monthly=doc.getElementById('mensalChart');
    if(tbody)tbody.innerHTML=data.length?data.map(x=>`<tr><td style="text-align:left;border:1px solid var(--grid);padding:4px 8px">${esc(x.label)}</td><td style="border:1px solid var(--grid);padding:4px 8px;text-align:right">${x.planned==null?'—':esc(x.planned)}</td><td style="border:1px solid var(--grid);padding:4px 8px;text-align:right">${x.actual==null?'—':esc(x.actual)}</td></tr>`).join(''):'<tr><td colspan="3" style="padding:14px;text-align:center;color:var(--muted)">A confirmar</td></tr>';
    if(!svg||!monthly)return;
    if(data.length<2){svg.innerHTML='<text x="320" y="145" text-anchor="middle" font-size="13" fill="#898781">Curva S: A confirmar</text>';monthly.innerHTML='<text x="190" y="145" text-anchor="middle" font-size="13" fill="#898781">Consumo mensal: A confirmar</text>';return}
    const css=v=>doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue(v).trim();
    const W=640,H=300,pl=44,pr=18,pt=16,pb=40,iw=W-pl-pr,ih=H-pt-pb,max=Math.max(1,...data.flatMap(x=>[x.planned,x.actual]).filter(v=>v!=null));
    const x=i=>pl+iw*i/(data.length-1),y=v=>pt+ih*(1-(Number(v)||0)/max);
    let g='';for(let k=0;k<=4;k++){const vv=max*k/4,yy=y(vv);g+=`<line x1="${pl}" y1="${yy}" x2="${W-pr}" y2="${yy}" stroke="${css('--grid')}"/><text x="${pl-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="${css('--muted')}">${Math.round(vv)}</text>`}
    data.forEach((m,i)=>{g+=`<text x="${x(i)}" y="${H-pb+18}" text-anchor="middle" font-size="10" fill="${css('--muted')}">${esc(m.label)}</text>`});
    const p=data.map((m,i)=>`${x(i)},${y(m.planned??0)}`).join(' '),a=data.map((m,i)=>`${x(i)},${y(m.actual??0)}`).join(' ');
    g+=`<polyline points="${p}" fill="none" stroke="${css('--prev')}" stroke-width="2.5" stroke-dasharray="6 5"/><polyline points="${a}" fill="none" stroke="${css('--series')}" stroke-width="3"/>`;
    data.forEach((m,i)=>{if(m.actual!=null)g+=`<circle cx="${x(i)}" cy="${y(m.actual)}" r="4" fill="${css('--surface')}" stroke="${css('--series')}" stroke-width="2.5"/>`});svg.innerHTML=g;
    const deltas=data.map((m,i)=>({label:m.label,actual:m.actual==null?null:m.actual-(i?data[i-1].actual||0:0),planned:m.planned==null?null:m.planned-(i?data[i-1].planned||0:0)}));
    const mmax=Math.max(1,...deltas.flatMap(x=>[x.actual,x.planned]).filter(v=>v!=null)),MW=380,MH=300,ml=36,mr=14,mt=16,mb=40,miw=MW-ml-mr,mih=MH-mt-mb,bw=miw/deltas.length,mx=i=>ml+bw*i,my=v=>mt+mih*(1-(Number(v)||0)/mmax);let mg='';
    deltas.forEach((m,i)=>{const bx=mx(i)+bw*.22,bWid=bw*.56,v=m.actual||0,by=my(v);mg+=`<rect x="${bx}" y="${by}" width="${bWid}" height="${my(0)-by}" rx="4" fill="${css('--copper')}"/><text x="${bx+bWid/2}" y="${MH-mb+18}" text-anchor="middle" font-size="10" fill="${css('--muted')}">${esc(m.label)}</text>`;if(m.planned!=null){const py=my(m.planned);mg+=`<line x1="${mx(i)+bw*.15}" y1="${py}" x2="${mx(i)+bw*.85}" y2="${py}" stroke="${css('--muted')}" stroke-width="2" stroke-dasharray="5 4"/>`}});monthly.innerHTML=mg;
  }
  function applyReport(doc,report){
    const d=reportData(report),series=d._series||report?._series||report?.cycle||{},company=report?.company?.name||d.client||report?.company_name||'A confirmar',project=report?.project?.name||d.project_name||report?.project_name||'A confirmar',reference=report?.reference||d.ref||series.period_end||'A confirmar';
    doc.title=`Status Report · ${company} · ${reference}`;
    const hm=doc.querySelector('.h-meta');if(hm)hm.innerHTML=`<div>Cliente: <b>${esc(company)}</b></div><div>Projeto: <b>${esc(project)}</b></div><div>Referência: <b>${esc(reference)}</b>${series.cycle_no?` · ciclo #${String(series.cycle_no).padStart(2,'0')}`:''}</div><button class="toggle" onclick="toggleTheme()" style="margin-top:8px">◑ Tema</button>`;
    const h1=doc.querySelector('header h1');if(h1)h1.textContent=report?.title||d.title||'Status Report do Projeto';
    const sub=doc.querySelector('.h-sub');if(sub)sub.textContent='Visão Geral · Evolução do Escopo · Evolução das Horas · Próximos Passos';

    const pillars=arr(d.pillars),cards=[...doc.querySelectorAll('.prog4 .pilar-card')];cards.forEach((c,i)=>{const p=pillars[i]||{};const n=c.querySelector('.pnum'),h=c.querySelector('h4'),desc=c.querySelector('p'),tag=c.querySelector('.ptag');if(n)n.textContent=p.num||i+1;if(h)h.textContent=p.name||`Pilar ${i+1} · A confirmar`;if(desc)desc.textContent=p.desc||'Escopo e resultado deste pilar a confirmar.';if(tag)tag.textContent=p.tag||'A confirmar'});

    const crono=doc.getElementById('cronoTable'),cronRows=arr(d.crono||d.cronograma_mensal||d.hours_plan);if(crono){if(cronRows.length){const months=Array.from(new Set(cronRows.flatMap(r=>Object.keys(r.months||{}))));crono.innerHTML=`<table class="crono-t"><thead><tr><th class="pilar-h">Pilar / Frente</th>${months.map(m=>`<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>${cronRows.map(r=>`<tr><td class="pn">${esc(r.name||r.pilar||r.title||'Frente')}</td>${months.map(m=>{const v=num((r.months||{})[m]);return `<td><div class="cell" style="background:${v?`rgba(var(--copper-rgb),${Math.min(1,.2+v/50)})`:'transparent'}">${v??''}</div></td>`}).join('')}</tr>`).join('')}</tbody></table>`}else crono.innerHTML='<div class="note" style="padding:14px">Cronograma mensal de horas: A confirmar.</div>'}
    const foot=doc.querySelector('.crono-foot .tot');if(foot){const monthly=d.hoursMeta||d.monthly_hours||'A confirmar',total=d.total_hours||pillars.reduce((s,p)=>s+(num(p.h)||0),0)||'A confirmar';foot.innerHTML=`Carga mensal planejada: <b>${esc(monthly)}${typeof monthly==='number'?'h':''}</b> · Ciclo total: <b style="font-size:13px">${esc(total)}${typeof total==='number'?'h':''}</b>`}

    const sems=arr(d.semaphores),semCards=[...doc.querySelectorAll('.sem-grid3 .sem')];semCards.forEach((c,i)=>{const s=sems[i]||{label:['Cronograma','Prontidão do cliente','Riscos'][i],state:'A confirmar',desc:'Sem evidência consolidada neste ciclo.'},cl=stateClass(s.state||s.status);const bar=c.querySelector('.bar'),lbl=c.querySelector('.lbl'),st=c.querySelector('.st'),ds=c.querySelector('.ds');if(bar)bar.className='bar '+cl;if(lbl)lbl.textContent=s.label||'Indicador';if(st)st.innerHTML=`<span class="dot ${cl}"></span>${esc(s.state||s.status||'A confirmar')}`;if(ds)ds.textContent=s.desc||s.description||'A confirmar'});
    const notes=[...doc.querySelectorAll('.panel:nth-of-type(1) .note')];if(notes[0])notes[0].textContent=d.data_note||d.executive_summary||`Data-base e evidências conforme o ciclo ${series.cycle_no||''}. Itens sem comprovação permanecem “A confirmar”.`;if(notes[1])notes[1].textContent=d.source_note||'Fontes: reuniões, cronograma, horas, backlog e evidências vinculadas ao Report, quando disponíveis.';

    const grids=[...doc.querySelectorAll('.kpi-grid')];if(grids[0])setKpis(grids[0],arr(d.kpis));if(grids[1])setKpis(grids[1],firstFour(arr(d.hourKpis),hourFallback));
    const deliver=arr(d.modules||d.modulos||d.deliveries);const modules=deliver.length?deliver:arr(d.phases).flatMap(p=>arr(p.items).map(x=>({...x,phase:p.title})));const mod=doc.getElementById('modulos');if(mod)mod.innerHTML=modules.length?modules.map(m=>`<div class="mod"><div class="mh"><span class="chk">${/concl|ok/i.test(String(m.status||m.tag||''))?'✓':'•'}</span>${esc(m.name||m.title||m.atividade||'Entrega')}</div><div class="md">${esc(m.desc||m.description||m.phase||m.status||m.tag||'A confirmar')}</div></div>`).join(''):'<div class="mod"><div class="mh">A confirmar</div><div class="md">Entregas do período ainda não consolidadas.</div></div>';
    const pstat=doc.getElementById('pilares');if(pstat)pstat.innerHTML=pillars.length?pillars.map((p,i)=>`<div class="pil-row"><div><div class="nm">${esc(p.name||`Pilar ${i+1}`)}</div><div class="sb">${esc(p.sub||p.desc||'')}${p.h!=null?' · '+esc(p.h)+'h':''}</div></div><span class="badge ${/andamento|run/i.test(String(p.status||p.st||''))?'b-run':'b-idle'}">${esc(p.status||p.st||'A confirmar')}</span><div class="pil-track"><i style="width:${clamp(num(p.pct??p.progress))}%;background:${esc(p.fill||'var(--series)')}"></i></div></div>`).join(''):'<div class="note">Status dos pilares: A confirmar.</div>';
    const ms=doc.getElementById('milestones'),phases=arr(d.phases);if(ms)ms.innerHTML=phases.length?phases.map(p=>`<div class="ms-fase"><h4>${esc(p.title||'Fase')}<span class="pct">${esc(p.pct||p.progress||p.status||'A confirmar')}</span></h4>${arr(p.items).map(m=>{const v=String(m.status||m.tag||'').toLowerCase(),ok=/concl|ok/.test(v),run=/andamento|run/.test(v),crit=/crit|bloq|atras/.test(v);return `<div class="ms"><span class="ic ${ok?'i-ok':run?'i-run':crit?'i-crit':'i-pend'}">${ok?'✓':run?'●':crit?'!':'·'}</span><span class="nm">${esc(m.name||m.title||'Marco')}</span><span class="tag ${ok?'t-ok':run?'t-run':crit?'t-dev':'t-pend'}">${esc(m.status||m.tag||'A confirmar')}</span></div>`}).join('')}</div>`).join(''):'<div class="note">Marcos/fases: A confirmar.</div>';
    const scopeNote=doc.querySelectorAll('.panel')[1]?.querySelector('.note');if(scopeNote)scopeNote.textContent=d.scope_note||'';

    drawCurve(doc,d);const hoursNote=doc.querySelectorAll('.panel')[2]?.querySelector('.note');if(hoursNote)hoursNote.textContent=d.hours_note||'Horas e Curva S são exibidas somente quando houver apontamentos e baseline suficientes; na ausência de evidência, manter “A confirmar”.';
    const risks=arr(d.risks),rbox=doc.getElementById('riscos');if(rbox)rbox.innerHTML=risks.length?risks.map(r=>`<div class="rk"><span class="sev ${stateClass(r.severity||r.status)}"></span><div class="rc"><h4>${esc(r.title||r.risco||'Risco')}</h4><p>${esc(r.desc||r.situacao||r.mitig||r.mitigation||'A confirmar')}</p></div><div class="rmeta">${esc(r.meta||r.resp||r.responsavel||'')}</div></div>`).join(''):'<div class="li"><div class="lt"><b>Nenhum risco informado neste ciclo.</b></div></div>';
    const next=arr(d.next||d.next_steps||d.actions),nbox=doc.getElementById('proximos');if(nbox)nbox.innerHTML=next.length?next.map((x,i)=>`<div class="li"><span class="num">${i+1}</span><div class="lt"><b>${esc(x.title||x.acao||x.action||'Próximo passo')}.</b> <span>${esc(x.desc||x.resultado||x.description||'')}${x.owner||x.responsavel?' · Responsável: '+esc(x.owner||x.responsavel):''}${x.due_date||x.prazo?' · Prazo: '+esc(x.due_date||x.prazo):''}</span></div></div>`).join(''):'<div class="li"><span class="num">1</span><div class="lt"><b>Próximos passos: A confirmar.</b></div></div>';

    const custom=arr(d.custom_sections).filter(s=>s?.client_visible!==false),last=doc.querySelectorAll('.panel')[3];if(last&&custom.length){const sec=doc.createElement('section');sec.innerHTML=`<div class="s-title">Informações Adicionais do Ciclo</div><div class="card list">${custom.map(s=>`<div class="li"><span class="num">•</span><div class="lt"><b>${esc(s.title||'Seção')}</b><span>${arr(s.fields).filter(f=>f?.client_visible!==false).map(f=>`<br>${esc(f.label||f.name||'Campo')}: ${esc(typeof f.value==='object'?JSON.stringify(f.value):txt(f.value))}`).join('')}</span></div></div>`).join('')}</div>`;last.appendChild(sec)}
    const footer=doc.querySelector('footer');if(footer)footer.innerHTML=`<div>Instituto Államo · PMO · Governança e Consultoria</div><div>${series.presentation_date?'Apresentação: '+esc(series.presentation_date)+' · ':''}Template ${TEMPLATE_ID}</div>`;
    doc.documentElement.dataset.reportTemplate=TEMPLATE_ID;
  }
  async function mount(host,report,{inline=false,onClose=null}={}){
    host.innerHTML='<div class="arm-exact-loading">Carregando template mestre do Status Report…</div>';
    try{
      if(typeof window.__allamoStatusReportMasterSource!=='function')throw new Error('Fonte literal do template mestre não carregada.');
      const src=await window.__allamoStatusReportMasterSource(),shell=document.createElement('div');shell.className=inline?'arm-inline':'arm-exact-shell';shell.dataset.reportTemplate=TEMPLATE_ID;const frame=document.createElement('iframe');frame.className='arm-exact-frame';frame.title='Status Report Államo';frame.setAttribute('sandbox','allow-scripts allow-same-origin');shell.appendChild(frame);
      if(!inline){const tools=document.createElement('div');tools.className='arm-exact-tools';tools.innerHTML='<button data-arm-print>Imprimir / PDF</button><button data-arm-close>Fechar</button>';shell.appendChild(tools);tools.querySelector('[data-arm-close]').onclick=()=>onClose?onClose():host.remove();tools.querySelector('[data-arm-print]').onclick=()=>frame.contentWindow?.print()}
      host.innerHTML='';host.appendChild(shell);frame.onload=()=>{try{applyReport(frame.contentDocument,report);if(inline){const resize=()=>{try{frame.style.height=Math.max(760,Math.min(1450,frame.contentDocument.documentElement.scrollHeight+8))+'px'}catch(_){}};setTimeout(resize,80);frame.contentDocument.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>setTimeout(resize,80)));if('ResizeObserver'in window)new ResizeObserver(resize).observe(frame.contentDocument.body)}}catch(err){console.error('[report-master]',err)}};frame.srcdoc=src;return {template:TEMPLATE_ID,frame};
    }catch(err){host.innerHTML=`<div style="padding:18px;border:1px solid #f0c6c6;background:#fff7f7;border-radius:12px;color:#b42318">Não foi possível carregar o template mestre: ${esc(err.message)}</div>`;return {template:TEMPLATE_ID,error:err}}
  }
  window.AllamoRichReport={templateId:TEMPLATE_ID,source:'literal-html-drive',renderInto(container,report){return mount(container,report,{inline:true})},open(report){document.querySelector('.armv')?.remove();const m=document.createElement('div');m.className='armv';document.body.appendChild(m);mount(m,report,{inline:false,onClose:()=>m.remove()});m.addEventListener('click',ev=>{if(ev.target===m)m.remove()});return m}};
})();
