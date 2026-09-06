(()=>{
  'use strict';
  let report=null;
  const officialRoutes=[
    ['/madri-plano-de-acao/','Plano de Ação'],
    ['/madri-status-report/','Status Report'],
    ['/madri-pop/','POP'],
    ['/madri-mapa-implantacao/','Mapa Mestre']
  ];
  const supportRoutes=[
    ['/madri/','Portal'],
    [null,'Requisitos'],
    ['/madri-plano-testes/','Testes'],
    [null,'Riscos'],
    [null,'Integrações'],
    [null,'Documentos']
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opt={}){
    const headers={'content-type':'application/json',...(opt.headers||{})};
    const r=await fetch(path,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok){const err=new Error((data&&data.error)||`HTTP ${r.status}`);err.status=r.status;err.data=data;throw err}return data;
  }
  async function loadReport(force=false){if(report&&!force)return report;report=await api('/api/public-madri-pmo-report');return report}
  function showMessage(text,type='ok'){const box=document.getElementById('messageArea');if(!box)return;box.innerHTML=text?`<div class="message ${type==='error'?'error':'ok'}">${esc(text)}</div>`:'';if(text)setTimeout(()=>{if(box.textContent===text)box.innerHTML=''},6000)}
  function badge(status){const s=String(status||'A confirmar');const n=s.toLowerCase();let c='';if(/conclu|aprov|atendid|homolog|produção|tomada|fechado/.test(n))c='good';else if(/atras|bloque|reprov|vermelho|sev1|crít/.test(n))c='crit';else if(/andamento|atenção|pendente|revis|amarelo/.test(n))c='warn';else if(/sit|uat|e2e|pronto|desenvolvimento/.test(n))c='blue';return `<span class="pill ${c}">${esc(s)}</span>`}
  function links(items,active){return items.map(([u,l])=>u?`<a class="${active===l?'on':''}" href="${u}">${l}</a>`:`<span class="nav-disabled" title="Módulo em migração para D1">${l} · em migração</span>`).join('')}
  function nav(active){return `<div class="brand"><div class="eyebrow">Instituto Államo · PMO</div><h1>MADRI</h1><small>Governança com URLs permanentes</small></div><div class="navlabel">Links oficiais permanentes</div><div class="nav">${links(officialRoutes,active)}</div><div class="navlabel">Módulos de apoio</div><div class="nav">${links(supportRoutes,active)}</div><div class="side-note"><b>Fonte única e rastreável.</b><br>Reunião / Documento / Cliente / Fornecedor / PMO → Evidência → Ação / Decisão / Risco → Plano de Ação → Banco → Execução → Evidência → POP / Mapa Mestre → Status Report.<br><br><b>Regra:</b> o endereço oficial não muda; versões ficam no Git e os dados operacionais no D1.</div>`}
  async function init(active,title,subtitle){const side=document.getElementById('sidebar');if(side)side.innerHTML=nav(active);const t=document.getElementById('pageTitle');if(t)t.textContent=title||active;const s=document.getElementById('pageSub');if(s)s.textContent=subtitle||'Dados persistentes no Cloudflare D1';const d=await loadReport();document.querySelectorAll('[data-project-name]').forEach(x=>x.textContent=d.project?.project_name||'Implantação NUCCI ERP/TMS');return d}
  function operationalProgress(){if(!report)return 'N/D';const total=Number(report.total||0),done=Number(report.counts?.['Concluído']||0);return total?`${Math.round(done*100/total)}% das ações concluídas`:'N/D'}
  window.MADRIPlatform={api,esc,loadReport,init,badge,showMessage,operationalProgress,officialRoutes,supportRoutes};
})();
