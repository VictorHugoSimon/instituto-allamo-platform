import type { Env } from '../types';
import { HttpError } from '../auth/session';
import { redactText,sanitizeForStorage } from '../privacy/redact';
import { importKnowledgeDraft } from './knowledge-admin';

const ALLOWED_KINDS=new Set(['api_exchange','error','successful_flow','support_resolution','telemetry','integration','permission_behavior']);

export async function handleRuntimeEvidence(req:Request,env:Env){
  await requireIngestToken(req,env);
  const body:any=await req.json().catch(()=>{throw new HttpError(400,'invalid_json')});
  const module=clean(body.module,60),version=clean(body.version,80),owner=clean(body.owner,120),kind=clean(body.kind,60);
  if(!module||!version||!owner||!kind)throw new HttpError(400,'runtime_evidence_metadata_required');
  if(!ALLOWED_KINDS.has(kind))throw new HttpError(400,'runtime_evidence_kind_invalid');

  const observedAt=normalizeDate(body.observedAt);const sourceUri=clean(body.sourceUri,500)||`runtime:${kind}`;
  const title=clean(body.title,160)||`${kind} · ${module} · ${observedAt}`;
  const summary=redactText(body.summary??'',5000).text;
  const sanitizedPayload=sanitizeForStorage(body.payload??{});
  const payloadText=JSON.stringify(sanitizedPayload,null,2);
  const content=[
    `Tipo de evidência: ${kind}`,
    `Módulo: ${module}`,
    `Versão observada: ${version}`,
    `Observado em: ${observedAt}`,
    summary?`Resumo:\n${summary}`:'',
    payloadText&&payloadText!=='{}'?`Evidência técnica sanitizada:\n${payloadText}`:''
  ].filter(Boolean).join('\n\n');
  if(content.length<80)throw new HttpError(400,'runtime_evidence_content_too_small');

  const result=await importKnowledgeDraft(env,{title,module,version,owner,sourceType:'history',content,sourceUri},owner,'runtime.evidence.import');
  return{...result,kind,observedAt,sourceType:'history',policy:'draft_until_human_approval'};
}

async function requireIngestToken(req:Request,env:Env){
  const expected=String(env.EVIDENCE_INGEST_TOKEN??'').trim();
  if(!expected)throw new HttpError(503,'runtime_evidence_ingest_not_configured');
  const provided=(req.headers.get('authorization')??'').replace(/^Bearer\s+/i,'').trim();
  if(!provided||!(await secureEqual(provided,expected)))throw new HttpError(401,'invalid_ingest_token');
}
async function secureEqual(a:string,b:string){
  const enc=new TextEncoder();const [da,db]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);
  const aa=new Uint8Array(da),bb=new Uint8Array(db);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
function normalizeDate(value:unknown){const raw=String(value??'').trim();if(!raw)return new Date().toISOString();const d=new Date(raw);if(Number.isNaN(d.getTime()))throw new HttpError(400,'runtime_evidence_observed_at_invalid');return d.toISOString()}
function clean(value:unknown,max:number){return String(value??'').trim().slice(0,max)}
