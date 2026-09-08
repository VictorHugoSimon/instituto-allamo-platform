# OPR — Pacote de Governança Semanal W37

**Período:** 07/09/2026 a 13/09/2026  
**Atualização:** 08/09/2026  
**Projeto:** implementação Nucci · OPR  
**Status:** Em validação

## 1. Resumo executivo da reunião de 08/09

A reunião aprofundou a frente de **Frota e Manutenção** e mostrou que o AS-IS atual é fortemente descentralizado: cada base mantém controles próprios, principalmente em Excel, e a informação operacional é disseminada por WhatsApp/e-mail. Não existe hoje uma visão sistêmica única e em tempo real de veículo disponível, veículo em manutenção, manutenção preventiva futura, início/fim efetivo da parada e tempo total de indisponibilidade.

O TO-BE demonstrado organiza o processo em ordem de manutenção com estados, histórico, cotação/aprovação, execução, anexos, dashboards por base e visão de disponibilidade. A demonstração foi tratada como **referência funcional**, não como aceite automático: campos, regras, tempos de atenção, bloqueios, alçadas e customizações precisam ser homologados pela OPR.

Também surgiram requisitos concretos para **checklist, pneus, abastecimento, despesas, multas, licenciamento/certificações e integração com Compras/Estoque/Financeiro/RH**.

## 2. O que houve de novo

### 2.1 Manutenção passou de controle local para workflow integrado

Novo entendimento confirmado:

- cada base controla hoje sua manutenção de forma descentralizada;
- Excel/WhatsApp/e-mail são usados para comunicar indisponibilidade e acompanhamento;
- não há gestão centralizada de início/fim da manutenção nem de tempo parado;
- preventiva existe de forma básica e precisa de planejamento por veículo/modelo/km/horímetro;
- o sistema deve controlar preventiva, corretiva e emergencial;
- o planejamento não deve utilizar veículo indisponível ou bloqueado por manutenção;
- múltiplas ordens podem existir para o mesmo veículo/fornecedor;
- histórico de atualização precisa alimentar dashboards de gestão por exceção;
- tempos/cores de atenção devem ser configuráveis e homologados, sem valores presumidos.

### 2.2 Checklist ganhou papel de gate operacional

O checklist deixa de ser apenas formulário e passa a ser requisito funcional de controle:

- modelos diferentes por tipo de veículo/operação;
- campos sim/não ou conformidade configuráveis;
- foto e observação obrigatórias quando aplicável;
- não conformidade pode gerar ordem de manutenção automaticamente;
- bloqueio do veículo/viagem deve depender da criticidade/regra homologada;
- recorrência pode ser configurada quando existir regra operacional validada;
- evidência deve ficar ligada ao veículo, motorista, data/hora e checklist.

### 2.3 Manutenção precisa integrar Compras e Estoque

Quando uma ordem exigir peça/equipamento sem disponibilidade:

**Manutenção → Solicitação de compra → Cotação/Aprovação → Compra → Entrada em estoque → Retorno para execução da manutenção.**

A matriz de alçadas deve ser configurável. Valores mencionados na reunião foram apenas exemplos e não constituem decisão.

### 2.4 Gestão de pneus deixou de ser backlog genérico

A demonstração apresentou requisitos suficientes para uma frente própria:

- inventário de pneus;
- posição por veículo/eixo;
- fabricante/modelo/identificação;
- validade quando aplicável;
- profundidade de sulco;
- calibragem;
- status normal/atenção/perigo;
- troca;
- rodízio;
- reparo/recapagem/vulcanização;
- descarte;
- rastreabilidade de pneu retirado e instalado;
- geração de OS;
- vínculo com veículo, motorista e km;
- possibilidade futura de integração com sensores/telemetria.

A principal restrição é de **adoção/capacidade operacional**: sem responsável e disciplina de atualização, o módulo perde valor.

### 2.5 Abastecimento foi parcialmente detalhado

Requisitos levantados:

