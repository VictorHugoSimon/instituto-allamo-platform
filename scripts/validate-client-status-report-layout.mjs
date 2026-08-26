import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>fs.readFileSync(p,'utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
for(const f of ['src/client-status-report-layout.js','src/client-status-report-bridge.js']){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`JavaScript inválido em ${f}: ${r.stderr||r.stdout}`);
}
const layout=read('src/client-status-report-layout.js');
const bridge=read('src/client-status-report-bridge.js');
const build=read('scripts/build-work-management.mjs');
must(layout,'AllamoClientStatusReport','renderer público registrado');
must(layout,'Roadmap Executivo · Onde estamos','roadmap executivo do modelo oficial');
must(layout,'Painel de Situação','painel de situação do modelo oficial');
must(layout,'Indicadores-Chave','KPIs do modelo oficial');
must(layout,'Evolução do Escopo · Visão consolidada','evolução de escopo do modelo oficial');
must(layout,'Riscos do Projeto','riscos do modelo oficial');
must(layout,'Próximos Passos','próximos passos do modelo oficial');
must(layout,'Base do Projeto · Indicadores Contratuais','base do projeto do modelo oficial');
must(layout,'Instituto Államo','identidade institucional');
must(bridge,"#allamo-public-client-portal",'escopo restrito ao portal público');
must(bridge,'return client.renderInto(container,report)','portal público usa renderer oficial');
must(bridge,'return original(container,report)','viewer administrativo preservado');
must(build,"src/client-status-report-layout.js",'layout entra no build');
must(build,"src/client-status-report-bridge.js",'bridge entra no build');
if(build.indexOf('${clientStatusReportLayout}')>build.indexOf('${clientStatusReportBridge}'))throw new Error('Bridge está sendo injetado antes do renderer.');
console.log('OK: Status Report do cliente usa o layout oficial, histórico preserva troca de versão e viewer administrativo permanece isolado.');
