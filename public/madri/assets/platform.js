(()=>{
  'use strict';
  let report=null;

  // Navegação única MADRI, espelhando a jornada OPR sem compartilhar dados.
  const navGroups=[
    {label:'Início',items:[['/madri/','Portal','01 · Visão Geral']]},
    {label:'Entender e planejar',items:[['/madri-blueprint/','Blueprint','02 · Blueprint'],['/madri-plano-de-acao/','Plano de Ação','03 · Plano de Ação'],['/madri-requisitos/','Requisitos','04 · Requisitos']]},
    {label:'Executar e controlar',items:[['/madri-integracoes/','Integrações','05 · Integrações'],['/madri-riscos/','Riscos','06 · Riscos'],['/madri-mapa-implantacao/','Mapa Mestre','07 · Mapa Mestre']]},
    {label:'Validar e decidir',items:[['/madri-plano-testes/','Testes','08 · Testes'],['/madri-defeitos/','Defeitos','09 · Defeitos'],['/madri-readiness/','Readiness','10 · Readiness'],['/madri-decisoes/','Decisões','11 · Decisões']]},
    {label:'Governança e conhecimento',items:[['/madri-status-report/','Status Report','12 · Status Report'],['/madri-pop/','POP','13 · POP'],['/madri-documentos/','Documentos','14 · Documentos'],['/madri-biblioteca/','Biblioteca','15 · Biblioteca / Drive']]}
  ];
  const routes=navGroups.flatMap(g=>g.items.map(([url,key,label])=>[url,label,key]));
  const officialRoutes=[['/madri-plano-de-acao/','Plano de Ação'],['/madri-status-report/','Status Report'],['/madri-pop/','POP'],['/madri-mapa-implantacao/','Mapa Mestre']];
  const supportRoutes=routes.map(([url,label])=>[url,label]);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opt={}){
    const headers={'content-type':'application/json',...(opt.headers||{})};
    const r=await fetch(path,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok){const err=new Error((data&&data.error)||`HTTP ${r.status}`);err.status=r.status;err.data=data;throw err}return data;
  }
  async function loadReport(force=false){if(report&&!force)return report;report=await api('/api/public-madri-pmo-report');return report}
  function showMessage(text,type='ok'){const box=document.getElementById('messageArea');if(!box)return;box.innerHTML=text?`<div class="message ${type==='error'?'error':'ok'}">${esc(text)}</div>`:'';if(text)setTimeout(()=>{if(box.textContent===text)box.innerHTML=''},6000)}
  function badge(status){const s=String(status||'A confirmar');const n=s.toLowerCase();let c='';if(/conclu|aprov|atendid|homolog|produção|tomada|fechado|verde/.test(n))c='good';else if(/atras|bloque|reprov|vermelho|sev1|crít|no-go/.test(n))c='crit';else if(/andamento|atenção|pendente|revis|amarelo/.test(n))c='warn';else if(/sit|uat|e2e|pronto|desenvolvimento/.test(n))c='blue';return `<span class="pill ${c}">${esc(s)}</span>`}
  const groupLinks=(items,active)=>items.map(([u,key,label])=>`<a class="${active===key?'on':''}" ${active===key?'aria-current="page"':''} href="${u}"><span class="navtext">${esc(label)}</span></a>`).join('');
  function nav(active){return `<div class="brand"><div class="eyebrow">Instituto Államo · PMO</div><h1>MADRI</h1><small>Portal único de Governança</small></div>${navGroups.map(g=>`<div class="navlabel">${esc(g.label)}</div><div class="nav">${groupLinks(g.items,active)}</div>`).join('')}<div class="side-note"><b>Links oficiais permanentes.</b><br>Cada etapa possui URL própria e pertence ao mesmo portal MADRI.<br><br><b>Sequência:</b> entender → planejar → executar → controlar → testar → decidir → reportar → documentar.<br><br><b>Isolamento:</b> dados MADRI permanecem em APIs/tabelas MADRI; o menu replica somente a experiência OPR.</div>`}
  async function init(active,title,subtitle){const side=document.getElementById('sidebar');if(side){side.innerHTML=nav(active);requestAnimationFrame(()=>side.querySelector('a.on')?.scrollIntoView({block:'nearest',inline:'nearest'}))}const t=document.getElementById('pageTitle');if(t)t.textContent=title||active;const s=document.getElementById('pageSub');if(s)s.textContent=subtitle||'Fonte única de governança MADRI';const d=await loadReport();document.querySelectorAll('[data-project-name]').forEach(x=>x.textContent=d.project?.project_name||'Implantação NUCCI ERP/TMS');return d}
  function operationalProgress(){if(!report)return 'N/D';const total=Number(report.total||0),done=Number(report.counts?.['Concluído']||0);return total?`${Math.round(done*100/total)}% das ações concluídas`:'N/D'}
  window.MADRIPlatform={api,esc,loadReport,init,badge,showMessage,operationalProgress,routes,officialRoutes,supportRoutes,navGroups};
})();
