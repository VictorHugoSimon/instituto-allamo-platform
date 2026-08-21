import fs from 'node:fs';
const worker='public/_worker.js';
let w=fs.readFileSync(worker,'utf8');
w=w.replace(/const STAGE_BUILD = '[^']+';/,"const STAGE_BUILD = 'awm-stage-20260821-1015';");
if(!w.includes("STAGE_BUILD = 'awm-stage-20260821-1015'")) throw new Error('Não foi possível carimbar a release.');
fs.writeFileSync(worker,w);
console.log('OK: release awm-stage-20260821-1015 carimbada.');
