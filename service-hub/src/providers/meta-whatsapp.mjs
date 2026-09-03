// Adapter puro da Meta/WhatsApp. Não conhece tenant, projeto ou regra de negócio.
// O vínculo externalChannelId -> tenant/project/system continua no intake do Service Hub.

export function verifyMetaChallenge(url, verifyToken) {
  const mode=String(url.searchParams.get('hub.mode')??'');
  const token=String(url.searchParams.get('hub.verify_token')??'');
  const challenge=String(url.searchParams.get('hub.challenge')??'');
  if(mode!=='subscribe'||!verifyToken||!safeEqualText(token,String(verifyToken))) return null;
  return challenge;
}

export async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  const header=String(signatureHeader??'').trim();
  const secret=String(appSecret??'');
  if(!secret||!/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(String(rawBody??''))));
  const expected='sha256='+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
  return safeEqualText(expected.toLowerCase(),header.toLowerCase());
}

export function parseMetaWebhook(rawBody, {resolveExternalChannelId}={}) {
  let payload;
  try{payload=typeof rawBody==='string'?JSON.parse(rawBody):rawBody}catch{return {ok:false,error:'invalid_json',messages:[]}}
  if(!payload||payload.object!=='whatsapp_business_account'||!Array.isArray(payload.entry)) return {ok:false,error:'unsupported_payload',messages:[]};
  const messages=[];
  for(const entry of payload.entry){
    for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
      if(change?.field!=='messages')continue;
      const value=change?.value??{};
      for(const message of Array.isArray(value.messages)?value.messages:[]){
        const providerMessageId=clean(message?.id,300);
        if(!providerMessageId)continue;
        const type=clean(message?.type,40);
        const text=extractText(message);
        const externalChannelId=typeof resolveExternalChannelId==='function'
          ? clean(resolveExternalChannelId({entry,change,value,message}),300)
          : '';
        messages.push({
          provider:'whatsapp',
          providerMessageId,
          externalChannelId:externalChannelId||null,
          senderRef:clean(message?.from,180)||null,
          occurredAt:fromEpoch(message?.timestamp),
          text,
          providerType:type||'unknown',
          phoneNumberId:clean(value?.metadata?.phone_number_id,120)||null,
          displayPhoneNumber:clean(value?.metadata?.display_phone_number,80)||null,
          requiresChannelResolution:!externalChannelId
        });
      }
    }
  }
  return {ok:true,messages};
}

export function requireMetaWebhookSecrets(env={}) {
  const verifyToken=clean(env.WHATSAPP_VERIFY_TOKEN,500);
  const appSecret=clean(env.WHATSAPP_APP_SECRET,500);
  if(!verifyToken)throw new Error('whatsapp_verify_token_missing');
  if(!appSecret)throw new Error('whatsapp_app_secret_missing');
  return {verifyToken,appSecret};
}

function extractText(message){
  const type=String(message?.type??'');
  if(type==='text')return clean(message?.text?.body,12000);
  if(type==='button')return clean(message?.button?.text,12000);
  if(type==='interactive')return clean(message?.interactive?.button_reply?.title??message?.interactive?.list_reply?.title,12000);
  // Mídia/documentos ficam sem conteúdo textual até a política de anexos ser definida.
  return '';
}
function fromEpoch(v){const n=Number(v);return Number.isFinite(n)&&n>0?new Date(n*1000).toISOString():new Date().toISOString()}
function clean(v,max=500){return String(v??'').trim().slice(0,max)}
function safeEqualText(a,b){
  const aa=new TextEncoder().encode(String(a??'')),bb=new TextEncoder().encode(String(b??''));
  if(aa.length!==bb.length)return false;
  let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
