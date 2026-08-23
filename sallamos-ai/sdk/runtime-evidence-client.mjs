// Server-side SDK. Nunca embarque EVIDENCE_INGEST_TOKEN no browser/mobile.
export function createRuntimeEvidenceClient(config={}){
  const baseUrl=String(config.baseUrl||'').replace(/\/$/,'');const token=String(config.token||'');const tenantId=String(config.tenantId||'');const owner=String(config.owner||'');const version=String(config.version||'');const defaultModule=String(config.module||'');
  if(!baseUrl||!token||!tenantId||!owner||!version)throw new Error('runtime_evidence_client_config_required');
  return{emit:async(event={})=>{
    const eventId=String(event.eventId||randomId()),module=String(event.module||defaultModule);if(!module)throw new Error('runtime_evidence_module_required');
    const body={eventId,tenantId,owner,version,module,kind:event.kind,observedAt:event.observedAt||new Date().toISOString(),title:event.title,summary:sanitizeText(event.summary||''),sourceUri:event.sourceUri,payload:sanitize(event.payload||{})};
    return send(baseUrl+'/api/ai/evidence/runtime',token,eventId,body,config);
  }};
}
async function send(url,token,eventId,body,config){const retries=Math.max(0,Number(config.retries??3)),timeoutMs=Math.max(300,Number(config.timeoutMs??3000)),retryStatuses=new Set([408,425,429,500,502,503,504]);let last;
  for(let attempt=0;attempt<=retries;attempt++){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);try{const res=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','x-idempotency-key':eventId},body:JSON.stringify(body),signal:ctrl.signal});const out=await res.json().catch(()=>({}));if(res.ok)return out;if(!retryStatuses.has(res.status)||attempt===retries)throw new Error(out.error||`runtime_evidence_http_${res.status}`);last=new Error(out.error||`runtime_evidence_http_${res.status}`)}catch(e){last=e;if(attempt===retries)throw e}finally{clearTimeout(timer)}await sleep(Math.min(4000,250*(2**attempt))+Math.floor(Math.random()*150))}throw last||new Error('runtime_evidence_failed')}
function sanitize(value,depth=0){if(depth>7)return'[TRUNCATED]';if(value==null||typeof value==='boolean'||typeof value==='number')return value;if(typeof value==='string')return sanitizeText(value).slice(0,12000);if(Array.isArray(value))return value.slice(0,50).map(v=>sanitize(v,depth+1));if(typeof value==='object'){const out={};for(const[k,v]of Object.entries(value)){if(/password|senha|secret|token|authorization|cookie|cpf|cnpj|email|telefone|phone|celular|conta|account|agencia|chave|api[_-]?key|card|cartao/i.test(k)){out[k]='[REDACTED]';continue}out[k]=sanitize(v,depth+1)}return out}return String(value).slice(0,2000)}
function sanitizeText(v){return String(v).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[EMAIL_REDACTED]').replace(/\b(?:\d{3}[.\s-]?){2}\d{3}[-\s]?\d{2}\b/g,'[CPF_REDACTED]').replace(/\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/]?\d{4}[-\s]?\d{2}\b/g,'[CNPJ_REDACTED]').replace(/\b(?:Bearer\s+)?(?:sk|pk|tok|token|secret)[-_][A-Za-z0-9._-]{12,}\b/gi,'[TOKEN_REDACTED]')}
function randomId(){return globalThis.crypto?.randomUUID?.()||`evt-${Date.now()}-${Math.random().toString(36).slice(2)}`}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
