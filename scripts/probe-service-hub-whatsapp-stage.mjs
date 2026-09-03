const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const endpoint=base+'/api/service-hub/providers/whatsapp/webhook';
const fail=m=>{throw new Error('[WHATSAPP STAGE PROBE] '+m)};

async function body(response){
  const text=await response.text();
  try{return JSON.parse(text)}catch{return text}
}

const challenge=new URL(endpoint);
challenge.searchParams.set('hub.mode','subscribe');
challenge.searchParams.set('hub.verify_token','probe-token-invalido');
challenge.searchParams.set('hub.challenge','probe-challenge-nao-aceitar');
const getResponse=await fetch(challenge,{headers:{'cache-control':'no-cache','pragma':'no-cache'},cache:'no-store'});
const getBody=await body(getResponse);
if(getResponse.status===200)fail('challenge falso foi aceito com HTTP 200.');
if(![403,503].includes(getResponse.status))fail(`GET esperado 403/503 e recebeu ${getResponse.status}: ${JSON.stringify(getBody)}`);
if(typeof getBody!=='object'||!['whatsapp_verify_failed','whatsapp_webhook_not_configured'].includes(String(getBody.code||''))){
  fail('GET não confirmou contrato fail-closed do webhook: '+JSON.stringify(getBody));
}

const postResponse=await fetch(endpoint,{
  method:'POST',
  headers:{'content-type':'application/json','x-hub-signature-256':'sha256=00','cache-control':'no-cache','pragma':'no-cache'},
  body:'{}',
  cache:'no-store'
});
const postBody=await body(postResponse);
if(postResponse.status===200)fail('POST com assinatura falsa foi aceito com HTTP 200.');
if(![401,503].includes(postResponse.status))fail(`POST esperado 401/503 e recebeu ${postResponse.status}: ${JSON.stringify(postBody)}`);
if(typeof postBody!=='object')fail('POST não retornou contrato JSON do webhook.');

console.log(JSON.stringify({
  ok:true,
  base,
  endpoint:'/api/service-hub/providers/whatsapp/webhook',
  fake_challenge_http:getResponse.status,
  fake_signature_http:postResponse.status,
  fail_closed:true
},null,2));
console.log('[OK] Webhook Meta/WhatsApp publicado no STAGE e fail-closed para challenge/assinatura inválidos.');
