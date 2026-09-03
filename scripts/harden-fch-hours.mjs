import fs from 'node:fs';

const worker='public/_worker.js';
const index='public/index.html';
const ingest=fs.readFileSync('src/fch-hours-ingest-api.js','utf8');
const api=fs.readFileSync('src/fch-hours-api.js','utf8');
const ui=fs.readFileSync('src/fch-hours-ui.js','utf8');

function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  if(text.includes(start)){
    const a=text.indexOf(start),b=text.indexOf(end,a);
    if(b<0)throw new Error('Marcador final ausente: '+end);
    return text.slice(0,a)+block+text.slice(b+end.length);
  }
  if(!text.includes(needle))throw new Error('Ponto de injeção não encontrado: '+needle);
  return text.replace(needle,block+'\n'+needle);
}

let w=fs.readFileSync(worker,'utf8');
// Ingestão técnica fica antes do login, mas exige token próprio HOURS_INGEST_TOKEN.
w=sync(
  w,
  '    // BEGIN ALLAMO FCH HOURS INGEST',
  '    // END ALLAMO FCH HOURS INGEST',
  ingest,
  '    // REPORT PÚBLICO (sem login) — link aberto do cliente',
  '    '
);
// Consultas e Curva S ficam depois da autenticação do usuário.
w=sync(
  w,
  '    // BEGIN ALLAMO FCH HOURS API',
  '    // END ALLAMO FCH HOURS API',
  api,
  '    // EMPRESAS: criar (rota dedicada)',
  '    '
);

// O hardening FCH legado já atualiza Status Report, report público e Curva S.
// Trocamos apenas a origem de OPR/MADRI: primeiro fch_entries (Drive read-only),
// com fallback para horas_import/CSV para os demais clientes.
const fnStart='async function importedHourRowsForCompany_(env, companyId, companyName){';
const fnNext='\n\nasync function enrichReportWithImportedHours';
if(w.includes(fnStart)){
  const a=w.indexOf(fnStart),b=w.indexOf(fnNext,a);
  if(b<0)throw new Error('Fim de importedHourRowsForCompany_ não encontrado.');
  const replacement=`async function importedHourRowsForCompany_(env, companyId, companyName){
  const context=norm(companyId)+' '+norm(companyName);
  let target='';
  if(context.includes('madri')||context.includes('madrid')) target='MADRI';
  else if(context.includes('opr')) target='OPR';
  if(target){
    try{
      const direct=(await env.DB.prepare("SELECT substr(activity_date,1,7) AS mes,SUM(hours) AS horas FROM fch_entries WHERE target_project=? GROUP BY substr(activity_date,1,7) ORDER BY mes").bind(target).all()).results||[];
      if(direct.length) return direct;
    }catch(e){ /* tabela ainda não sincronizada: usa fallback legado */ }
  }
  const keys=[norm(companyId),norm(companyName)].filter(Boolean);
  const uniq=[...new Set(keys)];
  if(!uniq.length) return [];
  const ph=uniq.map(()=>'?').join(',');
  const sql='SELECT mes, SUM(horas) AS horas FROM horas_import WHERE company_key IN ('+ph+') GROUP BY mes ORDER BY mes';
  try{ return (await env.DB.prepare(sql).bind(...uniq).all()).results||[]; }catch(e){ return []; }
}`;
  w=w.slice(0,a)+replacement+w.slice(b);
}

fs.writeFileSync(worker,w);

let h=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO FCH HOURS UI -->',end='<!-- END ALLAMO FCH HOURS UI -->';
const block=start+'\n<script data-allamo-fch-hours="1">\n'+ui+'\n</script>\n'+end;
if(h.includes(start)){
  const a=h.indexOf(start),b=h.indexOf(end,a);if(b<0)throw new Error('Marcador final da UI FCH ausente.');
  h=h.slice(0,a)+block+h.slice(b+end.length);
}else{
  const body=h.toLowerCase().lastIndexOf('</body>');if(body<0)throw new Error('Fechamento </body> não encontrado.');
  h=h.slice(0,body)+block+'\n'+h.slice(body);
}
fs.writeFileSync(index,h);

const combined=fs.readFileSync(worker,'utf8')+'\n'+fs.readFileSync(index,'utf8');
for(const marker of ['fch-hours-ingest','fch-hours-status','fch-curve','allamo-fch-curve-card','OPR_Madri','FROM fch_entries WHERE target_project=?']){
  if(!combined.includes(marker))throw new Error('Integração FCH incompleta: '+marker);
}
console.log('OK: FCH Drive read-only priorizado em OPR/MADRI, com ingestão segura, report e Curva S automática.');

// O Sales Intelligence usa o mesmo artefato canônico do portal e permanece
// idempotente. O encadeamento aqui evita criar uma segunda pipeline de build.
await import('./harden-commercial-sales-intelligence.mjs');
