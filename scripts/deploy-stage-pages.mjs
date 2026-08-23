import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const deployDir=path.join(root,'.wrangler','deploy');
const redirectFile=path.join(deployDir,'config.json');
const configFile=path.join(root,'wrangler.stage.toml');

if(!fs.existsSync(configFile)){
  console.error('ERRO: wrangler.stage.toml não encontrado.');
  process.exit(1);
}

fs.mkdirSync(deployDir,{recursive:true});
fs.writeFileSync(redirectFile,JSON.stringify({configPath:'../../wrangler.stage.toml'},null,2)+'\n','utf8');

console.log('Configuração de deploy: STAGE -> wrangler.stage.toml');
console.log('Projeto Cloudflare Pages: allamo-pmo-stage');
console.log('Branch Pages: production (produção do projeto de STAGE)');

const cmd=process.platform==='win32'?'npx.cmd':'npx';
const args=['wrangler@4.124.0','pages','deploy','public','--project-name','allamo-pmo-stage','--branch','production','--commit-dirty=true'];

let exitCode=1;
try{
  const run=spawnSync(cmd,args,{cwd:root,stdio:'inherit',shell:false});
  if(run.error){
    console.error('Falha ao iniciar Wrangler:',run.error.message);
    exitCode=1;
  }else{
    exitCode=run.status ?? 1;
  }
}finally{
  try{fs.rmSync(redirectFile,{force:true});}catch{}
}

if(exitCode!==0){
  console.error('Deploy de STAGE não concluído. Nenhuma promoção para Produção foi executada.');
  process.exit(exitCode);
}

console.log('OK: deploy de STAGE concluído. O redirecionador local do Wrangler foi removido.');
