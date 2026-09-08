# GAP ANALYSIS — MADRI × PADRÃO OPR

**Data-base:** 08/09/2026  
**Projeto:** MADRI · Implantação NUCCI ERP/TMS  
**Referência de forma:** OPR Governance Portal  
**Regra-mãe:** OPR = forma / MADRI = conteúdo  
**Ambiente autorizado nesta etapa:** STAGE  
**Produção:** não alterar nesta etapa  
**Baseline auditada:** `develop` em `bbb1cfb477ea31b789d68d44bab8bd51550bc8b2`

---

## 1. Resumo executivo

A MADRI já possui um núcleo funcional sólido para **Plano de Ação, Status Report, POP, Mapa Mestre, Plano de Testes e Portal**, com ações persistidas no D1 por `work_items` e escopo `MADRI_NUCCI`.

Entretanto, a experiência atual da MADRI está **uma geração atrás do portal OPR** em três pontos principais:

1. **Navegação:** OPR já possui jornada única numerada de 01 a 15; MADRI ainda utiliza menu reduzido com módulos desabilitados/em migração.
2. **Cobertura funcional:** MADRI em `develop` não possui páginas permanentes para Blueprint, Requisitos, Integrações, Riscos, Defeitos, Readiness, Decisões, Documentos e Biblioteca.
3. **Persistência:** Plano de Ação MADRI já usa D1, porém Plano de Testes e edição do POP ainda mantêm dependências de armazenamento local no navegador. Requisitos/Riscos/Integrações/Documentos etc. têm implementação candidata no PR #223, mas o PR está antigo, aberto e não mergeável contra o `develop` atual.

**Conclusão:** não devemos copiar a OPR nem tentar mergear o PR #223 diretamente. O caminho seguro é criar uma nova branch a partir do `develop` atual, reaproveitar seletivamente o backend MADRI existente e portar apenas os padrões visuais/funcionais maduros da OPR.

---

## 2. Baseline atual auditada

### 2.1 MADRI já existente e deve ser preservada

- `/madri/`
- `/madri-plano-de-acao/`
- `/madri-status-report/`
- `/madri-pop/`
- `/madri-mapa-implantacao/`
- `/madri-plano-testes/`
- `public/madri/assets/platform.css`
- `public/madri/assets/platform.js`
- `src/madri-pmo-api.js`
- `src/madri-pmo-public-api.js`
- `work_items` com `pmo_scope='MADRI_NUCCI'`
- `work_events` para histórico operacional
- tabelas auxiliares `madri_pmo_*` já usadas pelo Plano de Ação
- workflow manual `MADRI PMO - Stage Schema + CRUD Smoke`

### 2.2 OPR como referência funcional/visual

A OPR hoje possui navegação única e permanente:

01. Visão Geral  
02. Blueprint  
03. Plano de Ação  
04. Requisitos  
05. Integrações  
06. Riscos  
07. Mapa Mestre  
08. Testes  
09. Defeitos  
10. Readiness  
11. Decisões  
12. Status Report  
13. POP  
14. Documentos  
15. Biblioteca / Drive

A OPR também possui runtime compartilhado de CRUD (`entity-page.js`), APIs `/api/opr-platform/*`, histórico, lixeira, restore, versionamento documental e resumo executivo derivado da base.

---

## 3. Matriz de GAP por módulo

