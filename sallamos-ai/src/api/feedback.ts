import type { Env } from '../types';
import { HttpError, requirePermission, requireSession } from '../auth/session';
import { emit } from '../telemetry/events';
import { redactText } from '../privacy/redact';

export async function handleFeedback(req:Request,env:Env,_path:string){
  const ctx=await requireSession(req,env);requirePermission(ctx,'ai:feedback:create');const body=(await req.json()) as {responseId:string;solved:boolean;rating?:number;comment?:string};
  if(!body.responseId)throw new HttpError(400,'response_id_required');
  const owned:any=await env.META.prepare(`SELECT ar.id FROM ai_response ar JOIN message m ON m.id=ar.message_id JOIN conversation c ON c.id=m.conversation_id WHERE ar.id=? AND c.tenant_id=? LIMIT 1`).bind(body.responseId,ctx.tenantId).first();
  if(!owned)throw new HttpError(404,'response_not_found');
  const rating=body.rating==null?null:Math.max(1,Math.min(5,Number(body.rating))); const comment=body.comment?redactText(String(body.comment).slice(0,1000)).text:null;
  await env.META.prepare('INSERT INTO feedback (id, response_id, solved, rating, comment, created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),body.responseId,body.solved?1:0,rating,comment,new Date().toISOString()).run();
  await emit(env,'ai_feedback_received',{tenant:ctx.tenantId,solved:body.solved,rating,reason:comment});if(!body.solved)await emit(env,'knowledge_gap_detected',{tenant:ctx.tenantId,response:body.responseId});return{status:'recorded'};
}
