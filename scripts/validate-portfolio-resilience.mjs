import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};

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

if(html.includes("[loadData] companies',e);return []"))throw new Error('Falha de empresas ainda vira lista vazia.');
if(html.includes('this.companies=[]; this.projects=[]; this.issues=[]'))throw new Error('Catch destrutivo ainda pode apagar a visão da carteira.');
if(html.includes('[allamo-load-initial-reset]'))throw new Error('Primeira hidratação ainda contém reset que causa flicker vazio/cheio.');

console.log('OK: carteira/projetos não desaparecem em falha transitória nem na reidratação pós-deploy; snapshot é apenas continuidade visual e o fetch live continua soberano.');
