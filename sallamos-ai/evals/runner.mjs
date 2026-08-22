#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,arr)=>i%2?a:[...a,[v.replace(/^--/,''),arr[i+1]]],[]));
const base=args.base??'http://127.0.0.1:8787';
const dataset=(await readFile(args.dataset??'eval-data/dataset.jsonl','utf8')).split('\n').filter(Boolean).map(l=>JSON.parse(l));
const results=[];
for(const c of dataset){
  const started=Date.now();
  const res=await fetch(base+'/api/ai/support/query',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+(args.token??'')},body:JSON.stringify({message:c.question})});
  const out=await res.json();
  const decision=out.status==='answered'?'answer':out.status==='needs_clarification'?'clarify':'escalate';
  const sourceIds=(out.sources??[]).map(s=>typeof s==='string'?s:s.type+':'+s.id);
  results.push({id:c.id,decisionOk:decision===c.expect_decision,retrievalOk:!c.expected_source||sourceIds.some(s=>s.includes(c.expected_source)),grounded:decision!=='answer'||sourceIds.length>0,latency:Date.now()-started,confidence:out.confidence??null});
}
const rate=k=>results.filter(r=>r[k]).length/results.length;
const sorted=results.map(r=>r.latency).sort((a,b)=>a-b); const p95=sorted[Math.max(0,Math.floor(sorted.length*.95)-1)]??sorted.at(-1);
const escalation=results.filter((r,i)=>dataset[i].expect_decision==='escalate');
console.table({casos:results.length,decisao_correta:rate('decisionOk').toFixed(2),retrieval_hit_rate:rate('retrievalOk').toFixed(2),groundedness:rate('grounded').toFixed(2),escalonamento_correto:(escalation.filter(r=>r.decisionOk).length/(escalation.length||1)).toFixed(2),latencia_p95_ms:p95});
const GATE=Number(args.gate??0.8); if(rate('decisionOk')<GATE){console.error('regressão: decisão correta abaixo de '+GATE);process.exit(1);}
