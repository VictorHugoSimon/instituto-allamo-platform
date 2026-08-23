import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const must=(needle,label)=>{if(!html.includes(needle))throw new Error(`Ausente: ${label}`)};

must("const keepOnError=(name,e)=>",'retentativa central de sincronização');
must("keepOnError('companies',e)",'falha de empresas preserva último estado válido');
must('if(Array.isArray(companies)) this.companies = companies.map(','empresas só são substituídas por resposta válida');
must('if(Array.isArray(projects)) this.projects = projects.map(','projetos só são substituídos por resposta válida');
must('if(Array.isArray(issues)) this.issues = issues.map(','demandas só são substituídas por resposta válida');
if(html.includes("[loadData] companies',e);return []"))throw new Error('Falha de empresas ainda vira lista vazia.');
if(html.includes('this.companies=[]; this.projects=[]; this.issues=[]'))throw new Error('Catch destrutivo ainda pode apagar a visão da carteira.');

console.log('OK: carteira e projetos não desaparecem por falha temporária de API; somente respostas válidas substituem o estado renderizado.');
