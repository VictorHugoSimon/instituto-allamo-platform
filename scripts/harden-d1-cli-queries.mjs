import fs from 'node:fs';

const file='scripts/repair-core-tenants.mjs';
let text=fs.readFileSync(file,'utf8');
const safeMarker="!name.startsWith('d1_')&&!name.startsWith('_cf_')";
if(text.includes(safeMarker)){
  console.log('OK: reparo de tenants já ignora tabelas internas do D1.');
  process.exit(0);
}

const needle="const tables=query(config,\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;\").map(r=>String(r.name||'')).filter(Boolean);";
const replacement="const tables=query(config,\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;\").map(r=>String(r.name||'')).filter(Boolean).filter(name=>!name.startsWith('d1_')&&!name.startsWith('_cf_'));";

if(!text.includes(needle)){
  throw new Error('Consulta de tabelas do reparo mudou; não é seguro aplicar o filtro automaticamente.');
}
text=text.replace(needle,replacement);
fs.writeFileSync(file,text);
console.log('OK: tabelas internas d1_* e _cf_* foram excluídas da varredura de company_id; evita SQLITE_AUTH 7500 espúrio.');
