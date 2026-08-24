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

function runNpx(args,{capture=false}={}){
  if(process.platform==='win32'){
    const comspec=process.env.ComSpec||process.env.COMSPEC||'cmd.exe';
    const quote=v=>/[\s"]/g.test(String(v))?'"'+String(v).replace(/"/g,'\\"')+'"':String(v);
    const command=['npx','--yes',...args].map(quote).join(' ');
    return spawnSync(comspec,['/d','/s','/c',command],{
      cwd:root,
      encoding:capture?'utf8':undefined,
      stdio:capture?'pipe':'inherit',
      shell:false,
      windowsHide:false
    });
  }
  return spawnSync('npx',['--yes',...args],{
    cwd:root,
    encoding:capture?'utf8':undefined,
    stdio:capture?'pipe':'inherit',
    shell:false
  });
}

function discoverProductionBranch(){
  const run=runNpx([`wrangler@${WRANGLER_VERSION}`,'pages','project','list','--json'],{capture:true});
  if(run.error) throw new Error('Falha ao consultar projetos Pages: '+run.error.message);
  if(run.status!==0) throw new Error('Wrangler não conseguiu listar projetos Pages: '+String(run.stderr||run.stdout||'').slice(0,500));
  let projects;
  try{ projects=JSON.parse(String(run.stdout||'').trim()); }
  catch(e){ throw new Error('Resposta de `pages project list --json` não é JSON válido: '+String(run.stdout||'').slice(0,500)); }
  if(!Array.isArray(projects)) throw new Error('Lista de projetos Pages possui formato inesperado.');
  const project=projects.find(p=>String(p?.name||'')===STAGE_PROJECT);
  if(!project) throw new Error(`Projeto Pages ${STAGE_PROJECT} não foi encontrado na conta autenticada.`);
  const productionBranch=String(project.production_branch||project.productionBranch||'').trim();
  if(!productionBranch) throw new Error(`Projeto ${STAGE_PROJECT} não informou production_branch.`);
  if(!/^[A-Za-z0-9._\/-]+$/.test(productionBranch)) throw new Error('production_branch retornada possui formato inseguro.');
  return productionBranch;
}

let exitCode=1;
try{
  const productionBranch=discoverProductionBranch();
  console.log('Configuração de deploy: STAGE -> wrangler.stage.toml');
  console.log('Projeto Cloudflare Pages: '+STAGE_PROJECT);
  console.log('Production branch real do projeto: '+productionBranch);
  console.log('Commit: '+commitSha);

  const args=[
    `wrangler@${WRANGLER_VERSION}`,
    'pages','deploy','public',
    '--project-name',STAGE_PROJECT,
    '--branch',productionBranch,
    '--commit-hash',commitSha,
    '--commit-dirty=true'
  ];
  const run=runNpx(args);
  if(run.error){
    console.error('Falha ao iniciar Wrangler:',run.error.message);
    exitCode=1;
  }else if(run.signal){
    console.error('Wrangler interrompido pelo sinal:',run.signal);
    exitCode=1;
  }else{
    exitCode=run.status ?? 1;
  }
} catch(e){
  console.error('Deploy Stage abortado:',String(e?.message||e));
  exitCode=1;
} finally{
  try{fs.rmSync(redirectFile,{force:true});}catch{}
}

if(exitCode!==0){
  console.error('Deploy de STAGE não concluído. Nenhuma promoção para Produção foi executada.');
  process.exit(exitCode);
}

console.log('OK: deploy enviado explicitamente para a production branch real do projeto Stage.');
