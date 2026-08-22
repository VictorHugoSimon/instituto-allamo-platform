import type { Env } from '../types';
import { sanitizeForStorage } from '../privacy/redact';

export type EventName='ai_question_received'|'ai_retrieval_completed'|'ai_answer_generated'|'ai_answer_shown'|'ai_feedback_received'|'ai_escalated'|'ai_human_resolved'|'knowledge_gap_detected'|'voice_session_completed';
const PERSIST=new Set<EventName>(['ai_feedback_received','ai_escalated','ai_human_resolved','knowledge_gap_detected','voice_session_completed']);

export async function emit(env:Env,name:EventName,payload:Record<string,unknown>){
  const safe=sanitizeForStorage(payload) as Record<string,unknown>; const at=new Date().toISOString();
  console.log(JSON.stringify({event:name,at,environment:env.ENVIRONMENT,prompt_version:env.PROMPT_VERSION,...safe}));
  if(!PERSIST.has(name))return;
  try{await env.META.prepare('INSERT INTO system_event (id, environment, event_type, tenant_id, user_id, request_id, payload, created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),env.ENVIRONMENT,name,stringOrNull(safe.tenant),stringOrNull(safe.user),stringOrNull(safe.request_id),JSON.stringify(safe).slice(0,12000),at).run()}catch(error){console.error(JSON.stringify({event:'telemetry_persist_failed',type:name,error:String(error)}))}
}
function stringOrNull(value:unknown){return value==null?null:String(value).slice(0,200)}
