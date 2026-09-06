// Valkíria Service Hub — fila administrativa de eventos de provedores.
// Executa após autenticação de usuário e antes do guard tenant-scoped da API principal.
const shpPathPrefix='service-hub/provider-events';
const shpReadinessPath='service-hub/providers/whatsapp/readiness';
const shpHasRealSession=!!user&&user.__portal_no_login!==true;
const shpCanReview=shpHasRealSession&&['admin','pmo','techlead'].includes(user.role);
const shpClean=(v,max=500)=>String(v??'').trim().slice(0,max);
const shpDecode=v=>{try{return decodeURIComponent(String(v??''))}catch{return ''}};
const shpId=()=>`aud:${crypto.randomUUID()}`;
const shpJsonBody=()=>request.json().catch(()=>({}));
const shpTable=async name=>!!(await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(name).first());
const shpReady=async()=>await shpTable('service_hub_provider_events');
const shpOneChange=result=>Number(result&&result.meta&&result.meta.changes||0)===1;
const shpAuthorize=()=>{
  if(!shpHasRealSession)return json({error:'Sessão autenticada obrigatória para revisar a quarentena do WhatsApp',code:'authenticated_session_required'},401);
  if(!shpCanReview)return json({error:'Sem permissão para revisar a quarentena do WhatsApp'},403);
  return null;
};

if(path===shpReadinessPath&&request.method==='GET'){
  const denied=shpAuthorize();if(denied)return denied;
  const ingressSchemaReady=await shpReady();
  const channelsSchemaReady=await shpTable('service_hub_channels');
  if(!ingressSchemaReady||!channelsSchemaReady)return json({error:'Schema do WhatsApp ainda não foi provisionado',code:'whatsapp_readiness_schema_missing'},503);

  const verifyTokenConfigured=!!shpClean(env.WHATSAPP_VERIFY_TOKEN,500);
  const appSecretConfigured=!!shpClean(env.WHATSAPP_APP_SECRET,500);
  const accessTokenConfigured=!!shpClean(env.WHATSAPP_ACCESS_TOKEN,2000);
  const graphVersionConfigured=/^v\d+\.\d+$/.test(shpClean(env.WHATSAPP_GRAPH_VERSION,30));
  const wabaIdConfigured=!!shpClean(env.WHATSAPP_WABA_ID,120);
  const phoneNumberIdConfigured=!!shpClean(env.WHATSAPP_PHONE_NUMBER_ID,120);

  const counts=await DB.prepare("SELECT SUM(CASE WHEN status='unresolved' THEN 1 ELSE 0 END) unresolved,SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) resolved,SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) rejected,SUM(CASE WHEN status='ignored' THEN 1 ELSE 0 END) ignored,MAX(received_at) last_event_at FROM service_hub_provider_events WHERE provider='whatsapp'").first()||{};
  const channels=await DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN external_channel_id IS NOT NULL AND TRIM(external_channel_id)<>'' THEN 1 ELSE 0 END) mapped FROM service_hub_channels WHERE provider='whatsapp' AND active=1").first()||{};

  return json({
    provider:'whatsapp',
    schemaReady:true,
    inboundReady:verifyTokenConfigured&&appSecretConfigured,
    outboundReady:accessTokenConfigured&&graphVersionConfigured&&phoneNumberIdConfigured,
    wabaSubscriptionReady:accessTokenConfigured&&graphVersionConfigured&&wabaIdConfigured,
    configuration:{
      verifyTokenConfigured,
      appSecretConfigured,
      accessTokenConfigured,
      graphVersionConfigured,
      wabaIdConfigured,
      phoneNumberIdConfigured
    },
    channels:{active:Number(channels.total||0),mapped:Number(channels.mapped||0)},
    quarantine:{
      unresolved:Number(counts.unresolved||0),
      resolved:Number(counts.resolved||0),
      rejected:Number(counts.rejected||0),
      ignored:Number(counts.ignored||0),
      lastEventAt:counts.last_event_at||null
    },
    groups:{status:'external_validation_required'},
    secretsExposed:false
  });
}

