import type { Env,KnowledgeScope,SourceType } from '../types';
import { HttpError } from '../auth/session';
import { requireAdmin } from './admin';
import { redactText } from '../privacy/redact';

const ALLOWED_TYPES=new Set<SourceType>(['doc','code','release','faq','history','tool']);
const MAX_CONTENT=200_000;

export interface KnowledgeDraftInput{ id?:string; title:string;module:string;version:string;owner:string;sourceType:SourceType;content:string;sourceUri?:string;scope?:KnowledgeScope;tenantId?:string }

export async function handleKnowledgeImport(req:Request,env:Env){
  requireAdmin(req,env);const body=(await req.json()) as any;
  return importKnowledgeDraft(env,{
    title:clean(body.title,160),module:clean(body.module,60),version:clean(body.version,80),owner:clean(body.owner,120),
    sourceType:String(body.sourceType??'doc') as SourceType,content:String(body.content??''),sourceUri:clean(body.sourceUri,500),
    scope:normalizeScope(body.scope),tenantId:clean(body.tenantId,120)
  },clean(body.owner,120)||'admin','knowledge.import');
}

export async function importKnowledgeDraft(env:Env,input:KnowledgeDraftInput,actor:string,auditAction='knowledge.import'){
  const title=clean(input.title,160),module=clean(input.module,60),version=clean(input.version,80),owner=clean(input.owner,120),sourceUri=clean(input.sourceUri,500);
  const sourceType=input.sourceType,raw=String(input.content??''),scope=normalizeScope(input.scope),tenantId=clean(input.tenantId,120);
  if(!title||!module||!version||!owner)throw new HttpError(400,'knowledge_metadata_required');
  if(!ALLOWED_TYPES.has(sourceType))throw new HttpError(400,'invalid_source_type');
  if(scope==='tenant'&&!tenantId)throw new HttpError(400,'tenant_scope_requires_tenant_id');
  if(raw.length<40)throw new HttpError(400,'knowledge_content_too_small');
  if(raw.length>MAX_CONTENT)throw new HttpError(413,'knowledge_content_too_large');

  const sanitized=redactText(raw,MAX_CONTENT),id=clean(input.id,180)||'kb:'+crypto.randomUUID();
  const existing:any=await env.META.prepare('SELECT id,status FROM knowledge_document WHERE id=? LIMIT 1').bind(id).first();
  if(existing)return{status:'duplicate',documentId:id,existingStatus:existing.status,next:'no_action'};

  const now=new Date().toISOString(),hash=await sha256(sanitized.text),chunks=split(sanitized.text,1800);
  await env.META.prepare(`INSERT INTO knowledge_document (id,source_type,title,module,version,owner,status,source_uri,content_hash,updated_at,scope,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,sourceType,title,module,version,owner,'rascunho',sourceUri||'admin-upload',hash,now,scope,scope==='tenant'?tenantId:null).run();
  const statements:D1PreparedStatement[]=[];
  chunks.forEach((text,i)=>{const chunkId=id+'#'+i;statements.push(env.META.prepare('INSERT INTO knowledge_chunk (id,document_id,chunk_index,text,symbol,path,commit_sha,module,version,hash,embedded) VALUES (?,?,?,?,?,?,?,?,?,?,0)').bind(chunkId,id,i,text,'',sourceUri||'',null,module,version,hashText(text)));statements.push(env.META.prepare('INSERT INTO chunk_fts (text,symbol,path,chunk_id) VALUES (?,?,?,?)').bind(text,'',sourceUri||'',chunkId))});
  for(let i=0;i<statements.length;i+=40)await env.META.batch(statements.slice(i,i+40));
  await env.SOURCES.put(`knowledge/${id}.txt`,sanitized.text,{httpMetadata:{contentType:'text/plain; charset=utf-8'},customMetadata:{documentId:id,status:'rascunho',module,version,scope,tenantId:scope==='tenant'?tenantId:''}});
  await audit(env,auditAction,id,clean(actor,120)||owner,{title,module,version,sourceType,scope,tenantId:scope==='tenant'?tenantId:null,redacted:sanitized.redacted,chunks:chunks.length,sourceUri:sourceUri||null});
  return{status:'draft',documentId:id,chunks:chunks.length,redacted:sanitized.redacted,scope,tenantId:scope==='tenant'?tenantId:null,next:'human_approval_required'};
}

export async function handleKnowledgeApproval(req:Request,env:Env,documentId:string){
  requireAdmin(req,env);const body=(await req.json()) as any,approvedBy=clean(body.approvedBy,120),evidence=clean(body.approvalEvidence,1000);
  if(!approvedBy||!evidence||evidence.length<10)throw new HttpError(400,'approval_evidence_required');
  const doc:any=await env.META.prepare('SELECT id,title,module,version,owner,status,scope,tenant_id FROM knowledge_document WHERE id=? LIMIT 1').bind(documentId).first();
  if(!doc)throw new HttpError(404,'knowledge_document_not_found');
  if(doc.status==='homologado')return{status:'already_approved',documentId,scope:doc.scope,tenantId:doc.tenant_id??null};
  if(!doc.owner)throw new HttpError(409,'knowledge_owner_required');

  const targetScope=normalizeScope(body.publishScope??doc.scope),targetTenant=targetScope==='tenant'?clean(body.tenantId??doc.tenant_id,120):'';
  if(targetScope==='tenant'&&!targetTenant)throw new HttpError(400,'tenant_scope_requires_tenant_id');
  if(doc.scope==='tenant'&&targetScope==='global'){
    const globalizationEvidence=clean(body.globalizationEvidence,1500);
    if(globalizationEvidence.length<20)throw new HttpError(400,'globalization_evidence_required');
  }

  const now=new Date().toISOString();
  await env.META.batch([
    env.META.prepare("UPDATE knowledge_document SET status='homologado',scope=?,tenant_id=?,updated_at=? WHERE id=?").bind(targetScope,targetScope==='tenant'?targetTenant:null,now,documentId),
    env.META.prepare('UPDATE knowledge_chunk SET embedded=0 WHERE document_id=?').bind(documentId)
  ]);
  await audit(env,'knowledge.approve',documentId,approvedBy,{approvalEvidence:evidence,title:doc.title,module:doc.module,version:doc.version,owner:doc.owner,previousScope:doc.scope,publishScope:targetScope,tenantId:targetScope==='tenant'?targetTenant:null,globalizationEvidence:doc.scope==='tenant'&&targetScope==='global'?clean(body.globalizationEvidence,1500):null});
  return{status:'homologado',documentId,scope:targetScope,tenantId:targetScope==='tenant'?targetTenant:null,reindexRequired:true};
}

export async function handleKnowledgeReject(req:Request,env:Env,documentId:string){
  requireAdmin(req,env);const body=(await req.json()) as any,actor=clean(body.rejectedBy,120),reason=clean(body.reason,1000);if(!actor||!reason)throw new HttpError(400,'rejection_reason_required');
  const doc:any=await env.META.prepare('SELECT id,status FROM knowledge_document WHERE id=? LIMIT 1').bind(documentId).first();if(!doc)throw new HttpError(404,'knowledge_document_not_found');
  await env.META.prepare("UPDATE knowledge_document SET status='rejeitado',updated_at=? WHERE id=?").bind(new Date().toISOString(),documentId).run();await audit(env,'knowledge.reject',documentId,actor,{reason});return{status:'rejeitado',documentId};
}

async function audit(env:Env,action:string,documentId:string,actor:string,result:unknown){await env.META.prepare('INSERT INTO action_audit (id,tenant,user_id,tool,action,dry_run,confirmation,result,actor,timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'system',actor,'knowledge-admin',action,0,documentId,JSON.stringify(result).slice(0,12000),actor,new Date().toISOString()).run()}
function normalizeScope(v:unknown):KnowledgeScope{const x=String(v??'global').trim().toLowerCase();if(x==='global'||x==='tenant')return x;throw new HttpError(400,'invalid_knowledge_scope')}
function clean(v:unknown,max:number){return String(v??'').trim().slice(0,max)}
function hashText(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
async function sha256(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function split(value:string,max:number){const blocks=value.replace(/\r/g,'').split(/\n\s*\n/),out:string[]=[];let current='';for(const block of blocks){const next=current?current+'\n\n'+block:block;if(next.length<=max){current=next;continue}if(current.trim())out.push(current.trim());if(block.length<=max){current=block;continue}for(let i=0;i<block.length;i+=max)out.push(block.slice(i,i+max).trim());current=''}if(current.trim())out.push(current.trim());return out.filter(x=>x.length>20)}
