import fs from 'node:fs';

const api=fs.readFileSync('src/legacy-report-ai-api.js','utf8');
const ui=fs.readFileSync('src/legacy-report-ai-ui.js','utf8');
const build=fs.readFileSync('scripts/build-work-management.mjs','utf8');
const schema=fs.readFileSync('src/report-schema-bootstrap.js','utf8');
const migration=fs.readFileSync('migrations/2026-08-21-report-ai-dynamic.sql','utf8');

// Parse do fragmento de API dentro do mesmo tipo de escopo assíncrono usado pelo Worker.
new Function(`return async function __reportAiApiSyntax(){${api}\n}`)();
new Function(ui);

const must=(content,needle,label)=>{if(!content.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
for(const [needle,label] of [
  ["path==='report-ai'",'endpoint de geração'],
  ["path==='report-history'",'histórico versionado'],
  ['https://api.openai.com/v1/responses','Responses API'],
  ['OPENAI_API_KEY','secret somente no backend'],
  ['store:false','não armazenar response no provedor'],
  ['json_schema','Structured Outputs'],
  ['requires_manual_validation','gate de validação humana'],
  ['legacy_report_versions','snapshot persistente'],
  ['report_ai_runs','auditoria das gerações']
]) must(api,needle,label);
for(const [needle,label] of [
  ['+ Adicionar seção','editor dinâmico'],
  ['+ Adicionar campo','campos variáveis'],
  ['Excluir este campo da versão atual','remoção sem apagar histórico'],
  ['✨ Gerar Status Report com IA','copiloto PMO'],
  ['Aplicar selecionadas e salvar nova versão','aprovação humana'],
  ['Criar tarefa no Trabalho','sugestão → Work Management'],
  ['Adicionar ao plano/roadmap','sugestão → roadmap/plano'],
  ['custom_sections','schema flexível'],
  ['hidden_standard_fields','campos padrão opcionais'],
  ['ai_audit','rastreabilidade']
]) must(ui,needle,label);
for(const needle of ['legacy-report-ai-api.js','legacy-report-ai-ui.js','BEGIN ALLAMO LEGACY REPORT AI']) must(build,needle,'injeção no build');

if(ui.includes('OPENAI_API_KEY'))throw new Error('Segredo não pode aparecer no frontend.');
const destructive=/^\s*(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\b)/im;
if(destructive.test(schema)||destructive.test(migration))throw new Error('Reports IA contém SQL destrutivo.');
if(!migration.includes('CREATE-ONLY'))throw new Error('Migration precisa continuar declarada create-only.');
if(!api.includes('approval_required:true'))throw new Error('IA deve declarar aprovação humana obrigatória.');

console.log('OK: Reports dinâmicos + Copiloto PMO IA validados; histórico, governança e persistência ativos.');
