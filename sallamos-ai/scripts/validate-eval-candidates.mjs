#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const path=process.argv[2]||'eval-data/candidates.jsonl';
const rows=(await readFile(path,'utf8')).split('\n').map(x=>x.trim()).filter(Boolean).map((line,i)=>{try{return JSON.parse(line)}catch{throw new Error(`CANDIDATE_GATE: JSON inválido linha ${i+1}`)}});
const errors=[]; const ids=new Set(); const modules=new Set();
if(rows.length<20)errors.push(`mínimo 20 cenários candidatos; atual=${rows.length}`);
for(const [i,r] of rows.entries()){
  const p=i+1;
  if(!r.id||ids.has(r.id))errors.push(`linha ${p}: id ausente/duplicado`); else ids.add(r.id);
  if(r.dataset_type!=='candidate-derived')errors.push(`linha ${p}/${r.id}: dataset_type deve ser candidate-derived`);
  if(r.approved!==false)errors.push(`linha ${p}/${r.id}: candidato deve permanecer approved=false`);
  if(!r.module)errors.push(`linha ${p}/${r.id}: module obrigatório`); else modules.add(r.module);
  if(!r.question||String(r.question).trim().length<8)errors.push(`linha ${p}/${r.id}: question inválida`);
  if(!r.evidence_ref||!r.source_alias)errors.push(`linha ${p}/${r.id}: evidence_ref/source_alias obrigatórios`);
  if(r.golden_answer||r.expected_source||r.expect_decision)errors.push(`linha ${p}/${r.id}: candidato não pode antecipar golden/expected_source/expect_decision antes da homologação`);
  if(hasPII(JSON.stringify(r)))errors.push(`linha ${p}/${r.id}: possível PII detectada`);
}
if(modules.size<3)errors.push(`mínimo 3 módulos; atual=${modules.size}`);
if(errors.length){console.error('CANDIDATE EVAL BACKLOG INVÁLIDO');errors.slice(0,100).forEach(x=>console.error('- '+x));process.exit(1)}
console.log(JSON.stringify({candidateGate:'valid',cases:rows.length,modules:modules.size,approved:0},null,2));
function hasPII(v){return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(v)||/\b(?:\d{3}[.\s-]?){2}\d{3}[-\s]?\d{2}\b/.test(v)||/\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/]?\d{4}[-\s]?\d{2}\b/.test(v)}
