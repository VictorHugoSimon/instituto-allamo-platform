import { execFileSync } from 'node:child_process';

const arg=(name)=>{
  const p=process.argv.find(x=>x.startsWith(`--${name}=`));
  return p?p.slice(name.length+3):'';
};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

const base=(arg('base')||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const sha=String(arg('sha')||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim();
if(!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('SHA esperado inválido.');

async function fetchRetry(url,{attempts=12,delay=5000}={}){
  let last='';
  for(let i=1;i<=attempts;i++){
    try{
      const res=await fetch(`${url}${url.includes('?')?'&':'?'}_release=${encodeURIComponent(sha)}_${i}`,{
        headers:{'cache-control':'no-cache, no-store, max-age=0','pragma':'no-cache'},
        cache:'no-store'
      });
      const text=await res.text();
      if(res.ok) return {res,text};
      last=`HTTP ${res.status}: ${text.slice(0,160)}`;
    }catch(e){ last=String(e?.message||e); }
    if(i<attempts) await sleep(delay);
  }
  throw new Error(`Falha ao consultar ${url}: ${last}`);
}

const fingerprintUrl=`${base}/release-${sha}.json`;
const fp=await fetchRetry(fingerprintUrl);
let release;
try{ release=JSON.parse(fp.text); }catch{ throw new Error('Fingerprint de release não retornou JSON válido.'); }
if(String(release.sha)!==sha) throw new Error(`URL canônica está em outro commit: esperado ${sha}, recebido ${release.sha||'sem sha'}.`);

// Nos hosts oficiais o portal atual opera sem tela de login e o backend injeta identidade PMO sintética.
// Portanto /api/companies deve responder 200 sem Authorization. Isso também comprova Worker + D1 da release atual.
const companies=await fetchRetry(`${base}/api/companies`);
let data;
try{ data=JSON.parse(companies.text); }catch{ throw new Error('/api/companies não retornou JSON válido.'); }
if(!Array.isArray(data)) throw new Error(`/api/companies não está em modo live/no-login: ${companies.text.slice(0,180)}`);

console.log(`OK: URL canônica ${base} serve o commit ${sha} e API live sem login (${data.length} empresa(s)).`);
