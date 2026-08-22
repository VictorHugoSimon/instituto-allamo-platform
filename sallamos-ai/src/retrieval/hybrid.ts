import type { Env, Filters, Hit } from '../types';
import { rerank } from './rerank';

export interface RetrievalResult { hits: Hit[]; trace: { query: string; semantic: number; lexical: number; latencyMs: number } }

export async function hybridSearch(env:Env,query:string,filters:Filters):Promise<RetrievalResult>{
  const started=Date.now(),emb=await env.AI.run(env.EMBEDDING_MODEL,{text:[query]}),lexicalQuery=sanitizeMatch(query);
  const semanticFilter:Record<string,string>={};if(filters.onlyApproved)semanticFilter.status='homologado';if(filters.module)semanticFilter.module=filters.module;
  const semanticPromise=env.VEC.query(emb.data[0],{topK:24,returnMetadata:'all',...(Object.keys(semanticFilter).length?{filter:semanticFilter}:{})});
  const lexicalPromise=lexicalQuery?lexicalSearch(env,lexicalQuery,filters):Promise.resolve({results:[]});
  const[semantic,lexical]=await Promise.all([semanticPromise,lexicalPromise]),semanticIds=semantic.matches.map((m:any)=>m.id);
  const semanticHits=semanticIds.length?await hydrate(env,semanticIds,semantic.matches,filters):[],lexicalHits=(lexical.results??[]).map(toLexicalHit);
  return{hits:rerank([...semanticHits,...lexicalHits],filters),trace:{query,semantic:semanticHits.length,lexical:lexicalHits.length,latencyMs:Date.now()-started}};
}

function lexicalSearch(env:Env,lexicalQuery:string,filters:Filters){
  const where=['chunk_fts MATCH ?'],bindings:unknown[]=[lexicalQuery];if(filters.onlyApproved)where.push("d.status = 'homologado'");if(filters.module){where.push('c.module = ?');bindings.push(filters.module)};
  if(filters.tenantId){where.push("(d.scope = 'global' OR (d.scope = 'tenant' AND d.tenant_id = ?))");bindings.push(filters.tenantId)}else where.push("d.scope = 'global'");
  return env.META.prepare(`SELECT c.id,c.document_id,c.text,c.symbol,c.path,c.commit_sha,c.module,c.version,d.source_type,d.status,d.owner,d.scope,d.tenant_id,bm25(chunk_fts) AS rank FROM chunk_fts JOIN knowledge_chunk c ON c.id=chunk_fts.chunk_id JOIN knowledge_document d ON d.id=c.document_id WHERE ${where.join(' AND ')} ORDER BY rank LIMIT 12`).bind(...bindings).all();
}

async function hydrate(env:Env,ids:string[],matches:any[],filters:Filters):Promise<Hit[]>{
  const placeholders=ids.map(()=>'?').join(','),where=[`c.id IN (${placeholders})`],bindings:unknown[]=[...ids];
  if(filters.tenantId){where.push("(d.scope = 'global' OR (d.scope = 'tenant' AND d.tenant_id = ?))");bindings.push(filters.tenantId)}else where.push("d.scope = 'global'");
  const rows=await env.META.prepare(`SELECT c.id,c.document_id,c.text,c.symbol,c.path,c.commit_sha,c.module,c.version,d.source_type,d.status,d.owner,d.scope,d.tenant_id FROM knowledge_chunk c JOIN knowledge_document d ON d.id=c.document_id WHERE ${where.join(' AND ')}`).bind(...bindings).all();
  const scoreById=new Map(matches.map((m:any)=>[m.id,m.score]));return(rows.results??[]).map((r:any)=>({chunkId:r.id,documentId:r.document_id,sourceType:r.source_type,text:r.text,path:r.path,symbol:r.symbol,commitSha:r.commit_sha,module:r.module,version:r.version,status:r.status,owner:r.owner,scope:r.scope,tenantId:r.tenant_id??undefined,score:scoreById.get(r.id)??0,origin:'semantic' as const}));
}
function toLexicalHit(r:any):Hit{return{chunkId:r.id,documentId:r.document_id,sourceType:r.source_type,text:r.text,path:r.path,symbol:r.symbol,commitSha:r.commit_sha,module:r.module,version:r.version,status:r.status,owner:r.owner,scope:r.scope,tenantId:r.tenant_id??undefined,score:Math.min(1,1/(1+Math.abs(r.rank??10))),origin:'lexical'}}
function sanitizeMatch(q:string):string{return q.replace(/["*():^-]/g,' ').split(/\s+/).map(t=>t.trim()).filter(t=>t.length>=2).slice(0,16).map(t=>'"'+t.replace(/"/g,'')+'"').join(' OR ')}
