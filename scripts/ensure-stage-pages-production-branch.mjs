#!/usr/bin/env node

const accountId=String(process.env.CLOUDFLARE_ACCOUNT_ID||'').trim();
const token=String(process.env.CLOUDFLARE_API_TOKEN||'').trim();
const apiKey=String(process.env.CLOUDFLARE_API_KEY||'').trim();
const email=String(process.env.CLOUDFLARE_EMAIL||'').trim();
const project='allamo-pmo-stage';
const desiredBranch='develop';

if(!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID ausente.');
if(!token && !(apiKey&&email)) throw new Error('Credencial Cloudflare ausente para validar o production_branch do Stage.');

const headers={accept:'application/json','content-type':'application/json'};
if(token) headers.authorization='Bearer '+token;
else {
  headers['x-auth-key']=apiKey;
  headers['x-auth-email']=email;
}

const endpoint=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(project)}`;

async function request(method,body){
  const res=await fetch(endpoint,{method,headers,body:body?JSON.stringify(body):undefined});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok || payload.success===false){
    const msg=(payload.errors||[]).map(e=>e?.message||e?.code).filter(Boolean).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare Pages: ${msg}`);
  }
  return payload.result||payload;
}

let current=await request('GET');
const before=String(current?.production_branch||'');
if(before!==desiredBranch){
  await request('PATCH',{production_branch:desiredBranch});
  current=await request('GET');
}

const after=String(current?.production_branch||'');
if(after!==desiredBranch){
  throw new Error(`Production branch do projeto ${project} continua '${after||'(vazia)'}'; esperado '${desiredBranch}'.`);
}

console.log(JSON.stringify({
  pagesProject:project,
  productionBranchBefore:before||null,
  productionBranchAfter:after,
  changed:before!==after,
  canonicalUrl:`https://${project}.pages.dev`
},null,2));