| # | Módulo | Situação MADRI | Classificação | Ação recomendada |
|---|---|---|---|---|
| 01 | Visão Geral | Existe `/madri/`, mas menu/KPIs são reduzidos e há módulos desabilitados | **EXISTE E PADRONIZAR** | Aplicar jornada 01–15, menu lateral OPR-equivalente e KPIs derivados somente da MADRI |
| 02 | Blueprint | Conteúdo documental existe, mas não há `/madri-blueprint/` em `develop` | **NÃO EXISTE E PRECISA CRIAR** | Criar página MADRI usando BBP/workshops/RFI MADRI; não copiar processos OPR |
| 03 | Plano de Ação | Existe, CRUD real D1, histórico, lixeira, pendências e customizações | **EXISTE E PRESERVAR / PADRONIZAR UI** | Manter backend `madri-pmo`; alinhar menu, CSS, breadcrumbs e UX ao portal único |
| 04 | Requisitos | Não existe em `develop`; há código candidato no PR #223 | **EXISTE MAS PRECISA EVOLUIR** | Reaproveitar schema/API candidato após rebase seletivo; carregar somente requisitos MADRI |
| 05 | Integrações | Não existe em `develop`; código candidato no PR #223 | **EXISTE MAS PRECISA EVOLUIR** | Portar CRUD isolado MADRI e página equivalente OPR |
| 06 | Riscos | Não existe em `develop`; código candidato no PR #223 | **EXISTE MAS PRECISA EVOLUIR** | Portar registro de riscos com impacto, probabilidade, mitigação, owner e RAG |
| 07 | Mapa Mestre | Existe e deve ser preservado | **EXISTE E PADRONIZAR** | Integrar ao menu global, indicar “Você está aqui” e próximo gate; depois conectar a readiness/fases D1 |
| 08 | Testes | Existe, mas a versão atual ainda informa salvamento no navegador | **EXISTE MAS PRECISA EVOLUIR** | Migrar casos/defeitos/evidências para D1; preservar baseline SIT/UAT/E2E |
| 09 | Defeitos | Não há URL dedicada em `develop`; existe candidato no PR #223 | **NÃO EXISTE EM STAGE / PRECISA CRIAR** | Criar `/madri-defeitos/` conectado ao teste relacionado, severidade, reteste e evidência |
| 10 | Readiness | Não há página dedicada em `develop` | **NÃO EXISTE E PRECISA CRIAR** | Criar `/madri-readiness/` e checklist derivado de requisitos, integrações, testes, dados, usuários, riscos etc. |
| 11 | Decisões | Não há página dedicada em `develop` | **NÃO EXISTE E PRECISA CRIAR** | Criar Decision Log MADRI com contexto, decisão, aprovador, impacto e evidência |
| 12 | Status Report | Existe e possui URL permanente | **EXISTE E PADRONIZAR** | Evoluir para mesma composição executiva OPR, derivando da base; nunca inventar percentual |
| 13 | POP | Existe, mas edição ainda possui persistência local no navegador | **EXISTE MAS PRECISA EVOLUIR** | Migrar versionamento/edição para D1; manter documento oficial e histórico |
| 14 | Documentos | Não existe em `develop`; há candidato no PR #223 | **EXISTE MAS PRECISA EVOLUIR** | Portar CRUD + versionamento MADRI; relacionar a requisito/ação/decisão |
| 15 | Biblioteca | Não existe `/madri-biblioteca/` | **NÃO EXISTE E PRECISA CRIAR** | Criar porta de entrada para Drive MADRI, sem duplicar arquivos |

---

## 4. GAP de navegação e UX

### OPR atual

- `navGroups` por jornada;
- numeração visível 01–15;
- item ativo com `aria-current="page"`;
- URLs permanentes para todos os módulos;
- foco por teclado;
- sidebar fixa em desktop e navegação horizontal responsiva em mobile;
- componentes compartilhados;
- biblioteca integrada ao fluxo.

### MADRI atual

- separação antiga entre `officialRoutes` e `supportRoutes`;
- apenas Portal, Plano, Status, POP, Mapa e Testes são clicáveis;
- Requisitos, Riscos, Integrações e Documentos aparecem desabilitados;
- não existe sequência visual 01–15;
- CSS MADRI compartilha os tokens principais com OPR, mas ainda não contém todos os hardenings atuais de acessibilidade, foco, navegação e mobile presentes na OPR.

### GAP

**Prioridade ALTA.** O primeiro incremento de implementação deve ser o **shell/navegação MADRI**, sem alterar dados e sem remover funcionalidades internas dos módulos existentes.

---

## 5. GAP de backend e persistência

### Preservar

O Plano de Ação MADRI já possui isolamento explícito por:

- tenant Madrid/Madri resolvido no banco;
- projeto NUCCI preferencial;
- `company_id`;
- `project_id`;
- `pmo_scope='MADRI_NUCCI'`;
- autorização por perfil;
- soft delete;
- restore;
- histórico em `work_events`.

