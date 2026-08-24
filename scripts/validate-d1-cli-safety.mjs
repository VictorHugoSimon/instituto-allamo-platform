import fs from 'node:fs';

const repair=fs.readFileSync('scripts/repair-core-tenants.mjs','utf8');
if(!repair.includes("!name.startsWith('d1_')&&!name.startsWith('_cf_')")){
  throw new Error('Reparo de tenants ainda pode varrer tabelas internas d1_* / _cf_* e gerar SQLITE_AUTH 7500.');
}
if(!repair.includes("SELECT name FROM sqlite_master WHERE type='table'")){
  throw new Error('Contrato de descoberta de tabelas do reparo mudou sem atualização do gate.');
}
console.log('OK: reparo de tenants limita a varredura às tabelas da aplicação e ignora namespaces internos do D1.');
