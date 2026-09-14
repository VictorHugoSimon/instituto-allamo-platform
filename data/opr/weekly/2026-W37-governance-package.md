# OPR — Pacote de Governança Semanal W37

**Período:** 07/09/2026 a 13/09/2026  
**Atualização:** 14/09/2026  
**Projeto:** implementação Nucci · OPR  
**Status:** Consolidado documentalmente · validações funcionais continuam abertas

## 1. Resumo executivo da semana

A semana W37 ampliou o Blueprint da OPR de forma relevante. O levantamento saiu do foco predominantemente operacional e avançou por três frentes principais: **Frota/Manutenção (08/09)**, **Financeiro (10/09)** e **Fiscal/Contábil (11/09)**. O resultado é uma visão mais completa do fluxo ponta a ponta, com dependências entre Operação, Frota, Compras, Estoque, Financeiro, Fiscal, Contabilidade, RH e integrações bancárias/municipais.

O ganho central da semana foi transformar controles hoje distribuídos em Excel, WhatsApp, e-mail, relatórios auxiliares e sistemas legados em requisitos de workflow, rastreabilidade, aprovação, auditoria, integração e homologação.

No plano técnico, o tenant OPR de STAGE foi restaurado isoladamente em 09/09 a partir do backup validado de 03/09, preservando o escopo OPR e executando smokes reais de POP e plataforma. A restauração validou a empresa OPR, o projeto ID 3 e 24 ações existentes no snapshot, sem DELETE e sem UPDATE em MADRI, Dual ou Semeali.

## 2. Evolução do Blueprint na semana

### 2.1 Frota e Manutenção — 08/09

O AS-IS foi caracterizado como descentralizado por base, com forte dependência de planilhas, WhatsApp e e-mail para disponibilidade, preventiva, corretiva e acompanhamento de veículos.

O TO-BE deve contemplar:

- agenda única de veículo e indisponibilidade;
- preventiva, corretiva e emergencial;
- ordem de manutenção com status, previsão, início/fim real e histórico;
- checklist como gate operacional;
- integração com Compras e Estoque quando houver falta de peça;
- gestão de pneus com rastreabilidade;
- abastecimento com hodômetro/horímetro e evidência;
- despesas, multas e aprovações;
- licenciamento/certificações e elegibilidade do veículo;
- dashboards por base e gestão por exceção.

A demonstração de solução permanece como referência funcional; regras, alçadas, tempos, bloqueios e campos exigem homologação OPR.

### 2.2 Financeiro — 10/09

O Financeiro passou a ter um desenho específico de AS-IS/TO-BE, cobrindo Contas a Receber, Contas a Pagar, bancos, conciliação, fluxo de caixa, folha/pagamentos, adiantamentos, terceiros/agregados e fechamento.

Principais achados:

- recebimentos parciais, complementos, descontos e divergências precisam manter vínculo com o documento original;
- o Financeiro não deve reconstruir manualmente a origem de gasto/receita que deveria nascer na área geradora;
- pagamentos e recebimentos devem ter aprovação, anexos, rateio, centro de custo e histórico;
- títulos em aberto precisam de saneamento antes da migração;
- a virada deve ter corte/congelamento e reconciliação quantidade × valor;
- CNAB/remessa-retorno deve ser priorizado onde disponível, com APIs bancárias como evolução/alternativa;
- Pix exige controle de permissão e medidas antifraude;
- “quitado” e “conciliado” não são sinônimos e precisam ser tratados separadamente;
- fechamento mensal deve bloquear retroativos; reabertura exige autorização, justificativa e auditoria.

### 2.3 Fiscal e Contábil — 11/09

A frente Fiscal/Contábil aprofundou regras que não podem ser derivadas por analogia com outra empresa ou município.

Foram consolidados requisitos para:

- contabilização por unidade emissora, conta de receita/imposto e centro de custo;
- distinção entre competência, fato gerador e data de emissão/autorização;
- reconciliação com planilhas/fechamentos históricos validados;
- NFS-e por município/unidade/serviço, com layouts, autenticação, códigos, retenções, cancelamento/substituição e contingência;
- entrada documental com segregação entre conferência operacional/física e auditoria fiscal;
- apuração tributária, retenções, créditos e obrigações acessórias;
- integração/exportação para Domínio e reconciliação contábil;
- pagamentos a agregados/terceiros diferenciando PF/PJ, RPA/folha, NFS-e e retenções aplicáveis;
- matriz de cenários fiscais para homologação antes de congelar parametrização;
- calendário de fechamento e controle de reabertura auditável.

