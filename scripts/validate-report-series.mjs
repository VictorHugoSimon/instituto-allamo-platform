import fs from 'node:fs';
import zlib from 'node:zlib';
const read=p=>fs.readFileSync(p,'utf8');
const guard=read('src/public-report-context-guard.js');
const client=read('src/client-published-reports.js');
const api=read('src/report-series-api.js');
const publicApi=read('src/public-published-reports-api.js');
const clientGuard=read('src/report-client-api-guard.js');
const ui=read('src/report-series-ui.js');
const viewer=read('src/rich-report-viewer.js');
const masterSource=read('src/status-report-master-source.js');
const schema=read('src/report-schema-bootstrap.js');
const migration=read('migrations/2026-08-21-report-series.sql');
const build=read('scripts/build-work-management.mjs');
const injectMaster=read('scripts/inject-status-report-master-source.mjs');
const pkg=JSON.parse(read('package.json'));
const index=read('public/index.html');
const worker=read('public/_worker.js');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
function gzipBodyOffset(buf){if(buf.length<18||buf[0]!==0x1f||buf[1]!==0x8b||buf[2]!==8)throw new Error('Fonte comprimida não possui header gzip válido.');const flags=buf[3];let p=10;if(flags&4){const n=buf.readUInt16LE(p);p+=2+n}const skipZero=()=>{while(p<buf.length&&buf[p]!==0)p++;p++};if(flags&8)skipZero();if(flags&16)skipZero();if(flags&2)p+=2;return p}
function decodeMaster(buf){try{return zlib.gunzipSync(buf).toString('utf8')}catch(_){const start=gzipBodyOffset(buf),end=buf.length-8;try{return zlib.inflateRawSync(buf.subarray(start,end)).toString('utf8')}catch(e){throw new Error('Fonte comprimida do template mestre corrompida: '+(e.message||e))}}}
const m=masterSource.match(/const GZIP_B64='([^']+)'/);if(!m)throw new Error('Fonte comprimida do template mestre não encontrada.');const masterHtml=decodeMaster(Buffer.from(m[1],'base64'));
new Function(client);new Function(ui);new Function(viewer);new Function(`return async function(){${guard}}`);new Function(`return async function(){${api}}`);new Function(`return async function(){${publicApi}}`);new Function(`return async function(){${clientGuard}}`);
for(const [n,l] of [["data.client=companyName",'identidade pública autoritativa'],["data.tap.cliente=companyName",'TAP público autoritativo'],['context_locked:true','sinal de contexto bloqueado'],['resolved_by:resolvedBy','resolução ID/slug auditável']])must(guard,n,l);
for(const [n,l] of [["if(publicCompany)return",'precedência da URL'],["publicMode:true",'modo público mesmo com sessão local'],['HISTÓRICO DE STATUS REPORTS','histórico por abas'],['data-history-report','aba de ciclo'],['AllamoRichReport.renderInto','template mestre inline']])must(client,n,l);
for(const [n,l] of [['report_series','tabela série'],['report_series_cycles','tabela ciclos'],['report_series_meetings','tabela reuniões']]){must(schema,n,l);must(migration,n,l)}
for(const [n,l] of [['WEEKLY','semanal'],['BIWEEKLY','quinzenal'],['MONTHLY','mensal'],['/snapshot','fechamento de ciclo'],['/context','contexto das reuniões'],['previous_cycle_id','encadeamento'],['previous_report_id','vínculo com Report anterior'],['used_cycle_id','reuniões consumidas']])must(api,n,l);
for(const [n,l] of [['Preparar próximo com IA','jornada IA'],['Fechar ciclo / criar Report','fechamento'],['Adicionar reunião ao próximo Report','entrada de reuniões'],['allamo_series_ai_prefill','prefill da IA'],['AllamoRichReport','abertura rica']])must(ui,n,l);
for(const [n,l] of [['Status Report · Dual Clima · Agosto/2026','título da fonte literal'],['--allamo-charcoal:#302f39','charcoal original'],['--copper:#b88b78','cobre original'],['max-width:1180px','largura original'],['.tabbar','barra de abas original'],['Visão Geral do Projeto','aba original 1'],['Evolução do Escopo','aba original 2'],['Evolução das Horas','aba original 3'],['Próximos Passos','aba original 4'],['const cronoMeses=','meses do cronograma original'],['const crono=[','estrutura do cronograma original'],['id="modulos"','módulos original'],['id="pilares"','pilares original'],['id="milestones"','marcos original'],['id="curvaChart"','Curva S original'],['id="mensalChart"','gráfico mensal original'],['id="riscos"','riscos original'],['id="proximos"','próximos passos original'],['@media(max-width:900px)','responsividade original'],['@media(max-width:560px)','mobile original'],['@media print','impressão original']])must(masterHtml,n,l);
if(masterHtml.includes('data:image/png;base64,'))throw new Error('Template mestre ainda carrega logo base64 duplicada; deve usar asset do Portal.');
for(const [n,l] of [['allamo-status-report-master-v1','id template mestre'],['__allamoStatusReportMasterSource','fonte literal'],["source:'literal-html-drive'",'origem literal'],['frame.srcdoc=src','HTML literal no iframe'],['applyReport(frame.contentDocument,report)','dados do ciclo aplicados na cópia'],['arm-inline','modo inline'],['dataset.reportTemplate','versão do template'],['Visão Geral · Evolução do Escopo · Evolução das Horas · Próximos Passos','subtítulo padrão'],['drawCurve(doc,d)','Curva S dinâmica'],['doc.getElementById(\'riscos\')','riscos dinâmicos'],['doc.getElementById(\'proximos\')','próximos passos dinâmicos']])must(viewer,n,l);
if(/\barrv[-_]/.test(viewer))throw new Error('Viewer genérico antigo arrv voltou ao código.');
for(const [n,l] of [['report_series_cycles x','join histórico público'],['x.cycle_no','ciclo público'],['x.presentation_date','data apresentação pública']])must(publicApi,n,l);
for(const [n,l] of [['report_series_cycles x','join histórico autenticado'],['x.cycle_no','ciclo autenticado'],['x.presentation_date','data apresentação autenticada']])must(clientGuard,n,l);
for(const f of ['src/public-report-context-guard.js','src/public-published-reports-api.js','src/report-client-api-guard.js','src/report-series-api.js','src/report-series-ui.js','src/rich-report-viewer.js','src/client-published-reports.js'])must(build,f,'injeção no build '+f);
must(injectMaster,'src/status-report-master-source.js','injeção da fonte literal');must(injectMaster,'inflateRawSync','recuperação de checksum gzip legado no build');must(injectMaster,'gzipSync','recomposição de gzip válido no artefato');must(String(pkg.scripts['build:work']||''),'inject-status-report-master-source.mjs','fonte literal no pipeline');
for(const marker of ['BEGIN ALLAMO PUBLIC REPORT CONTEXT GUARD','BEGIN ALLAMO REPORT SERIES'])must(worker,marker,'worker final '+marker);for(const marker of ['__allamoReportSeriesLoaded','AllamoRichReport','publicCompany)return'])must(index,marker,'index final '+marker);
if(/\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|\bTRUNCATE\b/i.test(migration))throw new Error('Migration recorrente contém SQL destrutivo.');
console.log('OK: HTML literal mestre recuperável/reparado, cronograma original, quatro abas, histórico por ciclos, segregação pública e snapshots encadeados validados.');
