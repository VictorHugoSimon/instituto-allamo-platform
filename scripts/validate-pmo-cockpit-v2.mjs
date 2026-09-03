import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');

function must(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`PMO Cockpit v2: ausente ${label}: ${needle}`);
}

// Contratos já existentes que o Cockpit 2.0 deve preservar e reutilizar.
must(worker, "path === 'dash-curve'", 'endpoint Curva S consolidada');
must(index, 'Visão Executiva', 'Visão Executiva do PMO');
must(index, 'Riscos', 'bloco de riscos');
must(index, 'Curva S', 'Curva S');

// Regras de segurança do pacote.
const forbidden = [
  'service-hub/',
  'sallamos-ai/',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
];
for (const token of forbidden) {
  if (process.env.PMO_CHANGED_FILES?.split(',').some((f) => f.startsWith(token))) {
    throw new Error(`PMO Cockpit v2: alteração fora do escopo: ${token}`);
  }
}

console.log('PMO Cockpit v2: contrato-base validado.');
