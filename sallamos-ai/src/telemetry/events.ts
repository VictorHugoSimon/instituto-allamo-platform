import type { Env } from '../types';

export type EventName =
  | 'ai_question_received' | 'ai_retrieval_completed' | 'ai_answer_generated'
  | 'ai_answer_shown' | 'ai_feedback_received' | 'ai_escalated'
  | 'ai_human_resolved' | 'knowledge_gap_detected' | 'voice_session_completed';

export async function emit(env: Env, name: EventName, payload: Record<string, unknown>) {
  console.log(JSON.stringify({
    event: name,
    at: new Date().toISOString(),
    prompt_version: env.PROMPT_VERSION,
    ...payload
  }));
}
