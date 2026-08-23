import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const deployDir=path.join(root,'.wrangler','deploy');
const redirectFile=path.join(deployDir,'config.json');
const configFile=path.join(root,'wrangler.stage.toml');

const STAGE_PROJECT='allamo-pmo-stage';
const STAGE_BRANCH='production';
const WRANGLER_VERSION='4.124.0';

if(!fs.existsSync(configFile)){
  console.error('ERRO: wrangler.stage.toml não encontrado.');
  process.exit(1);
}

fs.mkdirSync(deployDir,{recursive:true});
fs.writeFileSync(redirectFile,JSON.stringify({configPath:'../../wrangler.stage.toml'},null,2)+'\n','utf8');

console.log('Configuração de deploy: STAGE -> wrangler.stage.toml');
console.log('Projeto Cloudflare Pages: '+STAGE_PROJECT);
console.log('Branch Pages: '+STAGE_BRANCH+' (produção do projeto de STAGE)');

const wranglerArgs=[
  `wrangler@${WRANGLER_VERSION}`,
  'pages','deploy','public',
  '--project-name',STAGE_PROJECT,
  '--branch',STAGE_BRANCH,
  '--commit-dirty=true'
];

function runWrangler(){
  // No Windows/Node 24, spawnSync('npx.cmd', ..., {shell:false}) pode retornar EINVAL.
  // Executamos o .cmd por meio do próprio cmd.exe, que é a forma suportada pelo Windows.
  if(process.platform==='win32'){
    const comspec=process.env.ComSpec||process.env.COMSPEC||'cmd.exe';
    const command=['npx','--yes',...wranglerArgs].join(' ');
    return spawnSync(comspec,['/d','/s','/c',command],{
      cwd:root,
      stdio:'inherit',
      shell:false,
      windowsHide:false
    });
  }

  return spawnSync('npx',['--yes',...wranglerArgs],{
    cwd:root,
    stdio:'inherit',
    shell:false
  });
}

let exitCode=1;
try{
  const run=runWrangler();
  if(run.error){
    console.error('Falha ao iniciar Wrangler:',run.error.message);
    exitCode=1;
  }else if(run.signal){
    console.error('Wrangler interrompido pelo sinal:',run.signal);
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
