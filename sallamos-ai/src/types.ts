export interface Env {
  AI:any; META:D1Database; VEC:VectorizeIndex; SOURCES:R2Bucket; RATE_LIMITER?:RateLimit;
  ENVIRONMENT:'stage'|'production'|string; AUTH_MODE:'hmac'|'external'|string;
  AI_GATEWAY_ID:string; EMBEDDING_MODEL:string; ANSWER_MODEL:string; PROMPT_VERSION:string;
  CONFIDENCE_ANSWER:string; CONFIDENCE_CLARIFY:string; RATE_LIMIT_PER_MINUTE?:string;
  AUTH_TIMEOUT_MS?:string; CONTEXT_TIMEOUT_MS?:string; DATA_RETENTION_DAYS?:string; EVENT_RETENTION_DAYS?:string;
  DEMO_MODE?:string; ALLOWED_ORIGINS?:string; SALLAMOS_API_BASE?:string; SALLAMOS_AUTH_VALIDATE_URL?:string;
  SALLAMOS_SESSION_SECRET:string; SALLAMOS_API_TOKEN?:string; REPO_READ_TOKEN?:string; ADMIN_TOKEN:string;
}
export interface SessionContext{tenantId:string;userId:string;profile:string;permissions:string[];productVersion:string;locale:string}
export type SourceType='doc'|'code'|'release'|'faq'|'history'|'tool';
export interface Hit{chunkId:string;documentId:string;sourceType:SourceType;text:string;path?:string;symbol?:string;commitSha?:string;module?:string;version?:string;status?:string;owner?:string;score:number;origin:'semantic'|'lexical'}
export interface Filters{module?:string;version?:string;onlyApproved?:boolean}
export interface ModelOutput{intent:string;module:string;answer:string;steps:string[];sources:Array<{type:SourceType;id:string;version?:string}>;needs_clarification:boolean;missing_context:string[];risk_level:'low'|'medium'|'high';model_notes?:string}
export type Decision='answer'|'clarify'|'escalate';
export interface Signals{retrievalRelevance:number;sourceAuthority:number;recency:number;corroboration:number;minimumContext:number;actionRisk:number}
