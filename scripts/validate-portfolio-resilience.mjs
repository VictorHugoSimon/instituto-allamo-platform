import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const runtime=fs.readFileSync('src/portfolio-work-distribution.js','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};
const mustRuntime=(needle,label)=>{if(!runtime.includes(needle))throw new Error(`Runtime ausente: ${label}`)};

must("const keepOnError=(name,e)=>",'retentativa central de sincronização');
must("keepOnError('companies',e)",'falha de empresas preserva último estado válido');
must('if(Array.isArray(companies)) this.companies = companies.map(','empresas só são substituídas por resposta válida');
must('if(Array.isArray(projects)) this.projects = projects.map(','projetos só são substituídos por resposta válida');
must('if(Array.isArray(issues)) this.issues = issues.map(','demandas só são substituídas por resposta válida');
must('[allamo-load-initial-continuity]','primeira hidratação usa continuidade visual');
must("sessionStorage.getItem('allamo_portfolio_snapshot_v2')",'snapshot de curta duração é restaurado');
must("sessionStorage.setItem('allamo_portfolio_snapshot_v2'",'snapshot é atualizado somente após resposta live válida');
must('companies = [];','empresas demo são removidas no build');
must('projects = [];','projetos demo são removidos no build');

must('<!-- BEGIN ALLAMO PORTFOLIO WORK DISTRIBUTION -->','runtime do gráfico de demandas/tarefas materializado');
must('__allamoPortfolioWorkDistributionLoaded','guard idempotente do gráfico');
must('Status de demandas e tarefas','estado inicial do gráfico não fala mais em nível de projeto');
mustRuntime("readApi('issues')",'fonte de demandas');
mustRuntime("readApi('work-items')",'fonte de tarefas/Work Management');
mustRuntime("const DEMAND_TYPES=new Set(['DEMANDA'])",'demandas do Work Management identificadas separadamente');
mustRuntime("const TASK_TYPES=new Set(['STORY','TASK','SUBTASK','BUG','INCIDENT','MELHORIA','AÇÃO','REQUISITO'])",'tarefas operacionais identificadas separadamente');
mustRuntime("const ACTIONABLE_TYPES=new Set([...DEMAND_TYPES,...TASK_TYPES])",'somente tipos acionáveis entram no gráfico');
mustRuntime("const demandCount=issues.length+workDemands.length",'contagem explícita de demandas');
mustRuntime("const taskCount=tasks.length",'contagem explícita de tarefas');
mustRuntime("code review|\\breview\\b|revis|\\bqa\\b|teste|homolog",'Review/QA/Homologação agrupados em andamento');
mustRuntime("return'other'",'status desconhecido preservado como Outros');
mustRuntime("lastIssues=null,lastWork=null",'fontes mantêm último estado válido separadamente');
mustRuntime("Status de demandas e tarefas",'subtítulo operacional');
mustRuntime("label.textContent='itens'",'centro do gráfico mede itens e não projetos');
mustRuntime("allamoPortfolioDistribution='demandas-tarefas'",'card identifica fonte operacional');
mustRuntime("window.addEventListener('allamo:work-items-changed',()=>refresh(true))",'gráfico pode atualizar imediatamente após mudança de trabalho');

if(/method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/i.test(runtime))throw new Error('Runtime do gráfico não pode executar mutações HTTP.');
if(html.includes("[loadData] companies',e);return []"))throw new Error('Falha de empresas ainda vira lista vazia.');
if(html.includes('this.companies=[]; this.projects=[]; this.issues=[]'))throw new Error('Catch destrutivo ainda pode apagar a visão da carteira.');
if(html.includes('[allamo-load-initial-reset]'))throw new Error('Primeira hidratação ainda contém reset que causa flicker vazio/cheio.');
if(html.includes('Situação registrada no nível de projeto'))throw new Error('Subtítulo legado por projeto ainda está materializado.');

console.log('OK: Distribuição do portfólio reflete demandas + tarefas reais por status, separa suas contagens, inicia sem texto legado de projetos e permanece somente leitura.');
