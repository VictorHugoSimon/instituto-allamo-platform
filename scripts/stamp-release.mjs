import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const worker='public/_worker.js';
const publicDir='public';

const gitSha=String(process.env.GITHUB_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim();
if(!/^[0-9a-f]{40}$/i.test(gitSha)) throw new Error('SHA Git inválido para carimbar a release.');

const release=`awm-${gitSha.slice(0,12)}`;
let w=fs.readFileSync(worker,'utf8');
w=w.replace(/const STAGE_BUILD = '[^']+';/,`const STAGE_BUILD = '${release}';`);
if(!w.includes(`STAGE_BUILD = '${release}'`)) throw new Error('Não foi possível carimbar a release no Worker.');
fs.writeFileSync(worker,w);

// Mantém apenas o fingerprint da release corrente no artefato publicado.
for(const name of fs.readdirSync(publicDir)){
  if(/^release-[0-9a-f]{40}\.json$/i.test(name)) fs.rmSync(`${publicDir}/${name}`,{force:true});
}
const payload=JSON.stringify({sha:gitSha,release},null,2)+'\n';
fs.writeFileSync(`${publicDir}/release.json`,payload);
fs.writeFileSync(`${publicDir}/release-${gitSha}.json`,payload);

console.log(`OK: release ${release} carimbada (${gitSha}).`);
