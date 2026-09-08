import fs from 'node:fs';

const DATA_DIR='data/madri/rfi-requirements';
const MANIFEST=`${DATA_DIR}/manifest.json`;
const SCRIPT='scripts/seed-madri-requirements.mjs';
for(const f of [MANIFEST,SCRIPT]) if(!fs.existsSync(f)) throw new Error(`Arquivo ausente: ${f}`);

const d=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
if(!Array.isArray(d.files)||!d.files.length) throw new Error('Manifesto sem chunks.');
const records=d.files.flatMap(name=>{const f=`${DATA_DIR}/${name}`;if(!fs.existsSync(f))throw new Error(`Chunk ausente: ${f}`);const rows=JSON.parse(fs.readFileSync(f,'utf8'));if(!Array.isArray(rows))throw new Error(`Chunk inválido: ${f}`);return rows;});
if(d?.counts?.rfi_reconstructed!==71) throw new Error('RFI reconstruída deve conter 71 requisitos.');
if(d?.counts?.new_requirements!==15) throw new Error('Novos requisitos devem conter 15 itens.');
if(d?.counts?.total!==86 || records.length!==86) throw new Error('Dataset deve conter 86 requisitos.');
const ids=records.map(x=>x.display_id);
if(new Set(ids).size!==86) throw new Error('display_id duplicado.');
for(const r of records){
  if(!r.display_id||!r.requirement||!r.area||!r.source_document) throw new Error(`Registro incompleto: ${r.display_id||'sem-id'}`);
  if(!['Coberto','Coberto parcialmente','Não localizado','Gap','Novo requisito'].includes(r.coverage_status)) throw new Error(`coverage_status inválido: ${r.display_id}`);
  if(r.classification) throw new Error(`Classificação STD/CFG/DEV/INT não deve ser inferida no seed: ${r.display_id}`);
}
const s=fs.readFileSync(SCRIPT,'utf8');
for(const needle of ["STAGE-only","SEED-MADRI-RFI-STAGE","INSERT OR IGNORE INTO madri_requirements","pmo_scope='MADRI_NUCCI'","IMPORT_BASELINE"]){
  if(!s.includes(needle)) throw new Error(`Contrato ausente no seed: ${needle}`);
}
if(/--env=production|APPLY-MADRI.*PRODUCTION/i.test(s)) throw new Error('Seed não pode oferecer caminho de Produção.');
console.log('OK: seed MADRI RFI × Blueprint validado — 71 + 15 = 86, Stage-only, idempotente e sem classificação inferida.');
