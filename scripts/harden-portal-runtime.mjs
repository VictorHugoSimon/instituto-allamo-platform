import fs from 'node:fs';

const file = 'public/index.html';
let html = fs.readFileSync(file, 'utf8');

// 1) Nunca exibir o painel técnico do bundler para o usuário final.
const errorStyle = "d.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;font:12px/1.4 ui-monospace,monospace;background:#2a1215;color:#ff8a80;padding:10px 14px;border-radius:8px;border:1px solid #5c2b2e;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto';";
if (html.includes(errorStyle)) html = html.replace(errorStyle, "d.style.cssText = 'display:none!important'; console.error('[bundle]', e.message || e.type, e.error || '');");

// 2) Boot guard: impede flash da fotografia embutida antes dos dados reais.
const resourceNeedle = "const resourceScript = '<script>window.__resources = ' +";
const resourceReplacement = `const resourceScript = '<style id="allamo-boot-guard">body{visibility:hidden!important}</style><script>' +\n      '(function(){' +\n      'window.__allamoApiPending=0;' +\n      'window.__allamoBootStarted=Date.now();' +\n      'var of=window.fetch.bind(window);' +\n      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api)window.__allamoApiPending++;return of.apply(window,a).finally(function(){if(api)window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);});};' +\n      'window.__allamoRevealWhenReady=function(){var quietSince=0,max=Date.now()+6000;function tick(){var now=Date.now(),p=window.__allamoApiPending||0;if(p===0){if(!quietSince)quietSince=now;}else quietSince=0;if((quietSince&&now-quietSince>=700)||now>=max){var s=document.getElementById("allamo-boot-guard");if(s)s.remove();if(document.body)document.body.style.visibility="visible";document.documentElement.classList.add("allamo-ready");return;}setTimeout(tick,75);}tick();};' +\n      '})();' +\n      '</' + 'script><script>window.__resources = ' +`;
if (html.includes(resourceNeedle) && !html.includes('window.__allamoApiPending')) html = html.replace(resourceNeedle, resourceReplacement);

// 3) Revela somente depois que os scripts do portal forem reativados.
const babelNeedle = `if (window.Babel && typeof window.Babel.transformScriptTags === 'function') {\n      window.Babel.transformScriptTags();\n    }`;
const babelReplacement = `${babelNeedle}\n    if (typeof window.__allamoRevealWhenReady === 'function') window.__allamoRevealWhenReady();`;
if (html.includes(babelNeedle) && !html.includes("typeof window.__allamoRevealWhenReady")) html = html.replace(babelNeedle, babelReplacement);

// 4) Cada coleção live reflete sua própria API; falha auxiliar não ressuscita demo.
if (!html.includes('[loadData] companies')) {
  const loadLine1 = "this.api('companies'), this.api('projects'), this.api('issues'+qs),";
  const loadLine1Fixed = "this.api('companies').catch(e=>{console.error('[loadData] companies',e);return [];}), this.api('projects').catch(e=>{console.error('[loadData] projects',e);return [];}), this.api('issues'+qs).catch(e=>{console.error('[loadData] issues',e);return [];}),";
  const loadLine2 = "this.api('gmud'+qs), this.api('releases'+qs), this.api('documents'+qs)";
  const loadLine2Fixed = "this.api('gmud'+qs).catch(e=>{console.error('[loadData] gmud',e);return [];}), this.api('releases'+qs).catch(e=>{console.error('[loadData] releases',e);return [];}), this.api('documents'+qs).catch(e=>{console.error('[loadData] documents',e);return [];})";
  if (!html.includes(loadLine1) || !html.includes(loadLine2)) throw new Error('Bloco loadData não encontrado para correção.');
  html = html.replace(loadLine1, loadLine1Fixed).replace(loadLine2, loadLine2Fixed);
}
const embeddedFallback = "} catch (e) { /* mantém dados embutidos */ }";
const emptyFallback = "} catch (e) { console.error('[loadData] falha inesperada',e); this.companies=[]; this.projects=[]; this.issues=[]; this.viradas=[]; this.docs=[]; this.setState({gmud:[]}); this.forceUpdate(); }";
if (html.includes(embeddedFallback)) html = html.replace(embeddedFallback, emptyFallback);

// 5) Carteira vazia é estado válido.
const activeCompanyNeedle = "const activeCo = coMap[st.company] || this.companies[0];";
const activeCompanySafe = "const activeCo = coMap[st.company] || this.companies[0] || { id:'', name:'', status:'', progress:0, own:false, system:'', summary:'', lead:'', city:'', pmo:'', statusText:'' };";
if (html.includes(activeCompanyNeedle)) html = html.split(activeCompanyNeedle).join(activeCompanySafe);

