import type { Env } from '../types';
const BATCH=50;
export async function embedPending(env:Env):Promise<{done:boolean;embedded:number}>{
  const rows=await env.META.prepare(`SELECT c.id,c.text,c.module,c.version,c.path,c.commit_sha,d.status,d.source_type,d.owner,d.scope,d.tenant_id FROM knowledge_chunk c JOIN knowledge_document d ON d.id=c.document_id WHERE c.embedded=0 AND d.status='homologado' LIMIT ?`).bind(BATCH).all();
  const pending=rows.results??[];if(!pending.length)return{done:true,embedded:0};
  const out=await env.AI.run(env.EMBEDDING_MODEL,{text:pending.map((r:any)=>r.text)});
  await env.VEC.upsert(pending.map((r:any,i:number)=>({id:r.id,values:out.data[i],metadata:{module:r.module??'',version:r.version??'',path:r.path??'',commit:r.commit_sha??'',status:r.status??'',source_type:r.source_type??'',owner:r.owner??'',scope:r.scope??'global',tenant_id:r.tenant_id??''}})));
  const ids=pending.map((r:any)=>r.id),placeholders=ids.map(()=>'?').join(',');await env.META.prepare('UPDATE knowledge_chunk SET embedded=1 WHERE id IN ('+placeholders+')').bind(...ids).run();return{done:pending.length<BATCH,embedded:ids.length};
}