- ticket de abastecimento;
- placa;
- data/hora;
- combustível;
- hodômetro;
- litros;
- tarifa/valor;
- foto/evidência;
- validação de inconsistência de quilometragem;
- atualização do km do veículo a partir de fontes confiáveis;
- capacidade do tanque;
- odômetro e horímetro;
- consumo/média por veículo e motorista;
- fornecedores e forma de pagamento;
- dashboard de consumo e alertas de preventiva por km.

Combustível ainda precisa de sessão específica para fechar regra OPR, fonte de dados e integração.

### 2.6 Despesas e multas viraram fluxo de governança financeira

Foi identificado o need de distinguir **manutenção** de **despesa já ocorrida**, com suporte a:

- despesa individual por veículo;
- despesa consolidada para várias placas;
- fatura de rastreamento, lavagem, locação e outros serviços;
- documento fiscal/anexo;
- fornecedor/contrato;
- centro de custo;
- integração financeira/fluxo de caixa após validação.

Para multas:

- número/notificação;
- órgão/autuador;
- infração;
- data/hora/local;
- placa;
- condutor;
- evidências/documentos;
- recurso quando aplicável;
- encaminhamento ao Financeiro;
- comunicação com RH.

Qualquer desconto em remuneração ou responsabilização do colaborador exige validação formal de RH/Jurídico.

### 2.7 Compliance veicular ganhou requisito próprio

O cadastro de veículo deve controlar:

- licenciamento;
- exercício/vencimento;
- anexos;
- alertas prévios;
- certificações/documentos por operação/cliente;
- elegibilidade do veículo para determinada viagem.

O catálogo definitivo de documentos e bloqueios permanece A CONFIRMAR.

## 3. Impacto no Plano de Ação

### Ações existentes atualizadas

- **PA-022 — Frota / Manutenção:** expandido para workflow completo, preventiva, disponibilidade, checklist, Compras/Estoque, tempo parado e dashboard por base.
- **PA-017 — Solução integrada / fornecedor:** demonstração de 08/09 registrada como evidência funcional; falta homologar regras OPR.
- **PA-026 — Próximos levantamentos:** Manutenção/Frota avançou; Combustível e demais regras seguem em andamento.

### Novas ações registradas

- **A17 — Gestão do ciclo de vida de pneus** — novo escopo funcional.
- **A18 — Despesas, multas e aprovações da frota** — nova frente Financeiro/RH.
- **A19 — Licenciamento, certificações e elegibilidade veicular** — nova frente de compliance.

Os IDs PA definitivos serão os atribuídos pelo sincronizador no STAGE; não devem ser presumidos antes da execução do pipeline.

## 4. Delta de requisitos/RFI — W37

Os itens abaixo são deltas controlados para reconciliação com a RFI oficial de 880 requisitos. Não alteram automaticamente a baseline.

| ID | Módulo | Requisito proposto | Situação |
|---|---|---|---|
| RFI-D035 | Frota/Oficina | Centralizar disponibilidade e manutenção por base em tempo real | A reconciliar |
| RFI-D036 | Oficina | Planejar preventiva por veículo/modelo/km/horímetro/plano configurável | A reconciliar |
| RFI-D037 | Oficina | Controlar OS com status, previsão, início/fim real, tempo parado e histórico | A reconciliar |
| RFI-D038 | Oficina/Compras | Gerar solicitação de compra quando peça não estiver disponível | A reconciliar |
| RFI-D039 | Compras/Oficina | Aplicar matriz configurável de alçadas de orçamento/aprovação | A reconciliar |
| RFI-D040 | Frota/Mobile | Checklist configurável por classe/operação com foto/observação | A reconciliar |
| RFI-D041 | Frota/Oficina | Não conformidade de checklist gera OS e bloqueio conforme regra homologada | A reconciliar |
| RFI-D042 | Oficina | Suportar múltiplas OS por veículo/fornecedor e histórico consolidado | A reconciliar |
| RFI-D043 | BI/Oficina | Dashboard por base/unidade com status e tempo desde última atualização | A reconciliar |
| RFI-D044 | Pneus | Inventário, posição, identificação, sulco, calibragem e status do pneu | A reconciliar |
| RFI-D045 | Pneus/Oficina | Troca, rodízio, reparo, descarte e OS com rastreabilidade do pneu | A reconciliar |
| RFI-D046 | Integrações/Frota | Integrar sensores/telemetria de pneus quando disponível | Evolução técnica |
| RFI-D047 | Combustível | Registrar ticket, placa, hodômetro, litros, tarifa, valor e evidência | A reconciliar |
| RFI-D048 | Combustível/Frota | Validar inconsistências de hodômetro/horímetro entre fontes | A reconciliar |
| RFI-D049 | BI/Combustível | Indicadores de consumo por veículo/motorista e preventiva por km | A reconciliar |
| RFI-D050 | Despesas | Registrar despesas individuais e consolidadas por placas | A reconciliar |
| RFI-D051 | Multas/RH/Financeiro | Fluxo de multa com condutor, documentos, recurso e encaminhamento | A reconciliar |
| RFI-D052 | Frota/Compliance | Licenciamento/certificações com vencimento, alerta e elegibilidade | A reconciliar |
| RFI-D053 | Fornecedores/Documentos | Manter contratos, documentos, homologação e forma de pagamento | A reconciliar |
| RFI-D054 | Oficina/Documentos | Anexar documentos, fotos e vídeos à manutenção/OS | A reconciliar |
| RFI-D055 | Frota | Manter km/horímetro mestre com regra de precedência e histórico de divergência | A reconciliar |

