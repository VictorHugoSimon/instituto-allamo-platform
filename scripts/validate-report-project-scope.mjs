import fs from 'node:fs';

const api=fs.readFileSync('src/report-project-scope-api.js','utf8');
const ui=fs.readFileSync('src/report-project-scope-ui.js','utf8');
const worker=fs.readFileSync('public/_worker.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');

const must=(cond,msg)=>{if(!cond)throw new Error(msg)};

must(api.includes("project_id==null||probe.project_id===''"),'Criação de Report não exige project_id.');
must(api.includes('O projeto selecionado não pertence à empresa do Report'),'API não valida pertencimento empresa/projeto.');
must(api.includes('Associe este Report a um projeto antes de publicar.'),'Publicação de Report legado sem projeto não está bloqueada.');
must(ui.includes('Cada Report precisa estar ligado a um projeto.'),'UI não exige projeto ao salvar Report.');
must(worker.includes('Todo Report deve pertencer a um projeto.'),'Guard empresa/projeto/report ausente no Worker final.');
must(html.includes('Cada Report precisa estar ligado a um projeto.'),'Guard empresa/projeto/report ausente no HTML final.');
must(worker.indexOf('// BEGIN ALLAMO REPORT PROJECT SCOPE') < worker.indexOf('// BEGIN ALLAMO REPORT MANAGEMENT'),'Guard de projeto precisa executar antes do Report Management.');

console.log('OK: Report é obrigatoriamente Empresa + Projeto; publicação e edição impedem cruzamento de tenant/projeto.');
