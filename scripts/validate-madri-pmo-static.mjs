import fs from 'node:fs';

const must=(cond,msg)=>{if(!cond){console.error('[FALHA]',msg);process.exit(1)}};
const read=f=>{must(fs.existsSync(f),`Arquivo ausente: ${f}`);return fs.readFileSync(f,'utf8')};
const api=read('src/madri-pmo-api.js');
const pub=read('src/madri-pmo-public-api.js');
const plan=read('public/madri-plano-acao.html');
const report=read('public/madri-status-report.html');
const migration=read('migrations/2026-08-30-madri-pmo-master-plan.sql');
const builder=read('scripts/build-madri-pmo.mjs');
const schema=read('scripts/ensure-madri-pmo-schema.mjs');
const worker=read('public/_worker.js');

// Isolamento deliberado: nenhum conteúdo de projeto alheio nos artefatos MADRI.
for(const [name,text] of Object.entries({api,pub,plan,report,migration,builder,schema})){
  must(!/Dual Clima|dualclima|\bOPR\b|TOTVS|Ciclone/i.test(text),`${name}: dado de outro projeto detectado`);
}

// Plano de Ação: menus e campos obrigatórios.
for(const label of ['Plano Mestre','Customizações / Desenvolvimentos','Responsáveis por Papel','Pendências','Entrada de Demandas','Cadência Completa'])must(plan.includes(label),`Menu ausente: ${label}`);
for(const label of ['Frente','Ação','Responsável','Início','Prazo','Status','Dependência','Impacto','Caminho Crítico','Próximo Passo','Fonte / Evidência'])must(plan.includes(label),`Campo do Plano Mestre ausente: ${label}`);
for(const s of ['Planejado','Em andamento','Atrasado','Concluído'])must(plan.includes(s)&&api.includes(s),`Status obrigatório ausente: ${s}`);
must(plan.includes("onchange=\"setStatus("),'Status não está editável diretamente na linha');
must(api.includes("/status$/")&&api.includes("mpEvent(item,'UPDATE'"),'Mudança de status não registra persistência/histórico');
must(api.includes("'SOFT_DELETE'")&&api.includes("'RESTORE'"),'Lixeira/restauração sem histórico completo');
must(plan.includes('+ Nova demanda / tarefa'),'Botão + Nova demanda / tarefa ausente');
must(api.includes("triage_status")==true&&api.includes("source:'demand'"),'Entrada aprovada não está ligada à criação automática de ação');

// Histórico e versionamento.
for(const op of ['INSERT','UPDATE','SOFT_DELETE','RESTORE'])must(api.includes(`'${op}'`)||migration.includes(`'${op}'`),`Operação histórica ausente: ${op}`);
must(api.includes('version=COALESCE(version,1)+1')&&migration.includes('version INTEGER NOT NULL DEFAULT 1'),'Versionamento ausente');

// Report: exatamente quatro abas e Vision Roadmap.
const tabs=[...report.matchAll(/class="tab(?: on)?"/g)].length;
must(tabs===4,`Status Report deve ter exatamente 4 abas; encontrado ${tabs}`);
for(const label of ['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança'])must(report.includes(label),`Aba ausente: ${label}`);
must(report.includes('Vision Roadmap'),'Vision Roadmap não foi preservado');
must(report.includes('/api/public-madri-pmo-report'),'Report não deriva do endpoint público do Plano Mestre');
must(pub.includes("pmo_scope='MADRI_NUCCI'"),'Endpoint público não está isolado pelo escopo MADRI');
must(!/FCH|horas individuais|OPR_MADRI/i.test(report),'Report cliente expõe informação interna de horas');
must(report.includes('PENDENTE DE VALIDAÇÃO')&&report.includes('A confirmar'),'Tratamento de ausência de evidência não segue o prompt');

// Banco / seed / schema.
const seedActions=(migration.match(/'MADRI-ACT-\d{3}'/g)||[]).length;
must(seedActions>=18,`Seed de ações insuficiente: ${seedActions}`);
for(const t of ['madri_pmo_demands','madri_pmo_roles','madri_pmo_cadence'])must(migration.includes(`CREATE TABLE IF NOT EXISTS ${t}`),`Tabela ausente: ${t}`);
for(const c of ['pmo_scope','front','dependency_text','impact_text','critical_path','next_step','evidence','source_ref','version'])must(schema.includes(c),`Coluna aditiva não protegida: ${c}`);

// Build precisa injetar API pública antes do login e API privada no bloco autenticado.
must(builder.includes('MADRI PMO PUBLIC API')&&builder.includes('MADRI PMO PRIVATE API'),'Build MADRI não injeta os dois endpoints');

// Regressão real encontrada no Stage: 25 colunas de work_items não podem receber 26 valores.
const badArity=/VALUES\(\s*(?:\?\s*,\s*){25}1\s*\)/g;
const goodInsert='VALUES('+Array(24).fill('?').join(',')+',1)';
must(!badArity.test(worker),'Worker final contém INSERT MADRI com 26 valores para 25 colunas');
const normalizedInserts=worker.split(goodInsert).length-1;
must(normalizedInserts>=2,`Worker deve conter os dois INSERTs MADRI normalizados; encontrado ${normalizedInserts}`);
const privateBlocks=(worker.match(/BEGIN MADRI PMO PRIVATE API/g)||[]).length;
const publicBlocks=(worker.match(/BEGIN MADRI PMO PUBLIC API/g)||[]).length;
must(privateBlocks===1,`Worker deve conter exatamente 1 bloco privado MADRI; encontrado ${privateBlocks}`);
must(publicBlocks===1,`Worker deve conter exatamente 1 bloco público MADRI; encontrado ${publicBlocks}`);
must(builder.includes('badArityPattern')&&builder.includes('normalizeInsertArity'),'Build não possui hardening explícito de aridade dos INSERTs MADRI');

console.log(`[OK] MADRI PMO: contrato, isolamento, quatro abas, Vision Roadmap e ${normalizedInserts} INSERTs work_items 25×25 validados.`);
