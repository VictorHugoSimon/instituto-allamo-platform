import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const deployDir=path.join(root,'.wrangler','deploy');
const redirectFile=path.join(deployDir,'config.json');
const configFile=path.join(root,'wrangler.stage.toml');

const STAGE_PROJECT='allamo-pmo-stage';
const WRANGLER_VERSION='4.124.0';
const commitSha=String(process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'})).trim();

if(!fs.existsSync(configFile)){
  console.error('ERRO: wrangler.stage.toml não encontrado.');
  process.exit(1);
}
if(!/^[0-9a-f]{40}$/i.test(commitSha)){
  console.error('ERRO: SHA Git inválido para o deploy.');
  process.exit(1);
}

fs.mkdirSync(deployDir,{recursive:true});
fs.writeFileSync(redirectFile,JSON.stringify({configPath:'../../wrangler.stage.toml'},null,2)+'\n','utf8');

console.log('Configuração de deploy: STAGE -> wrangler.stage.toml');
console.log('Projeto Cloudflare Pages: '+STAGE_PROJECT);
console.log('Destino: produção canônica do projeto de STAGE (sem --branch de preview)');
console.log('Commit: '+commitSha);

const wranglerArgs=[
  `wrangler@${WRANGLER_VERSION}`,
  'pages','deploy','public',
  '--project-name',STAGE_PROJECT,
  '--commit-hash',commitSha,
  '--commit-dirty=true'
];

function runWrangler(){
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

console.log('OK: deploy canônico de STAGE concluído. O redirecionador local do Wrangler foi removido.');
