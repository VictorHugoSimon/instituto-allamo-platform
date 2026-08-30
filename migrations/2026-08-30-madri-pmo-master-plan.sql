PRAGMA foreign_keys = ON;

-- MADRI PMO usa work_items como fonte única do Plano Mestre.
-- As colunas adicionais são aplicadas pelo ensure-additive-schema antes desta migration.

CREATE TABLE IF NOT EXISTS madri_pmo_demands (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  entry_date TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  demand TEXT NOT NULL,
  front TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  due_date TEXT,
  triage_status TEXT NOT NULL DEFAULT 'Capturada',
  action_id TEXT,
  evidence TEXT NOT NULL DEFAULT '',
  observation TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY(action_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS madri_pmo_roles (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  front TEXT NOT NULL,
  role_type TEXT NOT NULL,
  person_name TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  evidence TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'A confirmar',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS madri_pmo_cadence (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  period TEXT NOT NULL,
  agenda TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'A confirmar',
  result_next_step TEXT NOT NULL DEFAULT '',
  action_id TEXT,
  source_ref TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY(action_id) REFERENCES work_items(id)
);

CREATE INDEX IF NOT EXISTS idx_madri_demands_active ON madri_pmo_demands(company_id, archived_at, entry_date);
CREATE INDEX IF NOT EXISTS idx_madri_roles_active ON madri_pmo_roles(company_id, archived_at, front);
CREATE INDEX IF NOT EXISTS idx_madri_cadence_active ON madri_pmo_cadence(company_id, archived_at, period);

-- Fonte central: Plano Mestre. IDs são estáveis para preservar histórico e evitar duplicação.
INSERT OR IGNORE INTO work_items(
  id,company_id,project_id,project,item_type,title,description,status,priority,owner,
  start_date,due_date,rank,labels,created_by,updated_by,
  pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version
)
SELECT
  'MADRI-ACT-001',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Consolidar o Business Blueprint com os levantamentos de 24–28/08',
  'Incorporar AS IS, TO BE, decisões, divergências e pendências das frentes Comercial, Emissão, Operação, Faturamento, Financeiro e GED.',
  'Em andamento','Crítica','Fabiano Vanucci','2026-08-24',NULL,1,'["MADRI_PMO","BLUEPRINT"]','PMO','PMO',
  'MADRI_NUCCI','Blueprint / Processos','Fechamento das entrevistas e validação pelos donos de processo','Evita parametrização ou desenvolvimento sobre processo incompleto.',1,
  'Publicar versão consolidada para validação dos participantes.','BBP v1.0 ainda contém lacunas de AS IS e as reuniões posteriores ampliaram o escopo levantado.','BBP v1.0 24/08/2026 + reuniões 24–28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id AND (lower(name) LIKE '%nucci%' OR lower(name) LIKE '%madrid%' OR lower(name) LIKE '%madri%') ORDER BY id LIMIT 1)
WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name)='madrid' OR lower(c.name)='madri') LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-002',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Classificar gaps em STD / CFG / DEV / INT','Classificar cada diferença entre AS IS e TO BE, sem inventar MIT ou código oficial.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-25',NULL,2,'["MADRI_PMO","GAPS"]','PMO','PMO','MADRI_NUCCI','Escopo / Gaps','MADRI-ACT-001','Define esforço, responsabilidade, aprovação e impacto contratual.',1,'Vincular responsável, critério de aceite e evidência a cada gap.','A classificação foi solicitada no ciclo de entrevistas, mas ainda não há matriz final comprovada.','Reuniões 25–28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id AND (lower(name) LIKE '%nucci%' OR lower(name) LIKE '%madrid%' OR lower(name) LIKE '%madri%') ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-003',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Formalizar regra fiscal CT-e × minuta × NFS-e','Validar natureza municipal/intermunicipal, documento fiscal correto, cancelamento, substituição e complemento.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-25',NULL,3,'["MADRI_PMO","FISCAL"]','PMO','PMO','MADRI_NUCCI','Emissão / Fiscal','Validação Fiscal/Contábil MADRI','Reduz risco fiscal e evita reproduzir prática atual sem validação.',1,'Obter decisão formal Fiscal/Contábil e traduzir em regra de sistema.','A reunião de Emissão questionou o uso atual de minuta em cenários não municipais.','Reunião Emissão 25–26/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-004',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Revisar DDR, averbação, apólices e integração de risco','Validar cobertura, DDR, averbação, corretor/seguradora, Rodobens e regras de bloqueio.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-25',NULL,4,'["MADRI_PMO","SEGURO","RISCO"]','PMO','PMO','MADRI_NUCCI','Seguro / Risco','Apólices, DDR, credenciais e retorno da gerenciadora','Pode reduzir custo duplicado e impedir viagem sem liberação adequada.',1,'Receber documentos/apólices, validar DDR e desenhar bloqueio/integração.','SM é feita na Rodobens e não foi evidenciado bloqueio equivalente no Scorpions; DDR/apólices precisam de revisão.','Reuniões Emissão e Roteirização 25–27/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-005',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Automatizar encerramento de Manifesto/MDF-e e SM','Transformar saída, chegada e encerramento em eventos sistêmicos e reduzir dependência de WhatsApp/ação manual.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-27',NULL,5,'["MADRI_PMO","MANIFESTO","SM"]','PMO','PMO','MADRI_NUCCI','Transferência / Manifesto','Integração Nucci + Rodobens + regras SEFAZ por UF','Reduz retrabalho, manifesto aberto e risco de multa.',1,'Definir evento de chegada, owner de exceção e integração de encerramento.','Bases informaram encerramento manual de Manifesto/MDF-e; SM e Manifesto não encerram juntos.','Reunião Roteirização/Entrega 27/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-006',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Padronizar rota MADRI, etiquetagem, checkout e POD','Adotar a rota MADRI como referência operacional, vincular volume↔NF e digitalizar evidência de entrega.','Em andamento','Alta','Nilton Barreto','2026-08-27',NULL,6,'["MADRI_PMO","ROTA","POD"]','PMO','PMO','MADRI_NUCCI','Roteirização / Entrega','Cadastro de rotas, MobiTruck/Comprovei e regras por base','Aumenta rastreabilidade, qualidade da triagem e confiabilidade da baixa.',1,'Fechar procedimento único e exceções por base/cliente.','Foram mostradas divergências de rota/etiqueta e controles de POD em Scorpions, Comprovei, canhoto, Excel e WhatsApp.','Reunião Roteirização/Entrega 27/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-007',c.id,p.id,'Implantação NUCCI ERP','CUSTOMIZACAO','Automatizar Panfarma: importação, volumetria, diária e frete extra','Consolidar XML/arquivo, capacidade, rateio, dedicados, transbordo, guia e conciliação com faturamento.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-25',NULL,7,'["MADRI_PMO","CUSTOMIZACAO","PANFARMA"]','PMO','PMO','MADRI_NUCCI','Panfarma','Contrato/TCO, layouts, regras por estado e aceite do cliente','Reduz trabalho manual e protege receita de diária/excedentes.',1,'Validar contrato/layouts e desdobrar requisito técnico sem inventar código MIT.','Panfarma opera com arquivos/planilhas/guias; Maranhão informou 2.250 volumes/dia e R$ 5,36 por excedente como dado operacional a validar contratualmente.','Reuniões 25, 27 e 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-008',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Mapear e priorizar integrações por cliente','Consolidar DHL/WB, Panfarma, JadLog, Santa Cruz, FF/Semed/União Química, EDI, CIOT, Rodobens, SEFAZ, Comprovei e MobiTruck.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-26',NULL,8,'["MADRI_PMO","INTEGRACOES"]','PMO','PMO','MADRI_NUCCI','Integrações','Layouts, credenciais, contato técnico e regra de negócio por interface','Sem matriz consolidada não há plano seguro de desenvolvimento/homologação.',1,'Criar matriz interface→layout→responsável→ambiente→teste→aceite.','Integrações foram levantadas em múltiplas reuniões e ainda dependem de layouts/owners.','Reuniões 25–28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-009',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Parametrizar faturamento por cliente e operação','Registrar periodicidade, autorização, comprovante, guia, documento fiscal, descontos e exceções por cliente.','Em andamento','Crítica','Julli Serrão','2026-08-28',NULL,9,'["MADRI_PMO","FATURAMENTO"]','PMO','PMO','MADRI_NUCCI','Faturamento','Regras e arquivos de JadLog, DHL, Panfarma, Santa Cruz e demais clientes','Centraliza conhecimento tácito e reduz faturamento tardio/incorreto.',1,'Criar tabela de regras por cliente e validar com Faturamento.','Reunião de Faturamento mostrou processos distintos de autorização, relatórios, guias e comprovantes.','Reunião Faturamento/Financeiro 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-010',c.id,p.id,'Implantação NUCCI ERP','CUSTOMIZACAO','Criar reconciliação operação × autorização × fatura × pagamento','Comparar itens enviados, autorizados, retirados, faturados, pagos, descontados e pendentes.','Em andamento','Crítica','Julli Serrão','2026-08-28',NULL,10,'["MADRI_PMO","CUSTOMIZACAO","CONCILIACAO"]','PMO','PMO','MADRI_NUCCI','Faturamento / Financeiro','Integrações/arquivos de clientes e regras de baixa','Reduz receita perdida, divergências não rastreadas e planilhas paralelas.',1,'Definir fonte por cliente e fila de divergências com evidência.','Foi proposto importar retorno do cliente e destacar diferenças/CT-es não pagos.','Reunião Faturamento/Financeiro 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-011',c.id,p.id,'Implantação NUCCI ERP','CUSTOMIZACAO','Desenhar automação segura de GNRE e pagamentos','Integrar geração da guia, código/PDF, pagamento, autorização, comprovante e baixa financeira.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-28',NULL,11,'["MADRI_PMO","CUSTOMIZACAO","GNRE"]','PMO','PMO','MADRI_NUCCI','Financeiro','APIs bancárias, retorno por UF, limites e segregação de funções','Reduz operação noturna/madrugada sem eliminar controles de segurança.',1,'Validar bancos, APIs, limites, aprovação e contingência.','GNRE é paga manualmente inclusive fora do horário; integração API foi discutida como oportunidade.','Reunião Faturamento/Financeiro 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-012',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Criar matriz de segurança, perfis e acessos','Definir RBAC, administrador, segregação de funções, offboarding e trilha de auditoria.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-28',NULL,12,'["MADRI_PMO","SEGURANCA"]','PMO','PMO','MADRI_NUCCI','Segurança / Acessos','Funções, política interna e aprovadores','Evita privilégio excessivo e acesso indevido a dados/processos.',1,'Levantar perfis por função e obter aprovação da matriz.','A reunião destacou concessão indevida de administrador e risco de acesso de ex-funcionário.','Reunião Faturamento/Financeiro 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-013',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Estruturar GED com validade, versão, owner e vínculo à entidade','Inventariar documentos e associar a base, veículo, contrato, financeiro ou processo operacional.','Em andamento','Alta','Deborah Mendes','2026-08-28',NULL,13,'["MADRI_PMO","GED"]','PMO','PMO','MADRI_NUCCI','GED / Qualidade','Inventário documental e política de acesso','Substitui e-mail, agenda física e Excel como controles principais.',1,'Enviar/inventariar documentos e definir alertas/bloqueios por criticidade.','Débora informou ausência de sistema central e listou documentos regulatórios e controles atuais.','Reunião GED/Maranhão 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-014',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Formalizar compliance térmico para transporte de medicamentos','Mapear qualificação térmica de rotas/salas, dataloggers, caixas térmicas, troca de gelo e monitoramento de veículos.','Em andamento','Crítica','Deborah Mendes','2026-08-28',NULL,14,'["MADRI_PMO","QUALIDADE","TERMICO"]','PMO','PMO','MADRI_NUCCI','Qualidade / Compliance','Requisitos regulatórios, ativos e evidências por rota/produto','Reduz risco sanitário e documental em operação farmacêutica.',1,'Inventariar certificações e definir controles/alertas no GED e frota.','Foram citados dataloggers, qualificação térmica e ausência de monitoramento suficiente em veículos.','Reunião GED/Maranhão 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-015',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Revisar emissão Panfarma Maranhão e processo de devoluções','Formalizar documento fiscal em entrega/devolução total/parcial e eliminar lacunas de emissão causadas por volume/manualidade.','Em andamento','Crítica','PENDENTE DE VALIDAÇÃO','2026-08-28',NULL,15,'["MADRI_PMO","PANFARMA","DEVOLUCAO"]','PMO','PMO','MADRI_NUCCI','Emissão / Maranhão','Validação Fiscal/Contábil e processo Panfarma','Reduz exposição fiscal e sinistro sem documento adequado.',1,'Mapear cenários e obter validação fiscal antes da configuração.','Foi informado que nem toda nota Panfarma no Maranhão recebe CT-e e que devoluções seguem fluxos distintos.','Reunião GED/Maranhão 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-016',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Definir plano de dados, cadastros e migração','Consolidar templates, volumes, responsáveis e saneamento de clientes, veículos, rotas, tabelas e demais mestres.','Planejado','Crítica','PENDENTE DE VALIDAÇÃO',NULL,NULL,16,'["MADRI_PMO","DADOS"]','PMO','PMO','MADRI_NUCCI','Dados / Cadastros','Blueprint e gaps aprovados','Pré-requisito para configuração, integração e testes.',1,'Definir objetos, templates, responsáveis e datas.','BBP atribui à MADRI o fornecimento/auditoria dos dados, mas o plano detalhado ainda não está comprovado.','BBP v1.0 24/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-017',c.id,p.id,'Implantação NUCCI ERP','AÇÃO','Criar plano SIT / UAT / E2E e critérios de aceite','Definir cenários, responsáveis, evidências, massa, ambientes, defeitos e aceite por processo.','Planejado','Crítica','PENDENTE DE VALIDAÇÃO',NULL,NULL,17,'["MADRI_PMO","TESTES"]','PMO','PMO','MADRI_NUCCI','Testes / Homologação','Configuração, dados e integrações disponíveis','Pré-requisito para decisão Go/No-Go.',1,'Construir matriz de testes quando escopo técnico for aprovado.','BBP atribui à MADRI execução/documentação da homologação e à Nucci suporte à implantação.','BBP v1.0 24/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

INSERT OR IGNORE INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version)
SELECT 'MADRI-ACT-018',c.id,p.id,'Implantação NUCCI ERP','MARCO','Definir baseline de cronograma e Go-live','Criar cronograma formal com dependências, marcos, critérios Go/No-Go e data de produção somente após escopo validado.','Planejado','Crítica','PENDENTE DE VALIDAÇÃO',NULL,NULL,18,'["MADRI_PMO","CRONOGRAMA"]','PMO','PMO','MADRI_NUCCI','Governança / Cronograma','Blueprint, gaps, capacidade, dados e testes','Sem baseline não é possível afirmar percentual de avanço, atraso ou Go-live.',1,'Construir e aprovar baseline após fechamento do escopo.','Não há data formal de Go-live comprovada no BBP v1.0 ou nas evidências consolidadas.','BBP v1.0 + Status Report 28/08/2026',1
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