A referência MADRI pode ser reaproveitada somente como estrutura metodológica; contas, regras, resultados, documentos e evidências precisam ser OPR.

## 3. Impacto no Plano de Ação

### Ações existentes aprofundadas

- **PA-011 / Faturamento e Conciliação:** baixa parcial, complemento, desconto, divergência e vínculo documental.
- **PA-013 / Receita e Competência:** competência × fato gerador × emissão, agora conectado a Fiscal/Contábil.
- **PA-022 / Frota e Manutenção:** workflow completo, checklist, peças, pneus, disponibilidade e dashboards.
- **PA-026 / Blueprint / Próximos levantamentos:** sequência ampliada com Financeiro e Fiscal/Contábil.

### Novas frentes registradas nos manifests da semana

- gestão do ciclo de vida de pneus;
- despesas, multas e aprovações da frota;
- licenciamento/certificações e elegibilidade veicular;
- workflow financeiro ponta a ponta de Contas a Receber/Pagar;
- saneamento e migração de títulos financeiros em aberto;
- integração bancária, CNAB/Pix e conciliação;
- fechamento financeiro e trilha de auditoria;
- pagamento/conciliação de agregados, terceiros, Target e motorista PX;
- matriz NFS-e/obrigações por município;
- workflow de entrada/conferência/auditoria fiscal;
- matriz de cenários fiscais e homologação tributária.

Os responsáveis formais e prazos permanecem **PENDENTE DE VALIDAÇÃO** quando não definidos explicitamente.

## 4. Delta controlado para a RFI

Os deltas abaixo não substituem a baseline oficial de 880 requisitos. Devem ser reconciliados contra a RFI e classificados como **já existe / ampliar / novo / backlog / rejeitado**.

### Deltas 08/09 — Frota/Manutenção

Mantêm-se os itens **RFI-D035 a RFI-D055**, já registrados anteriormente para manutenção, checklist, pneus, combustível, despesas, multas, compliance e documentos.

### Deltas 10–11/09 — Financeiro, Fiscal e Contábil

| ID | Módulo | Requisito proposto | Situação |
|---|---|---|---|
| RFI-D056 | Financeiro | Workflow integrado de Contas a Receber/Pagar desde a origem até aprovação, quitação e conciliação | A reconciliar |
| RFI-D057 | Financeiro | Suportar baixa parcial, saldo em aberto, suspensão, renegociação, complemento e histórico | A reconciliar |
| RFI-D058 | Migração/Financeiro | Saneamento, corte, congelamento e reconciliação de títulos na migração | A reconciliar |
| RFI-D059 | Bancos | CNAB/remessa-retorno para pagamentos e cobranças com rastreabilidade | A reconciliar |
| RFI-D060 | Bancos/Pix | Controle de Pix por cadastro/permissão e mecanismos antifraude | A reconciliar |
| RFI-D061 | Financeiro | Distinguir título quitado de efetivamente conciliado com extrato | A reconciliar |
| RFI-D062 | Financeiro/Contábil | Fechamento por competência com bloqueio de retroativos e reabertura auditada | A reconciliar |
| RFI-D063 | Controladoria/Fiscal | Tratar competência, fato gerador e data de emissão/autorização separadamente | A reconciliar |
| RFI-D064 | Contábil | Contabilização por unidade, conta, imposto, centro de custo e natureza operacional | A reconciliar |
| RFI-D065 | Contábil/Bancos | Reconciliar ERP, extrato, planilha de débito/crédito e integração com Domínio | A reconciliar |
| RFI-D066 | Fiscal/NFS-e | Parametrização versionada por município, unidade e serviço | A reconciliar |
| RFI-D067 | Fiscal | Controlar retenções, créditos, apuração e obrigações acessórias por regra validada | A reconciliar |
| RFI-D068 | Compras/Fiscal | Workflow entrada → conferência física/quantitativa → auditoria fiscal → aprovação/rejeição | A reconciliar |
| RFI-D069 | Fiscal/Testes | Matriz de cenários tributários e homologação ponta a ponta com evidência OPR | A reconciliar |
| RFI-D070 | Financeiro/Fiscal/RH | Diferenciar pagamento a PF/PJ, RPA/folha, NFS-e e retenções aplicáveis | A reconciliar |
| RFI-D071 | Fiscal/Contábil | Calendário de fechamento multiunidade/CNPJ e critérios de corte/reabertura | A reconciliar |
| RFI-D072 | Governança/Auditoria | Histórico de alteração de regra, usuário, data, campo, justificativa e aprovação | A reconciliar |

