import fs from 'node:fs';

const file='public/_worker.js';
const text=fs.readFileSync(file,'utf8');
const marker="code:'db_unavailable'";
if(text.includes(marker)){
  console.log('OK: guarda de disponibilidade D1 já aplicada.');
  process.exit(0);
}

const handleMarker='async function handleApi(request, env, url) {';
const dbNeedle='  const DB = env.DB;';
const occurrences=text.split(dbNeedle).length-1;
if(!text.includes(handleMarker) || occurrences!==1){
  throw new Error(`Contrato handleApi/DB inesperado (handle=${text.includes(handleMarker)}, ocorrencias_DB=${occurrences}); build interrompido para evitar patch inseguro.`);
}

const replacement=`  const DB = env?.DB;
  if (!DB || typeof DB.prepare !== 'function') {
    return new Response(JSON.stringify({
      error:'Banco temporariamente indisponível',
      code:'db_unavailable',
      retryable:true
    }), {
      status:503,
      headers:{
        'content-type':'application/json',
        'cache-control':'no-store',
        'retry-after':'1'
      }
    });
  }`;

fs.writeFileSync(file,text.replace(dbNeedle,replacement));
console.log('OK: API agora responde 503 retryable quando o binding D1 ainda não propagou, em vez de lançar TypeError/500.');