-- Cadência comprovada. SAC permanece A confirmar porque não há evidência suficiente de realização.
INSERT OR IGNORE INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref)
SELECT 'MADRI-CAD-001',c.id,p.id,'24/08/2026 · 14h–17h','Blueprint Comercial','Clientes, tabelas de frete, métodos comerciais e processos relacionados.','Nilton Barreto; Fabiano Vanucci; Thiago Bruno; Victor Simon; Gabriel Pedroso; demais convidados','Realizada','Detalhar pendências comerciais e fechar COM01–COM06.','MADRI-ACT-001','Agenda e registros do projeto 24/08/2026'
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref)
SELECT 'MADRI-CAD-002',c.id,p.id,'25–26/08/2026','Blueprint Emissão','Mapear e fechar o processo real de emissão.','Kartiney Ferreira; Fabiano Vanucci; Thiago Bruno; Victor Simon; Nilton Barreto e participantes','Realizada','Incorporar regras fiscais, integrações, seguro/risco e gaps ao Blueprint.','MADRI-ACT-001','Transcrições de Emissão 25–26/08/2026'
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref)
SELECT 'MADRI-CAD-003',c.id,p.id,'27/08/2026 · manhã + tarde','Roteirizador × Comprovante de Entrega','Roteirização, transferência, baixa, prova de entrega e particularidades das bases.','Nilton Barreto; gestores das bases; Fabiano Vanucci; Thiago Bruno; Victor Simon; demais participantes','Realizada','Padronizar rota, POD, parceiros, Manifesto/SM e integrações.','MADRI-ACT-006','Transcrições de 27/08/2026'
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref)
SELECT 'MADRI-CAD-004',c.id,p.id,'28/08/2026 · manhã','Faturamento / Financeiro','Fechar faturamento vinculado à emissão e processos financeiros relacionados.','Julli Serrão; equipe Financeiro; Fabiano Vanucci; Thiago Bruno; Victor Simon; demais participantes','Realizada','Parametrizar regras por cliente, conciliação e automações financeiras.','MADRI-ACT-009','Transcrição Faturamento/Financeiro 28/08/2026'
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref)
SELECT 'MADRI-CAD-005',c.id,p.id,'28/08/2026 · 14h–15h','SAC','Alinhar procedimentos de SAC.','PENDENTE DE VALIDAÇÃO','A confirmar','Sem evidência suficiente de realização nos materiais consolidados.','MADRI-ACT-001','Agenda prevista 28/08/2026; realização sem evidência suficiente'
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref)
SELECT 'MADRI-CAD-006',c.id,p.id,'28/08/2026 · tarde','GED + Operação Maranhão','Mapear gestão eletrônica de documentos e particularidades operacionais/regulatórias do Maranhão.','Deborah Mendes; Fabiano Vanucci; Thiago Bruno; Victor Simon; Rafael Burcoski e participantes','Realizada','Inventariar documentos, validades, compliance térmico e requisitos do GED.','MADRI-ACT-013','Transcrição GED/Maranhão 28/08/2026'
FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