## 5. Evento técnico de STAGE — restore OPR de 09/09

O workflow **OPR STAGE - Restore Isolado do Backup Validado** foi concluído com sucesso.

Evidências técnicas registradas:

- backup obrigatório do D1 imediatamente antes da aplicação;
- fonte: backup D1 validado de 03/09;
- restore preparado com **439 INSERT OR IGNORE em 21 tabelas**;
- projeto OPR validado como **ID 3**;
- pós-validação retornou **24 ações OPR** no snapshot;
- nenhuma rotina de DELETE foi utilizada;
- MADRI, Dual e Semeali não foram atualizadas pelo restore;
- smoke do POP OPR passou;
- smoke da plataforma OPR passou com requisitos, riscos, integrações, testes, defeitos, documentos, readiness, Status Report, persistência e isolamento.

O restore deve ser tratado como evento técnico de recuperação controlada, não como alteração funcional do projeto.

## 6. Riscos atualizados

| Risco | Impacto | Resposta |
|---|---|---|
| Parametrizar regra financeira/fiscal sem evidência OPR | Alto | Homologação com casos reais e aceite do usuário-chave |
| Migrar “sujeira” do legado para o novo sistema | Alto | Saneamento + ensaio + reconciliação antes do cutover |
| Quitação bancária ser tratada como conciliação | Alto | Estados separados e validação por extrato |
| Alteração retroativa após fechamento | Alto | Bloqueio + reabertura autorizada + trilha de auditoria |
| Regra municipal de NFS-e ficar desatualizada | Alto | Matriz versionada por município + monitoramento + contingência |
| Fiscal assumir conferência física que pertence à operação | Alto | RACI e workflow segregando conferência e auditoria tributária |
| Regra de PF/PJ/retenção ser generalizada | Alto | Validação Fiscal/RH/Contábil por cenário |
| Workflow demonstrado virar baseline sem aceite | Alto | Demonstração = referência, não aprovação |
| Tenant OPR ficar indisponível no STAGE | Alto | Backup, restore isolado, pós-validação e smokes recorrentes |

## 7. Pendências para decisão

- responsáveis formais por Financeiro, Fiscal/Contábil, Frota/Manutenção e Pneus;
- matriz de alçadas e aprovadores;
- calendário oficial de fechamento e SLA;
- bancos/contas/convênios e layouts CNAB/API;
- política formal de Pix e antifraude;
- layout de migração e critério de reconciliação;
- lista de municípios/unidades e provedores NFS-e;
- plano de contas, centros de custo e regras de contabilização;
- documentos/regras para PF/PJ/agregados/terceiros;
- planilha de cenários fiscais e amostras reais para homologação;
- continuidade dos workshops mencionados para 14/09 e 16/09 — **A CONFIRMAR** até evidência de realização.

## 8. Próximos passos

1. Confirmar e registrar as sessões de continuidade de Fiscal/Contábil.
2. Consolidar BPMN Financeiro e Fiscal/Contábil.
3. Obter amostras reais de títulos, extratos, CNAB, NFS-e, documentos de entrada e fechamentos.
4. Definir matriz de alçadas e regras de fechamento/reabertura.
5. Preparar ensaio de migração financeira com reconciliação.
6. Construir matriz NFS-e por município e matriz de cenários fiscais.
7. Reconciliar RFI-D035 a RFI-D072 contra os 880 requisitos oficiais.
8. Derivar casos SIT/UAT/E2E para Frota, Financeiro, Fiscal e Contábil.
9. Manter STAGE com backup e smoke OPR antes/depois de mudanças estruturais.

## 9. Critério de encerramento das frentes

Nenhuma frente deve ser marcada como concluída apenas porque o workshop ocorreu. O gate mínimo permanece:

- AS-IS validado;
- TO-BE validado;
- responsáveis definidos;
- requisitos/gaps reconciliados;
- integrações identificadas;
- regras e alçadas aprovadas;
- casos de teste definidos;
- evidência/aceite do usuário-chave.
