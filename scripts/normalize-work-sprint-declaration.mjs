import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
const canonical="const wmSprint=['admin','pmo','techlead'].includes(user.role);";

if(worker.includes(canonical)){
  console.log('OK: declaração wmSprint já está no formato canônico.');
}else{
  const declaration=/(?:const|let|var)\s+wmSprint\s*=\s*[^;]+;/;
  if(declaration.test(worker)){
    worker=worker.replace(declaration,canonical);
    fs.writeFileSync(file,worker);
    console.log('OK: declaração wmSprint normalizada para o hardening multiempresa.');
  }else{
    const route="if(path==='work-sprints'&&request.method==='GET')";
    const at=worker.indexOf(route);
    if(at<0) throw new Error('Rota de sprints não encontrada para normalizar wmSprint.');
    worker=worker.slice(0,at)+canonical+'\n'+worker.slice(at);
    fs.writeFileSync(file,worker);
    console.log('OK: declaração wmSprint restaurada antes das rotas de sprint.');
  }
}
