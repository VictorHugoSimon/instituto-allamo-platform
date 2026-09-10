import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

const count=(text,needle)=>text.split(needle).length-1;
const replaceOnce=(needle,replacement,label)=>{
  const n=count(html,needle);
  if(n===1){html=html.replace(needle,replacement);return true;}
  if(n===0)return false;
  throw new Error(`Contrato inesperado em ${label}: ocorrências=${n}`);
};

// 1) A Visão Executiva passa a carregar também o domínio canônico do Work Management.
if(!html.includes("[loadData] work-items")){
  const destructure=/const\s*\[companies,\s*projects,\s*issues,\s*gmud,\s*releases,\s*documents\]\s*=\s*await\s*Promise\.all\(\[/;
  if(!destructure.test(html))throw new Error('Desestruturação loadData não encontrada para Work Management.');
  html=html.replace(destructure,'const [companies, projects, issues, workItems, gmud, releases, documents] = await Promise.all([');

  const hardenedIssues="this.api('issues'+qs).catch(e=>{console.error('[loadData] issues',e);return [];}),";
  const plainIssues="this.api('issues'+qs),";
  if(html.includes(hardenedIssues)){
    html=html.replace(hardenedIssues,hardenedIssues+" this.api('work-items'+qs).catch(e=>{console.error('[loadData] work-items',e);return [];}),");
  }else if(html.includes(plainIssues)){
    html=html.replace(plainIssues,plainIssues+" this.api('work-items'+qs),");
  }else throw new Error('Chamada issues no loadData não encontrada para inserir work-items.');

  const assignment="this.issues = issues.map(i => ({ ...i, due: i.due ? new Date(i.due) : null }));";
  const assignmentCompact="this.issues=issues.map(i=>({...i,due:i.due?new Date(i.due):null}));";
  const workAssignment="this.workItems = Array.isArray(workItems) ? workItems.map(i => ({ ...i, company: i.company_id, projectId: i.project_id })) : [];";
  if(html.includes(assignment))html=html.replace(assignment,assignment+' '+workAssignment);
  else if(html.includes(assignmentCompact))html=html.replace(assignmentCompact,assignmentCompact+' '+workAssignment);
  else throw new Error('Atribuição de issues não encontrada para materializar workItems.');

  const fallback="this.companies=[]; this.projects=[]; this.issues=[];";
  if(html.includes(fallback))html=html.split(fallback).join("this.companies=[]; this.projects=[]; this.issues=[]; this.workItems=[];");
}

// 2) KPIs de demanda/status usam work_items. "Todas as empresas" é tratado pelo inScope já existente.
const kpis=[
  ["{label:'Demandas', value:String((this.issues||[]).filter(i=>inScope(i.company_id)).length), note:'registradas'}", "{label:'Demandas', value:String((this.workItems||[]).filter(i=>inScope(i.company_id)).length), note:'demandas e tarefas'}"],
  ["{label:'Em andamento', value:String((this.projects||[]).filter(p=>inScope(p.company_id)&&(p.status==='Em andamento'||p.badge==='started')).length), note:'projetos'}", "{label:'Em andamento', value:String((this.workItems||[]).filter(i=>inScope(i.company_id)&&i.status==='EM ANDAMENTO').length), note:'demandas/tarefas'}"],
  ["{label:'Backlog', value:String((this.projects||[]).filter(p=>inScope(p.company_id)&&(p.status==='Backlog'||p.badge==='backlog')).length), note:'projetos'}", "{label:'Backlog', value:String((this.workItems||[]).filter(i=>inScope(i.company_id)&&i.status==='BACKLOG').length), note:'demandas/tarefas'}"],
  ["{label:'Completo', value:String((this.projects||[]).filter(p=>inScope(p.company_id)&&(p.status==='Completo'||p.badge==='completed')).length), note:'projetos'}", "{label:'Completo', value:String((this.workItems||[]).filter(i=>inScope(i.company_id)&&i.status==='CONCLUÍDO').length), note:'demandas/tarefas'}"],
  ["{label:'Cancelado', value:String((this.projects||[]).filter(p=>inScope(p.company_id)&&(p.status==='Cancelado'||p.badge==='canceled')).length), note:'projetos'}", "{label:'Cancelado', value:String((this.workItems||[]).filter(i=>inScope(i.company_id)&&i.status==='CANCELADO').length), note:'demandas/tarefas'}"]
];
for(const [from,to] of kpis){
  if(html.includes(from))html=html.split(from).join(to);
}

// 3) Runtime dos gráficos executivos: somente GET, calculado sobre work_items e respeitando o seletor de empresa.
const begin='<!-- BEGIN ALLAMO EXECUTIVE WORK ITEMS RUNTIME -->';
const end='<!-- END ALLAMO EXECUTIVE WORK ITEMS RUNTIME -->';
const anchor='<!-- END ALLAMO WORK MANAGEMENT UI -->';
const runtime=`${begin}
<script>
(()=>{
  if(window.__allamoExecutiveWorkItems)return;
  window.__allamoExecutiveWorkItems=true;
  const STATUSES=['BACKLOG','A FAZER','EM ANDAMENTO','CODE REVIEW','QA','HOMOLOGAÇÃO','CONCLUÍDO','CANCELADO'];
  const statusLabel={BACKLOG:'Backlog','A FAZER':'A fazer','EM ANDAMENTO':'Em andamento','CODE REVIEW':'Code review',QA:'QA','HOMOLOGAÇÃO':'Homologação','CONCLUÍDO':'Concluído','CANCELADO':'Cancelado'};
  const state={items:[],projects:[],company:'',loading:false,lastFetch:0};
  const norm=s=>String(s??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const visible=el=>{if(!el||!el.getBoundingClientRect)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
  const companySelect=()=>Array.from(document.querySelectorAll('select')).find(s=>visible(s)&&Array.from(s.options||[]).some(o=>norm(o.textContent)==='todas empresas'))||null;
  const companyValue=()=>{const s=companySelect();if(!s)return'';const v=String(s.value||'');return !v||v==='all'?'':v};
  const api=async path=>{const headers={};try{const sess=JSON.parse(localStorage.getItem('allamo_session')||'null');if(sess&&sess.token)headers.authorization='Bearer '+sess.token}catch(_){}const r=await fetch('/api/'+path,{headers,cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();return Array.isArray(d)?d:[]};
  const projectName=id=>{const p=state.projects.find(x=>String(x.id)===String(id));return p?.name||'Sem projeto'};
  const currentItems=()=>{const cid=companyValue();return state.items.filter(i=>!cid||String(i.company_id)===String(cid));};
  const leafByText=text=>Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,span,p,div')).filter(e=>e.childElementCount===0&&norm(e.textContent)===norm(text)&&visible(e));
  const chartHost=(names)=>{for(const name of names){for(const h of leafByText(name)){let p=h.parentElement;for(let depth=0;p&&p!==document.body&&depth<6;depth++,p=p.parentElement){const heads=Array.from(p.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible);const visual=p.querySelector('svg,canvas');if(visual&&heads.length<=2)return{host:p,heading:h};}}}return null};
  const installChart=(names,key,body)=>{const found=chartHost(names);if(!found)return;const {host,heading}=found;let panel=host.querySelector('[data-allamo-executive-chart="'+key+'"]');if(!panel){panel=document.createElement('div');panel.dataset.allamoExecutiveChart=key;panel.style.cssText='margin-top:12px';host.appendChild(panel)}panel.innerHTML=body;host.querySelectorAll('svg,canvas').forEach(v=>{if(!panel.contains(v))v.style.display='none'});Array.from(host.querySelectorAll('div,span,p')).forEach(el=>{if(panel.contains(el)||el.contains(heading)||heading.contains(el)||el===heading)return;const t=norm(el.textContent);if(/^(0|[1-9]\\d*) (em andamento|backlog|completo|cancelado)/.test(t)&&el.childElementCount===0)el.style.display='none'});};
  const bars=(rows,total)=>{if(!rows.length||!total)return'<div style="padding:18px 0;color:#667085;font-size:13px">Nenhuma demanda/tarefa para o filtro atual.</div>';const max=Math.max(...rows.map(r=>r.value),1);return'<div style="display:grid;gap:9px">'+rows.map(r=>'<div style="display:grid;grid-template-columns:minmax(110px,160px) 1fr 42px;gap:8px;align-items:center;font-size:12px"><span>'+esc(r.label)+'</span><div style="height:10px;background:#eef0f3;border-radius:999px;overflow:hidden"><div style="height:100%;width:'+Math.max(2,(r.value/max)*100)+'%;background:#667085;border-radius:999px"></div></div><b style="text-align:right">'+r.value+'</b></div>').join('')+'</div>'};
  function render(){
    const items=currentItems();
    const byStatus=STATUSES.map(s=>({label:statusLabel[s],value:items.filter(i=>String(i.status||'').toUpperCase()===s).length})).filter(x=>x.value>0);
    installChart(['Distribuição por status','Distribuição do portfólio'],'status',bars(byStatus,items.length)+'<div style="margin-top:9px;color:#667085;font-size:11px">'+items.length+' demandas/tarefas no filtro atual.</div>');
    const groups=new Map();for(const i of items){const label=i.project_id!=null&&i.project_id!==''?projectName(i.project_id):(i.project||'Sem projeto');groups.set(label,(groups.get(label)||0)+1)}
    const byProject=Array.from(groups.entries()).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
    installChart(['Demandas por projeto'],'project',bars(byProject,items.length));
    const hours=new Map();for(const i of items){const n=Number(i.estimate_hours);if(!Number.isFinite(n)||n<=0)continue;const label=i.project_id!=null&&i.project_id!==''?projectName(i.project_id):(i.project||'Sem projeto');hours.set(label,(hours.get(label)||0)+n)}
    const byHours=Array.from(hours.entries()).map(([label,value])=>({label,value:Math.round(value*10)/10})).sort((a,b)=>b.value-a.value);
    installChart(['Capacidade (h)','Capacidade h'],'hours',byHours.length?bars(byHours,byHours.reduce((s,x)=>s+x.value,0)):'<div style="padding:18px 0;color:#667085;font-size:13px">Horas estimadas não informadas para as demandas/tarefas deste filtro.</div>');
  }
  let timer=0;const scheduleRender=()=>{clearTimeout(timer);timer=setTimeout(render,100)};
  async function refresh(force=false){const cid=companyValue();if(state.loading)return;if(!force&&cid===state.company&&Date.now()-state.lastFetch<15000){scheduleRender();return}state.loading=true;try{const qs=cid?'?company='+encodeURIComponent(cid):'';const [items,projects]=await Promise.all([api('work-items'+qs),api('projects')]);state.items=items;state.projects=projects;state.company=cid;state.lastFetch=Date.now();render()}catch(e){console.error('[executive-work-items]',e)}finally{state.loading=false}}
  const previous=window.AllamoRefreshExecutive;window.AllamoRefreshExecutive=()=>{try{if(typeof previous==='function')previous()}catch(_){}return refresh(true)};
  document.addEventListener('change',e=>{if(e.target&&e.target.tagName==='SELECT'&&Array.from(e.target.options||[]).some(o=>norm(o.textContent)==='todas empresas'))setTimeout(()=>refresh(true),0)},true);
  new MutationObserver(()=>scheduleRender()).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>refresh(false),15000);
  setTimeout(()=>refresh(true),700);
})();
</script>
${end}`;

const a=html.indexOf(begin);
if(a>=0){
  const b=html.indexOf(end,a);if(b<0)throw new Error('Fim do runtime executivo Work Items ausente.');
  html=html.slice(0,a)+runtime+html.slice(b+end.length);
}else{
  const at=html.indexOf(anchor);if(at<0)throw new Error('Âncora Work Management ausente para runtime executivo.');
  const pos=at+anchor.length;html=html.slice(0,pos)+'\n'+runtime+html.slice(pos);
}

const required=[
  "this.api('work-items'+qs)",
  'this.workItems = Array.isArray(workItems)',
  "{label:'Demandas', value:String((this.workItems||[])",
  "i.status==='EM ANDAMENTO'",
  "i.status==='BACKLOG'",
  "i.status==='CONCLUÍDO'",
  "i.status==='CANCELADO'",
  'BEGIN ALLAMO EXECUTIVE WORK ITEMS RUNTIME',
  "STATUSES=['BACKLOG','A FAZER','EM ANDAMENTO','CODE REVIEW','QA','HOMOLOGAÇÃO','CONCLUÍDO','CANCELADO']",
  "api('work-items'+qs)",
  "norm(o.textContent)==='todas empresas'",
  "installChart(['Demandas por projeto']",
  "installChart(['Capacidade (h)','Capacidade h']"
];
for(const needle of required)if(!html.includes(needle))throw new Error('Hardening executivo Work Items incompleto: '+needle);
if(html.includes("{label:'Demandas', value:String((this.issues||[])"))throw new Error('KPI Demandas ainda usa issues legadas.');

fs.writeFileSync(file,html);
console.log('OK: Visão Executiva consolida work_items por empresa/status/projeto; Todas as empresas inclui toda a carteira e gráficos não dependem de issues legadas.');
