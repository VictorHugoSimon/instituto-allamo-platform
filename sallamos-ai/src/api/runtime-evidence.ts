import type { Env } from '../types';
import { HttpError } from '../auth/session';
import { redactText,sanitizeForStorage } from '../privacy/redact';
import { importKnowledgeDraft } from './knowledge-admin';

const ALLOWED_KINDS=new Set(['api_exchange','error','successful_flow','support_resolution','telemetry','integration','permission_behavior']);

export async function handleRuntimeEvidence(req:Request,env:Env){
  await requireIngestToken(req,env);
  const body:any=await req.json().catch(()=>{throw new HttpError(400,'invalid_json')});
  const module=clean(body.module,60),version=clean(body.version,80),owner=clean(body.owner,120),kind=clean(body.kind,60),tenantId=clean(body.tenantId,120);
  const eventId=clean(body.eventId??req.headers.get('x-idempotency-key'),160);
  if(!module||!version||!owner||!kind||!tenantId||!eventId)throw new HttpError(400,'runtime_evidence_metadata_required');
  if(!ALLOWED_KINDS.has(kind))throw new HttpError(400,'runtime_evidence_kind_invalid');

  const prior:any=await env.META.prepare('SELECT document_id,received_at FROM runtime_evidence_event WHERE tenant_id=? AND external_event_id=? LIMIT 1').bind(tenantId,eventId).first();
  if(prior)return{status:'duplicate',eventId,tenantId,documentId:prior.document_id,receivedAt:prior.received_at,policy:'idempotent_no_reimport'};

  const observedAt=normalizeDate(body.observedAt),sourceUri=clean(body.sourceUri,500)||`runtime:${kind}`;
  const title=clean(body.title,160)||`${kind} · ${module} · ${observedAt}`;
  const summary=redactText(body.summary??'',5000).text,sanitizedPayload=sanitizeForStorage(body.payload??{}),payloadText=JSON.stringify(sanitizedPayload,null,2);
  const content=[`Tipo de evidência: ${kind}`,`Módulo: ${module}`,`Versão observada: ${version}`,`Tenant: ${tenantId}`,`Evento: ${eventId}`,`Observado em: ${observedAt}`,summary?`Resumo:\n${summary}`:'',payloadText&&payloadText!=='{}'?`Evidência técnica sanitizada:\n${payloadText}`:''].filter(Boolean).join('\n\n');
  if(content.length<80)throw new HttpError(400,'runtime_evidence_content_too_small');

  const documentId='kb:runtime:'+await shortHash(tenantId+':'+eventId),payloadHash=await shortHash(content);
  const result=await importKnowledgeDraft(env,{id:documentId,title,module,version,owner,sourceType:'history',content,sourceUri,scope:'tenant',tenantId},owner,'runtime.evidence.import');
  await env.META.prepare('INSERT OR IGNORE INTO runtime_evidence_event (tenant_id,external_event_id,document_id,kind,payload_hash,received_at) VALUES (?,?,?,?,?,?)').bind(tenantId,eventId,documentId,kind,payloadHash,new Date().toISOString()).run();
  return{...result,eventId,kind,observedAt,sourceType:'history',scope:'tenant',tenantId,policy:'draft_until_human_approval'};
}

async function requireIngestToken(req:Request,env:Env){
  const expected=String(env.EVIDENCE_INGEST_TOKEN??'').trim();if(!expected)throw new HttpError(503,'runtime_evidence_ingest_not_configured');
  const provided=(req.headers.get('authorization')??'').replace(/^Bearer\s+/i,'').trim();if(!provided||!(await secureEqual(provided,expected)))throw new HttpError(401,'invalid_ingest_token');
}
async function secureEqual(a:string,b:string){const enc=new TextEncoder();const[da,db]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const aa=new Uint8Array(da),bb=new Uint8Array(db);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0}
async function shortHash(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,40)}
function normalizeDate(value:unknown){const raw=String(value??'').trim();if(!raw)return new Date().toISOString();const d=new Date(raw);if(Number.isNaN(d.getTime()))throw new HttpError(400,'runtime_evidence_observed_at_invalid');return d.toISOString()}
function clean(value:unknown,max:number){return String(value??'').trim().slice(0,max)}
