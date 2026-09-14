# OPR — Estado Atual / Abertura W38

**Data de referência:** 14/09/2026  
**Projeto:** implementação Nucci · OPR  
**Ambiente:** STAGE  
**Produção:** não alterada

## 1. Conclusão executiva

A OPR possui hoje um portal único de governança em STAGE, com navegação lateral sequencial e URLs permanentes por módulo. A recuperação isolada do tenant OPR foi concluída e validada em 09/09. A semana W37 foi fechada documentalmente com as frentes de Frota/Manutenção, Financeiro e Fiscal/Contábil consolidadas.

O último commit de aplicação/documentação anterior a este registro, `5987b45f2049927109872170e1667bcc8abc1d4a`, foi publicado no STAGE com os quatro contextos de release em sucesso: gates, autenticação Cloudflare, configuração/schema aditivo e deploy canônico.

Ressalva de governança: o release genérico atual valida que o STAGE pode operar inclusive em estado zero e não provisiona dados de negócio. A última evidência específica de negócio OPR continua sendo o restore/smoke isolado de 09/09. Portanto, antes de declarar uma nova mudança funcional como homologada, executar novamente smoke OPR específico.

## 2. Portal único OPR — sequência oficial

1. **Visão Geral** — https://allamo-pmo-stage.pages.dev/opr/
2. **Blueprint** — https://allamo-pmo-stage.pages.dev/opr-blueprint/
3. **Plano de Ação** — https://allamo-pmo-stage.pages.dev/opr-plano-de-acao/
4. **Requisitos** — https://allamo-pmo-stage.pages.dev/opr-requisitos/
5. **Integrações** — https://allamo-pmo-stage.pages.dev/opr-integracoes/
6. **Riscos** — https://allamo-pmo-stage.pages.dev/opr-riscos/
7. **Mapa Mestre** — https://allamo-pmo-stage.pages.dev/opr-mapa-implantacao/
8. **Testes** — https://allamo-pmo-stage.pages.dev/opr-plano-testes/
9. **Defeitos** — https://allamo-pmo-stage.pages.dev/opr-defeitos/
10. **Readiness** — https://allamo-pmo-stage.pages.dev/opr-readiness/
11. **Decisões** — https://allamo-pmo-stage.pages.dev/opr-decisoes/
12. **Status Report** — https://allamo-pmo-stage.pages.dev/opr-status-report/
13. **POP** — https://allamo-pmo-stage.pages.dev/opr-pop/
14. **Documentos** — https://allamo-pmo-stage.pages.dev/opr-documentos/
15. **Biblioteca / Drive** — https://allamo-pmo-stage.pages.dev/opr-biblioteca/

A ordem segue a jornada de governança: **entender → planejar → executar → controlar → testar → decidir → reportar → documentar**.

## 3. Estado técnico validado

### Restore isolado OPR — 09/09

Workflow: `OPR STAGE - Restore Isolado do Backup Validado`

Resultado confirmado:

- backup pré-restore obrigatório;
- fonte: backup D1 validado de 03/09;
- 439 `INSERT OR IGNORE` preparados em 21 tabelas;
- empresa OPR validada;
- projeto OPR validado como ID 3;
- 24 ações OPR encontradas no snapshot após o restore;
- smoke POP OPR: sucesso;
- smoke plataforma OPR: sucesso;
- sem DELETE;
- sem UPDATE em MADRI, Dual ou Semeali;
- release STAGE final disparada somente após smokes OPR verdes.

### Release de 14/09

Commit `5987b45f2049927109872170e1667bcc8abc1d4a`:

- `allamo/stage-gates`: sucesso;
- `allamo/stage-cloudflare-auth`: sucesso;
- `allamo/stage-config`: sucesso;
- `allamo/stage-deploy`: sucesso.

O release publicou o STAGE canônico sem provisionar dados de negócio, mantendo a política de schema/configuração aditiva.

## 4. Estado documental do Blueprint

### Operação

Levantamento amplamente avançado entre 31/08 e 03/09: Line Haul, Last Mile, Planejamento, Contratação, Cadastro/PGR, Frota, Torre, evidências e integrações.

### Frota/Manutenção

Aprofundado em 08/09: manutenção, checklist, pneus, abastecimento, despesas, multas, compliance veicular e integração com Compras/Estoque/Financeiro/RH.

### Financeiro

Aprofundado em 10/09: Contas a Receber/Pagar, migração de títulos, CNAB/Pix, conciliação bancária, pagamentos, adiantamentos, fechamento e auditoria.

### Fiscal/Contábil

Aprofundado em 11/09: NFS-e, entradas, apuração, retenções/créditos, Domínio, contabilização, conciliação, PF/PJ/agregados/terceiros e homologação tributária.

Nenhuma dessas frentes deve ser marcada como concluída sem aceite formal do usuário-chave e reconciliação dos requisitos.

## 5. Baseline de requisitos

- RFI oficial: **880 requisitos**.
- Deltas controlados W36: `RFI-D001` a `RFI-D034`.
- Deltas controlados W37/Frota: `RFI-D035` a `RFI-D055`.
- Deltas controlados W37/Financeiro-Fiscal: `RFI-D056` a `RFI-D072`.

Os deltas não alteram automaticamente a RFI oficial. Cada item deve ser reconciliado como **já existe / ampliar / novo / backlog / rejeitado**.

## 6. Gates atuais para a próxima etapa

1. Confirmar realização das continuações de Fiscal/Contábil citadas para 14/09 e 16/09.
2. Consolidar BPMNs por frente.
3. Obter evidências/documentos reais para Financeiro e Fiscal.
4. Reconciliar `RFI-D035` a `RFI-D072` contra a RFI oficial.
5. Definir responsáveis, alçadas, calendários e critérios de aceite.
6. Derivar SIT/UAT/E2E dos requisitos aprovados.
7. Executar smoke OPR específico após mudanças funcionais relevantes.
8. Manter Produção bloqueada até homologação explícita.

## 7. Fonte de verdade

- **Plano Mestre OPR em STAGE:** execução e ações.
- **Requisitos OPR / RFI oficial:** baseline funcional e gaps.
- **Blueprint / reuniões:** evidências e refinamentos.
- **Integrações, Riscos e Testes:** governança técnica.
- **Status Report:** visão executiva derivada, nunca segunda fonte de verdade.
- **Biblioteca / Drive:** documentos e evidências de apoio.

**Status deste documento:** vigente como referência de abertura da W38 até nova evidência de reunião, decisão ou release funcional.