// 6) Visão Executiva: substitui o bloco hardcoded 7/259/3/2/1/1 por dados reais.
const execOldMarker = "const execKpis = [\\\n      {label:'Projetos', value:'7'";
const execLive = "const scopedCompanies = (this.companies||[]).filter(c=>st.company==='all'||String(c.id)===String(st.company));\\\n    const scopedProjects = (this.projects||[]).filter(p=>inScope(p.company_id));\\\n    const execKpis = [\\\n      {label:'Empresas', value:String(scopedCompanies.length), note:'empresas cadastradas'},\\\n      {label:'Projetos', value:String(scopedProjects.length), note:'portfólio atual'},\\\n      {label:'Demandas', value:String((this.issues||[]).filter(i=>inScope(i.company_id)).length), note:'registradas'},\\\n      {label:'Em andamento', value:String(scopedProjects.filter(p=>p.status==='Em andamento'||p.badge==='started').length), note:'projetos'},\\\n      {label:'Backlog', value:String(scopedProjects.filter(p=>p.status==='Backlog'||p.badge==='backlog').length), note:'projetos'},\\\n      {label:'Completo', value:String(scopedProjects.filter(p=>p.status==='Completo'||p.badge==='completed').length), note:'projetos'},\\\n      {label:'Cancelado', value:String(scopedProjects.filter(p=>p.status==='Cancelado'||p.badge==='canceled').length), note:'projetos'}\\\n    ];\\\n    ";
let execReplaced=0;
while(html.includes(execOldMarker)){
  const markerAt=html.indexOf(execOldMarker),start=html.lastIndexOf('const execKpis = [',markerAt),end=html.indexOf('const findings = [',markerAt);
  if(start<0||end<0)break;
  html=html.slice(0,start)+execLive+html.slice(end);execReplaced++;
}

// 7) Remove completamente os achados antigos DVOLV/Danicar do código entregue.
const findingsOldMarker = "const findings = [\\\n      {title:'Divergência Projeto × Execução'";
let findingsReplaced=0;
while(html.includes(findingsOldMarker)){
  const markerAt=html.indexOf(findingsOldMarker),start=html.lastIndexOf('const findings = [',markerAt),end=html.indexOf('// empresas',markerAt);
  if(start<0||end<0)break;
  html=html.slice(0,start)+"const findings = [];\\\n    "+html.slice(end);findingsReplaced++;
}

if (!html.includes('allamo-boot-guard') || !html.includes('display:none!important')) throw new Error('Hardening incompleto: marcadores esperados não foram aplicados.');
if (!html.includes('[loadData] companies') || html.includes('mantém dados embutidos')) throw new Error('Fallback demo ainda está ativo no portal live.');
if (!html.includes("this.companies[0] || { id:''")) throw new Error('Proteção de carteira vazia não foi aplicada.');
if (execReplaced<1 || html.includes("{label:'Projetos', value:'7'")) throw new Error('KPI Projetos ainda está hardcoded em 7.');
if (findingsReplaced<1 || html.includes('DVOLV está em Backlog') || html.includes('Danicar está cancelado')) throw new Error('Achados demo ainda estão no bundle live.');
if (!html.includes("{label:'Empresas', value:String(scopedCompanies.length)")) throw new Error('KPI Empresas dinâmico não foi aplicado.');
fs.writeFileSync(file, html);

// 8) Regra de domínio: projeto novo deve pertencer a uma empresa.
const workerFile = 'public/_worker.js';
let worker = fs.readFileSync(workerFile, 'utf8');
const projectNeedle = "      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);\n      if (scope && b.company_id && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);";
const projectReplacement = "      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);\n      if (user.role !== 'gestor' && !b.company_id) return json({ error: 'Selecione a empresa do projeto' }, 400);\n      if (scope && b.company_id && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);";
if (worker.includes(projectNeedle) && !worker.includes("Selecione a empresa do projeto")) worker = worker.replace(projectNeedle, projectReplacement);
if (!worker.includes("Selecione a empresa do projeto")) throw new Error('Regra empresa obrigatória não aplicada ao Worker.');
fs.writeFileSync(workerFile, worker);

console.log('OK: dados demo removidos, Visão Executiva live, carteira vazia segura e domínio Empresa 1:N Projetos aplicado.');
