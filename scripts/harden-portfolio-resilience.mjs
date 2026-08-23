import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

if(!html.includes('const keepOnError=(name,e)=>')){
  const needle='  async loadData() {';
  const injected="  async loadData() { const __portfolioResilienceMarker='[loadData] companies'; const keepOnError=(name,e)=>{ console.error('[loadData] '+name,e); if(!this.__dataRetryScheduled){ this.__dataRetryScheduled=true; setTimeout(()=>{ this.__dataRetryScheduled=false; try{ this.loadData(); }catch(_){} },1500); } return null; };";
  if(!html.includes(needle)) throw new Error('Método loadData não encontrado para proteção da carteira.');
  html=html.split(needle).join(injected);
}

const catches=[
  ["this.api('companies').catch(e=>{console.error('[loadData] companies',e);return [];}),","this.api('companies').catch(e=>keepOnError('companies',e)),"],
  ["this.api('projects').catch(e=>{console.error('[loadData] projects',e);return [];}),","this.api('projects').catch(e=>keepOnError('projects',e)),"],
  ["this.api('issues'+qs).catch(e=>{console.error('[loadData] issues',e);return [];}),","this.api('issues'+qs).catch(e=>keepOnError('issues',e)),"],
  ["this.api('gmud'+qs).catch(e=>{console.error('[loadData] gmud',e);return [];}),","this.api('gmud'+qs).catch(e=>keepOnError('gmud',e)),"],
  ["this.api('releases'+qs).catch(e=>{console.error('[loadData] releases',e);return [];}),","this.api('releases'+qs).catch(e=>keepOnError('releases',e)),"],
  ["this.api('documents'+qs).catch(e=>{console.error('[loadData] documents',e);return [];}),","this.api('documents'+qs).catch(e=>keepOnError('documents',e)),"]
];
for(const [from,to] of catches){ if(html.includes(from)) html=html.split(from).join(to); }

const assignments=[
  ['this.companies = companies.map(', 'if(Array.isArray(companies)) this.companies = companies.map('],
  ['this.projects = projects.map(', 'if(Array.isArray(projects)) this.projects = projects.map('],
  ['this.issues = issues.map(', 'if(Array.isArray(issues)) this.issues = issues.map('],
  ['this.viradas = releases.map(', 'if(Array.isArray(releases)) this.viradas = releases.map('],
  ['this.docs = documents.map(', 'if(Array.isArray(documents)) this.docs = documents.map('],
  ['this.setState(s => ({ gmud: gmud.map(', 'if(Array.isArray(gmud)) this.setState(s => ({ gmud: gmud.map(']
];
for(const [from,to] of assignments){ if(html.includes(from) && !html.includes(to)) html=html.split(from).join(to); }

const destructive="} catch (e) { console.error('[loadData] falha inesperada',e); this.companies=[]; this.projects=[]; this.issues=[]; this.viradas=[]; this.docs=[]; this.setState({gmud:[]}); this.forceUpdate(); }";
const resilient="} catch (e) { console.error('[loadData] falha inesperada',e); if(!this.__dataRetryScheduled){ this.__dataRetryScheduled=true; setTimeout(()=>{ this.__dataRetryScheduled=false; try{ this.loadData(); }catch(_){} },1500); } this.forceUpdate(); }";
if(html.includes(destructive)) html=html.split(destructive).join(resilient);

if(!html.includes("keepOnError('companies',e)")) throw new Error('API de empresas ainda transforma falha em lista vazia.');
if(!html.includes('if(Array.isArray(companies)) this.companies = companies.map(')) throw new Error('Carteira ainda pode ser substituída por retorno inválido.');
if(!html.includes("__portfolioResilienceMarker='[loadData] companies'")) throw new Error('Marcador de idempotência da carteira ausente.');
if(html.includes("[loadData] companies',e);return []")) throw new Error('Fallback vazio de empresas ainda presente.');
if(html.includes('this.companies=[]; this.projects=[]; this.issues=[]')) throw new Error('Catch destrutivo de loadData ainda presente.');

fs.writeFileSync(file,html);
console.log('OK: falha transitória não apaga carteira/projetos; último estado válido é preservado e o build permanece idempotente.');
