import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMetaChallenge,verifyMetaSignature,parseMetaWebhook,requireMetaWebhookSecrets} from '../src/providers/meta-whatsapp.mjs';

async function signature(body,secret){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));
  return 'sha256='+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}

test('challenge só retorna com token correto',()=>{
  const ok=new URL('https://x.test/api/service-hub/providers/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=abc&hub.challenge=123');
  assert.equal(verifyMetaChallenge(ok,'abc'),'123');
  assert.equal(verifyMetaChallenge(ok,'errado'),null);
});

test('assinatura HMAC válida e adulteração bloqueada',async()=>{
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[]}),secret='app-secret-teste';
  const sig=await signature(body,secret);
  assert.equal(await verifyMetaSignature(body,sig,secret),true);
  assert.equal(await verifyMetaSignature(body+'x',sig,secret),false);
  assert.equal(await verifyMetaSignature(body,'sha256=invalida',secret),false);
});

test('webhook normaliza mensagem sem inventar externalChannelId',()=>{
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'waba-1',changes:[{field:'messages',value:{metadata:{phone_number_id:'phone-1',display_phone_number:'5511000000000'},messages:[{id:'wamid.1',from:'5511999999999',timestamp:'1788436800',type:'text',text:{body:'Preciso de ajuda'}}]}}]}]});
  const parsed=parseMetaWebhook(body);
  assert.equal(parsed.ok,true);assert.equal(parsed.messages.length,1);
  const m=parsed.messages[0];
  assert.equal(m.provider,'whatsapp');assert.equal(m.providerMessageId,'wamid.1');assert.equal(m.text,'Preciso de ajuda');assert.equal(m.externalChannelId,null);assert.equal(m.requiresChannelResolution,true);
});

test('resolução de canal é injetável e desacoplada do parser Meta',()=>{
  const payload={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messages:[{id:'m1',from:'u1',timestamp:'1788436800',type:'text',text:{body:'Oi'},group_ref:'g1'}]}}]}]};
  const parsed=parseMetaWebhook(payload,{resolveExternalChannelId:({message})=>message.group_ref});
  assert.equal(parsed.messages[0].externalChannelId,'g1');assert.equal(parsed.messages[0].requiresChannelResolution,false);
});

test('segredos obrigatórios falham fechados',()=>{
  assert.throws(()=>requireMetaWebhookSecrets({}),/whatsapp_verify_token_missing/);
  assert.throws(()=>requireMetaWebhookSecrets({WHATSAPP_VERIFY_TOKEN:'x'}),/whatsapp_app_secret_missing/);
  assert.deepEqual(requireMetaWebhookSecrets({WHATSAPP_VERIFY_TOKEN:'x',WHATSAPP_APP_SECRET:'y'}),{verifyToken:'x',appSecret:'y'});
});
