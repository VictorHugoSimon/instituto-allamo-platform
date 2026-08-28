import fs from 'node:fs';

const src=fs.readFileSync('src/post-unpack-watchdog.js','utf8');
const build=fs.readFileSync('scripts/build-work-management.mjs','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(src,"document.addEventListener('click'",'Clique delegado no document');
must(src,"closest('[data-allamo-reports-menu]')",'Detecção do menu Reports pós-unpack');
must(src,'window.AllamoOpenReports=openReports','Ponte global segura de abertura');
must(src,'window.AllamoReports&&window.AllamoReports.open','Abertura da Central oficial de Reports');
must(src,'for(let i=0;i<40;i++)','Retry quando o runtime ainda está inicializando');
must(src,"document.getElementById('arm')",'Fallback para Central já montada');
must(src,'Reports ainda não carregou. Atualize a página.','Falha nunca fica silenciosa');
must(src,"setAttribute('role','button')",'Menu acessível como botão');
must(src,"setAttribute('tabindex','0')",'Menu acessível por teclado');
must(src,"document.addEventListener('keydown'",'Abertura por Enter/Espaço');
must(build,"const watchdog=fs.readFileSync('src/post-unpack-watchdog.js','utf8')",'Watchdog entra no build final');
must(build,'${watchdog}','Watchdog é injetado no artefato');

console.log('OK: menu Reports possui clique delegado pós-unpack, retry, fallback visível e suporte a teclado.');
