import { execFileSync } from 'node:child_process';

const arg=(name)=>{
  const p=process.argv.find(x=>x.startsWith(`--${name}=`));
  return p?p.slice(name.length+3):'';
};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

const base=(arg('base')||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const sha=String(arg('sha')||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim();
if(!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('SHA esperado inválido.');

const safeSnippet=(text)=>String(text||'').replace(/\s+/g,' ').slice(0,160);

async function fetchUntil(url,accept,{attempts=12,delay=3000,label='recurso'}={}){
  let last='sem resposta';
  for(let i=1;i<=attempts;i++){
    try{
      const target=`${url}${url.includes('?')?'&':'?'}_release=${encodeURIComponent(sha)}_${Date.now()}_${i}`;
      const res=await fetch(target,{
        headers:{'cache-control':'no-cache, no-store, max-age=0','pragma':'no-cache','accept':'application/json'},
        cache:'no-store',
        redirect:'follow'
      });
      const text=await res.text();
      const contentType=res.headers.get('content-type')||'';
      const verdict=await accept({res,text,contentType,attempt:i});
      if(verdict?.ok) return verdict.value;
      last=verdict?.reason||`HTTP ${res.status}; content-type ${contentType||'ausente'}; corpo ${safeSnippet(text)}`;
    }catch(e){
      last=String(e?.message||e);
    }
    if(i<attempts) await sleep(delay);
  }
  throw new Error(`${label} não convergiu na URL canônica após ${attempts} tentativas: ${last}`);
}

const fingerprintUrl=`${base}/release-${sha}.json`;
const release=await fetchUntil(fingerprintUrl,({res,text,contentType})=>{
  if(!res.ok) return {ok:false,reason:`fingerprint HTTP ${res.status}; ${safeSnippet(text)}`};
  let data;
  try{ data=JSON.parse(text); }
  catch{
    return {ok:false,reason:`fingerprint ainda não é JSON (${contentType||'content-type ausente'}); ${safeSnippet(text)}`};
  }
  if(String(data?.sha)!==sha){
    return {ok:false,reason:`fingerprint em outro commit: esperado ${sha}, recebido ${data?.sha||'sem sha'}`};
  }
  return {ok:true,value:data};
},{attempts:12,delay:3000,label:'Fingerprint da release'});

// Nos hosts oficiais o portal atual opera sem tela de login e o backend injeta identidade PMO sintética.
// Portanto /api/companies deve responder 200 sem Authorization. Isso também comprova Worker + D1 da release atual.
const data=await fetchUntil(`${base}/api/companies`,({res,text,contentType})=>{
  if(!res.ok) return {ok:false,reason:`/api/companies HTTP ${res.status}; ${safeSnippet(text)}`};
  let parsed;
  try{ parsed=JSON.parse(text); }
  catch{
    return {ok:false,reason:`/api/companies ainda não é JSON (${contentType||'content-type ausente'}); ${safeSnippet(text)}`};
  }
  if(!Array.isArray(parsed)) return {ok:false,reason:`/api/companies ainda não está live/no-login: ${safeSnippet(text)}`};
  return {ok:true,value:parsed};
},{attempts:12,delay:3000,label:'API live do Stage'});

console.log(`OK: URL canônica ${base} serve o commit ${release.sha} e API live sem login (${data.length} empresa(s)).`);