Esse backend é a **fonte oficial das ações** e não deve ser substituído por uma cópia do backend OPR.

### Evoluir

O PR #223 contém um candidato de plataforma MADRI com:

- `madri_requirements`
- `madri_risks`
- `madri_integrations`
- `madri_tests`
- `madri_test_defects`
- `madri_documents`
- `madri_document_versions`
- `madri_implementation_phases`
- `madri_readiness`
- `madri_decisions`
- auditoria/sequência
- API `/api/madri-platform/*`

Porém, o PR #223:

- foi aberto sobre um `develop` antigo;
- permanece aberto;
- está atualmente **não mergeável** contra o `develop` atual;
- não deve ser mergeado diretamente.

### Estratégia segura

Criar uma nova branch do `develop` atual e **reaproveitar seletivamente**:

1. migration MADRI;
2. API MADRI;
3. runtime genérico de entidades;
4. páginas de Requisitos/Riscos/Integrações/Documentos/Testes/Defeitos;
5. validadores.

Depois criar do zero, sobre esse padrão, as páginas que o PR #223 não completou como rotas dedicadas: Blueprint, Readiness, Decisões e Biblioteca.

---

## 6. GAP do Plano de Testes

O Plano de Testes atual é funcional e já contém:

- SIT;
- UAT;
- E2E;
- prioridades;
- status;
- evidências;
- defeitos;
- Go/No-Go preliminar.

Entretanto, a própria tela informa que alterações são salvas no navegador. Portanto, no padrão solicitado:

**localStorage/sessionStorage não pode ser fonte de verdade operacional.**

A migração deve preservar a baseline de casos já montada e transferi-la para `madri_tests`, sem perda de cenários.

---

## 7. GAP do POP

O POP MADRI já existe e deve ser preservado como documento de governança.

Pendência:

- edição/versionamento local deve ser substituído por persistência no D1;
- versão vigente e histórico precisam ser globais, não dependentes do navegador;
- o POP deve receber o menu global 01–15.

---

## 8. GAP de documentos e Biblioteca / Drive

A auditoria no Google Drive encontrou materiais MADRI reais, entre eles:

- `NUCCI_BBP_Business_Blueprint_MADRI_v1.pdf`;
- RFP MADRI em DOCX/PDF;
- Status Reports MADRI;
- agendas compartilhadas OPR/Madri;
- POPs operacionais;
- propostas e documentos de projeto.

Também existem **múltiplas pastas relacionadas à MADRI**, incluindo:

- `01. Madri`;
- `Madri-`;
- pasta histórica de RFI Madri/OPR;
- pastas de projeto/processos.

### GAP

Ainda não há uma **Biblioteca MADRI canônica** no portal e a existência de múltiplas pastas exige curadoria antes de publicar links.

### Regra para a Biblioteca

- escolher/confirmar a pasta oficial MADRI;
- não listar arquivos OPR como conteúdo MADRI;
- materiais compartilhados OPR/Madri devem ser identificados como compartilhados e filtrados por contexto;
- manter arquivos no Drive e usar o portal apenas como índice/porta de entrada;
- documentos operacionais devem ter referência/versionamento na tabela `madri_documents` quando aplicável.

---

## 9. GAP de Status Report

A MADRI já possui Status Report e endpoint público derivado do Plano de Ação.

Para atingir o padrão OPR, o report deve passar a consolidar também:

- requisitos e gaps;
- integrações;
- riscos;
- testes/defeitos;
- readiness;
- decisões;
- próximo marco;
- próximos 7 dias;
- próximos 15 dias.

**Regra:** números e RAG devem ser calculados da base MADRI. Sem evidência = `N/D`, `A confirmar` ou `PENDENTE DE VALIDAÇÃO`.

---

## 10. GAP de segurança e isolamento

### Controles já positivos

- `MADRI_NUCCI` já separa ações MADRI;
- o código MADRI atual resolve company/project antes das queries;
- workflow MADRI possui smoke dedicado;
- PR #223 já previa tabelas `madri_*` e referência de secret, sem armazenar token em tela.