-- Responsáveis por papel: somente nomes evidenciados; lacunas permanecem explícitas.
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-001',c.id,p.id,'Comercial / Operação','Usuário-chave','Nilton Barreto','Participação recorrente nas agendas e documentação PMO.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-002',c.id,p.id,'Faturamento','Usuário-chave','Julli Serrão','Agenda e transcrições de Faturamento.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-003',c.id,p.id,'Emissão BEL','Usuário-chave','Kartiney Ferreira','Workshop de Emissão.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-004',c.id,p.id,'GED / Maranhão','Operacional / Qualidade','Deborah Mendes','Reunião GED/Maranhão 28/08/2026.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-005',c.id,p.id,'Implantação Nucci','Responsável funcional / fornecedor','Fabiano Vanucci','Responsável da versão inicial do BBP e facilitador dos workshops.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-006',c.id,p.id,'Implantação Nucci','Funcional / fornecedor','Thiago Bruno','Participação recorrente e levantamento funcional nos workshops.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-007',c.id,p.id,'PMO','PMO','Victor Simon','Participação nas agendas e responsabilidade PMO registrada nos reports.','Confirmado' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-008',c.id,p.id,'Projeto MADRI','Aprovador do cliente','PENDENTE DE VALIDAÇÃO','Não existe aprovador por frente consolidado nas fontes auditadas.','A confirmar' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;
INSERT OR IGNORE INTO madri_pmo_roles(id,company_id,project_id,front,role_type,person_name,evidence,status)
SELECT 'MADRI-ROLE-009',c.id,p.id,'Tecnologia / Integrações','Técnico / desenvolvimento','PENDENTE DE VALIDAÇÃO','Tiago Brandão aparece em agendas, mas o papel técnico/RACI não está formalmente comprovado.','A confirmar' FROM companies c LEFT JOIN projects p ON p.id=(SELECT id FROM projects WHERE company_id=c.id ORDER BY id LIMIT 1) WHERE (lower(CAST(c.id AS TEXT)) IN ('madrid','madri') OR lower(c.name) IN ('madrid','madri')) LIMIT 1;

-- Evento inicial para todos os itens do seed; alterações posteriores serão registradas pela API.
INSERT INTO work_events(company_id,project_id,work_item_id,event_type,event_name,actor,metadata_json)
SELECT w.company_id,w.project_id,w.id,'madri_pmo','INSERT','bootstrap','{"source":"evidence_seed_2026-08-30"}'
FROM work_items w
WHERE w.pmo_scope='MADRI_NUCCI'
AND NOT EXISTS (SELECT 1 FROM work_events e WHERE e.work_item_id=w.id AND e.event_type='madri_pmo' AND e.event_name='INSERT');