if(path===shpPathPrefix&&request.method==='GET'){
  const denied=shpAuthorize();if(denied)return denied;
  if(!(await shpReady()))return json({error:'Quarentena WhatsApp ainda não foi provisionada',code:'whatsapp_ingress_schema_missing'},503);
  const allowed=['unresolved','resolved','rejected','ignored'];
  const status=shpClean(url.searchParams.get('status')||'unresolved',30).toLowerCase();
  if(!allowed.includes(status))return json({error:'Status de quarentena inválido'},400);
  const rawLimit=Number(url.searchParams.get('limit')||50),limit=Math.min(100,Math.max(1,Number.isFinite(rawLimit)?Math.trunc(rawLimit):50));
  const rows=(await DB.prepare(`SELECT id,provider,provider_message_id,external_channel_id,phone_number_id,text_redacted,occurred_at,received_at,status,error_code,channel_id,tenant_id,project_id,metadata_json FROM service_hub_provider_events WHERE status=? ORDER BY received_at DESC LIMIT ?`).bind(status,limit).all()).results||[];
  return json(rows.map(r=>({...r,metadata:safeProviderMetadata(r.metadata_json)})));
}

if(path.startsWith(shpPathPrefix+'/')&&request.method==='POST'){
  const denied=shpAuthorize();if(denied)return denied;
  if(!(await shpReady()))return json({error:'Quarentena WhatsApp ainda não foi provisionada',code:'whatsapp_ingress_schema_missing'},503);
  const parts=path.split('/'),eventId=shpClean(shpDecode(parts[2]),180),action=shpClean(parts[3],30).toLowerCase();
  if(!eventId||!['resolve','ignore','reject'].includes(action))return json({error:'Ação de quarentena inválida'},400);
  const event=await DB.prepare('SELECT * FROM service_hub_provider_events WHERE id=? LIMIT 1').bind(eventId).first();
  if(!event)return json({error:'Evento de provedor não encontrado'},404);
  if(String(event.status)!=='unresolved')return json({error:'Evento de provedor já revisado',code:'provider_event_already_reviewed',status:event.status},409);
  const now=new Date().toISOString(),actor=String(user.id||user.email||user.name||'');

  if(action==='resolve'){
    const body=await shpJsonBody(),channelId=shpClean(body.channelId,180);
    if(!channelId)return json({error:'Informe o canal para resolver o evento'},400);
    const channel=await DB.prepare("SELECT id,tenant_id,project_id,provider,name FROM service_hub_channels WHERE id=? AND active=1 LIMIT 1").bind(channelId).first();
    if(!channel)return json({error:'Canal não encontrado ou inativo'},404);
    if(String(channel.provider)!=='whatsapp')return json({error:'O evento WhatsApp só pode ser associado a canal WhatsApp'},400);
    const changed=await DB.prepare("UPDATE service_hub_provider_events SET status='resolved',channel_id=?,tenant_id=?,project_id=?,error_code=NULL WHERE id=? AND status='unresolved'").bind(channel.id,channel.tenant_id,channel.project_id,eventId).run();
    if(!shpOneChange(changed))return json({error:'Evento foi revisado por outro usuário',code:'provider_event_concurrent_review'},409);
    if(await shpTable('service_hub_audit_log')){
      await DB.prepare('INSERT INTO service_hub_audit_log(id,tenant_id,entity_type,entity_id,action,actor_type,actor_ref,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(shpId(),channel.tenant_id,'provider_event',eventId,'resolve','user',actor,JSON.stringify({channelId:channel.id,projectId:channel.project_id,provider:'whatsapp'}),now).run();
    }
    await logEvent(env,user,'service-hub:whatsapp-event-resolve',eventId,`Canal ${channel.id}`);
    return json({ok:true,id:eventId,status:'resolved',channelId:channel.id,tenantId:channel.tenant_id,projectId:channel.project_id});
  }

  const nextStatus=action==='ignore'?'ignored':'rejected';
  const body=await shpJsonBody(),reason=shpClean(body.reason,500);
  const changed=await DB.prepare("UPDATE service_hub_provider_events SET status=?,error_code=? WHERE id=? AND status='unresolved'").bind(nextStatus,reason||action,eventId).run();
  if(!shpOneChange(changed))return json({error:'Evento foi revisado por outro usuário',code:'provider_event_concurrent_review'},409);
  if(event.tenant_id&&await shpTable('service_hub_audit_log')){
    await DB.prepare('INSERT INTO service_hub_audit_log(id,tenant_id,entity_type,entity_id,action,actor_type,actor_ref,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(shpId(),event.tenant_id,'provider_event',eventId,action,'user',actor,JSON.stringify({reason:reason||null}),now).run();
  }
  await logEvent(env,user,`service-hub:whatsapp-event-${action}`,eventId,reason||action);
  return json({ok:true,id:eventId,status:nextStatus});
}

function safeProviderMetadata(raw){
  try{
    const parsed=JSON.parse(String(raw||'{}'));
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
    const out={};
    for(const key of ['providerType','requiresChannelResolution'])if(Object.prototype.hasOwnProperty.call(parsed,key))out[key]=parsed[key];
    return out;
  }catch{return {}}
}