### Testes negativos obrigatórios a adicionar/expandir

1. MADRI não lê OPR.
2. OPR não lê MADRI.
3. MADRI não altera OPR.
4. OPR não altera MADRI.
5. busca/listagem não mistura tenants.
6. histórico/restore não cruza tenant.
7. exportações não misturam tenants.
8. Status Report MADRI só usa dados MADRI.
9. Biblioteca MADRI não expõe links classificados como exclusivamente OPR.

---

## 11. GAP de testes e workflows

### Já existe

- `MADRI PMO - Stage Schema + CRUD Smoke`;
- build antes do gate;
- backup D1 antes de alteração;
- dry-run de schema;
- sessão técnica efêmera;
- smoke real de CRUD do Plano MADRI;
- validação de isolamento/ambiente em outros gates da plataforma.

### Evoluir

Criar/expandir gate dedicado da **Governança MADRI completa** para validar:

- 15 URLs;
- menu e item ativo;
- CRUD de cada entidade D1;
- F5/persistência;
- lixeira/restore;
- histórico;
- versionamento documental;
- SIT/UAT/E2E e defeitos;
- readiness/decisões;
- testes negativos OPR × MADRI;
- responsividade mínima;
- ausência de `localStorage` como fonte operacional.

---

## 12. Priorização

### P0 — pré-condições

- não mergear PR #223 diretamente;
- criar nova branch do `develop` atual;
- manter Produção intocada;
- preservar `work_items[pmo_scope=MADRI_NUCCI]` como fonte das ações.

### P1 — experiência única

- alinhar `platform.css` ao Design System OPR atual;
- substituir navegação MADRI antiga por `navGroups` 01–15;
- padronizar Portal, Plano, Mapa, Testes, Status e POP.

### P2 — completar plataforma D1

- Requisitos;
- Integrações;
- Riscos;
- Defeitos;
- Documentos;
- schema/auditoria;
- migração do Plano de Testes para D1.

### P3 — módulos faltantes

- Blueprint;
- Readiness;
- Decisões;
- Biblioteca.

### P4 — consolidação executiva

- Status Report derivado de toda a governança;
- portal com KPIs completos;
- Mapa Mestre integrado a fases/readiness;
- POP global versionado.

### P5 — homologação

- regressão completa;
- isolamento OPR × MADRI;
- responsividade;
- acessibilidade;
- smoke STAGE;
- evidências.

Produção somente após homologação e autorização explícita.

---

## 13. Arquivos que devem ser preservados como base

- `public/madri/index.html`
- `public/madri/assets/platform.css`
- `public/madri/assets/platform.js`
- `public/madri-plano-de-acao/index.html`
- `public/madri-status-report/index.html`
- `public/madri-pop/index.html`
- `public/madri-mapa-implantacao/index.html`
- `public/madri-plano-testes/index.html`
- `src/madri-pmo-api.js`
- `src/madri-pmo-public-api.js`
- `scripts/build-madri-pmo.mjs`
- `scripts/ensure-madri-pmo-schema.mjs`
- `scripts/validate-madri-pmo-static.mjs`
- `.github/workflows/madri-pmo-stage-schema.yml`

Nenhum desses arquivos deve ser descartado apenas para copiar a OPR.

---

## 14. Próxima implementação recomendada

Criar uma branch nova, a partir do `develop` atual, para:

1. portar o shell visual/navegação OPR → MADRI;
2. corrigir as 6 páginas MADRI já existentes para usar o menu global;
3. recuperar seletivamente do PR #223 o schema/API/runtime das entidades;
4. criar as URLs faltantes;
5. migrar Testes/POP para D1;
6. implementar testes negativos de isolamento;
7. publicar apenas em STAGE;
8. homologar antes de qualquer promoção.

---

## 15. Critério de saída desta auditoria

**GAP ANALYSIS concluído. Nenhuma alteração funcional, schema ou deploy foi executado nesta etapa.**

A próxima etapa somente deve iniciar em branch própria e permanecer restrita ao STAGE.
