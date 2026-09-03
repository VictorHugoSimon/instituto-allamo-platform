// Valkíria Service Hub — webhook Meta/WhatsApp executado antes da autenticação de usuário.
// Dependências disponíveis no escopo: request, env, url, path, json, DB e helpers do adapter Meta.
const shwMetaWebhookPath='service-hub/providers/whatsapp/webhook';
const shwMetaMaxBody=1024*1024;
const shwMetaClean=(v,max=500)=>String(v??'').trim().slice(0,max);
const shwMetaTableReady=async()=>!!(await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_hub_provider_events' LIMIT 1").first());
const shwMetaRedact=v=>{
  let t=String(v??'').slice(0,12000);
  const rules=[
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL_REDACTED]'],
    [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[CPF_REDACTED]'],
    [/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g,'[CNPJ_REDACTED]'],
    [/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g,'[PHONE_REDACTED]'],
    [/\b(?:\d[ -]*?){13,19}\b/g,'[CARD_REDACTED]'],
    [/(bearer\s+)[a-z0-9._~+\/-]+=*/gi,'$1[TOKEN_REDACTED]'],
    [/((?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*)[^\s,;]+/gi,'$1[SECRET_REDACTED]']
  ];
  for(const [r,repl] of rules)t=t.replace(r,repl);
  return t;
};
const shwMetaSenderHash=async(value,secret)=>{
  if(!value)return null;
  const data=new TextEncoder().encode(String(value)+':'+String(secret));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
};
const shwMetaStore=async row=>{
  try{
    await DB.prepare('INSERT INTO service_hub_provider_events(id,provider,provider_message_id,external_channel_id,phone_number_id,sender_ref_hash,text_redacted,occurred_at,status,error_code,channel_id,tenant_id,project_id,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind('pev:'+crypto.randomUUID(),'whatsapp',row.providerMessageId||null,row.externalChannelId||null,row.phoneNumberId||null,row.senderRefHash||null,row.textRedacted||'',row.occurredAt||null,row.status,row.errorCode||null,row.channelId||null,row.tenantId||null,row.projectId||null,JSON.stringify(row.metadata||{}).slice(0,4000)).run();
    return 'stored';
  }catch(e){
    const m=String(e&&e.message||e||'').toLowerCase();
    if(m.includes('unique')||m.includes('constraint'))return 'duplicate';
    throw e;
  }
};

if(path===shwMetaWebhookPath&&request.method==='GET'){
  const verifyToken=shwMetaClean(env.WHATSAPP_VERIFY_TOKEN,500);
  if(!verifyToken)return json({error:'WhatsApp webhook não configurado',code:'whatsapp_webhook_not_configured'},503);
  const challenge=verifyMetaChallenge(url,verifyToken);
  if(challenge===null)return json({error:'Verificação Meta recusada',code:'whatsapp_verify_failed'},403);
  return new Response(challenge,{status:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
}

if(path===shwMetaWebhookPath&&request.method==='POST'){
  let secrets;
  try{secrets=requireMetaWebhookSecrets(env)}catch(e){return json({error:'WhatsApp webhook não configurado',code:String(e&&e.message||e)},503)}
  const declared=Number(request.headers.get('content-length')||0);
  if(Number.isFinite(declared)&&declared>shwMetaMaxBody)return json({error:'Payload Meta excede o limite',code:'whatsapp_payload_too_large'},413);
  const rawBody=await request.text();
  if(rawBody.length>shwMetaMaxBody)return json({error:'Payload Meta excede o limite',code:'whatsapp_payload_too_large'},413);
  const signature=request.headers.get('x-hub-signature-256');
  if(!(await verifyMetaSignature(rawBody,signature,secrets.appSecret)))return json({error:'Assinatura Meta inválida',code:'whatsapp_signature_invalid'},401);
  const parsed=parseMetaWebhook(rawBody);
  if(!parsed.ok)return json({received:false,error:parsed.error},400);
  if(!(await shwMetaTableReady()))return json({error:'Quarentena WhatsApp ainda não foi provisionada',code:'whatsapp_ingress_schema_missing'},503);

  let stored=0,duplicates=0,unresolved=0,resolved=0,rejected=0;
  for(const failure of parsed.errors.slice(0,100)){
    const result=await shwMetaStore({providerMessageId:failure.providerMessageId,status:'rejected',errorCode:failure.error,metadata:{source:'meta_webhook'}});
    if(result==='duplicate')duplicates++;else{stored++;rejected++}
  }

  for(const message of parsed.messages.slice(0,100)){
    let channel=null;
    if(message.externalChannelId){
      channel=await DB.prepare("SELECT id,tenant_id,project_id FROM service_hub_channels WHERE provider='whatsapp' AND external_channel_id=? AND active=1 LIMIT 1").bind(message.externalChannelId).first();
    }
    const status=channel?'resolved':'unresolved';
    const result=await shwMetaStore({
      providerMessageId:message.providerMessageId,
      externalChannelId:message.externalChannelId,
      phoneNumberId:message.phoneNumberId,
      senderRefHash:await shwMetaSenderHash(message.senderRef,secrets.appSecret),
      textRedacted:shwMetaRedact(message.text),
      occurredAt:message.occurredAt,
      status,
      channelId:channel&&channel.id,
      tenantId:channel&&channel.tenant_id,
      projectId:channel&&channel.project_id,
      metadata:{providerType:message.providerType,requiresChannelResolution:message.requiresChannelResolution===true}
    });
    if(result==='duplicate')duplicates++;else{stored++;if(status==='resolved')resolved++;else unresolved++}
  }

  return json({received:true,stored,duplicates,unresolved,resolved,rejected,processing:'quarantine_only'},200);
}