## 5. Riscos atualizados

| Risco | Impacto | Resposta proposta |
|---|---|---|
| Veículo ser planejado enquanto está indisponível | Alto | Agenda única e bloqueio por status homologado |
| Preventiva continuar descentralizada | Alto | Centralizar plano e alertas por veículo |
| Checklist existir sem tratativa da não conformidade | Alto | OS automática e workflow de responsável |
| Alçada excessivamente baixa travar operação | Alto | Matriz de alçada por valor/categoria/base aprovada pela gestão |
| Alçada inexistente permitir gasto sem controle | Alto | Aprovação rastreável e auditoria |
| Km divergente entre viagem/abastecimento/manutenção | Alto | Regra de precedência + log de divergência |
| Gestão de pneus sem responsável | Alto | Definir owner e escopo mínimo antes de implantação |
| Multa/desconto tratado sem validação trabalhista | Alto | Gate RH/Jurídico |
| Documento veicular vencido em operação | Alto | Alertas + elegibilidade documental |
| Automatizar regra demonstrada sem aceite OPR | Alto | Demonstração é referência, não baseline aprovada |

## 6. Pendências para decisão

- responsável formal por Frota/Manutenção;
- responsável pela gestão de pneus;
- matriz de alçadas e aprovadores;
- critérios de bloqueio por checklist;
- tempos/cores de atenção do dashboard;
- plano preventivo por tipo/modelo de veículo;
- fonte mestre de km/horímetro;
- integração real de abastecimento;
- fluxo contábil/financeiro de despesas consolidadas;
- política de multas e eventual desconto, com RH/Jurídico;
- catálogo de licenças/certificações por operação;
- critérios de homologação de fornecedores.

## 7. Próximos passos

1. Continuação de **Combustível** indicada para 09/09/2026 — confirmar agenda e fechar AS-IS/TO-BE.
2. Validar **Frota/Manutenção** com usuário-chave e congelar regras de OS, checklist, bloqueio e disponibilidade.
3. Definir **matriz de alçadas** com gestão/Financeiro.
4. Definir owner e escopo de **Pneus**.
5. Workshop **Despesas/Multas** com Financeiro + RH/Jurídico.
6. Inventariar **licenças/certificações** da frota.
7. Reconciliar RFI-D035 a RFI-D055 contra os 880 requisitos oficiais.
8. Derivar casos de teste para manutenção, checklist, pneus, combustível e compliance.

## 8. Critério de encerramento da frente

A frente Frota/Manutenção só deve ser marcada como concluída quando houver:

- AS-IS validado;
- TO-BE validado;
- responsáveis definidos;
- requisitos/gaps reconciliados;
- integrações identificadas;
- regras de bloqueio/alçada aprovadas;
- casos de teste definidos;
- evidência/aceite do usuário-chave.
