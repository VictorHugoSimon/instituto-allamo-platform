# OPR — Pacote de Governança Semanal

**Período:** 31/08/2026 a 03/09/2026  
**Projeto:** implementação Nucci · OPR  
**Objetivo:** consolidar o que surgiu de novo na semana, ajustar o Blueprint e preparar o delta controlado para a RFI oficial.

> Regra de governança: a RFI oficial permanece como baseline documental até validação dos Key Users. Os itens abaixo são **delta proposto** e não devem ser incorporados silenciosamente aos 880 requisitos sem rastreabilidade de aprovação.

---

## 1. Resumo executivo — o que houve de novo nesta semana

A semana mudou o nível de entendimento do projeto. Antes havia uma baseline documental de seleção/RFI-RFP e uma visão macro da operação. Entre 31/08 e 03/09 o projeto avançou para um **Blueprint operacional detalhado**, com processos reais, exceções, handoffs entre áreas e requisitos de integração suficientes para orientar parametrização e desenvolvimento.

### 1.1 Blueprint operacional deixou de ser genérico

Foi consolidada a separação entre **Line Haul e Last Mile**, com diferenças de demanda, planejamento, contratação, carregamento, emissão, roteirização, monitoramento, entrega e fechamento.

Fluxo de referência consolidado:

**Demanda → Planejamento → Disponibilidade → Contratação → Cadastro/Consulta/PGR → Carregamento → Emissão → Viagem → Torre de Controle → Chegada → Descarga/Evidência → Finalização → Liberação do veículo → Faturamento**

A operação utiliza combinações de sistemas de clientes, ferramentas internas, Envoy/Ivoi, planilhas, e-mail e WhatsApp. O TO-BE deve reduzir essa fragmentação sem remover contingência operacional.

### 1.2 Contratação passou a ter handoff sistêmico

Foi detalhada a diferença operacional entre frota própria, agregado/dedicado e terceiro spot. O negociador não deve executar todo o cadastro: registra os dados mínimos do prestador/motorista e gera uma tarefa para Cadastro/Consulta/PGR; após liberação, o recurso volta ao Planejamento.

### 1.3 Mercado Livre virou fluxo específico de produto

A semana esclareceu que Mercado Livre exige tratamento próprio para:

- captação/oportunidade;
- aceite e recusa;
- cancelamento e alteração de capacidade;
- motivo de recusa;
- atribuição de veículo e motorista;
- CSV e eventuais APIs;
- comunicação com o cliente;
- segregação de usuários/permissões;
- confirmação da rota e execução;
- rastreamento e retorno operacional.

Quando API oficial não estiver disponível, importação de arquivo ou automação assistida/RPA pode ser avaliada, sempre após teste técnico.

### 1.4 Torre de Controle passou a ser gestão por exceção

O desenho evoluiu de monitoramento simples para uma fila operacional com:

- viagem prevista;
- chegada esperada e realizada;
- ETA recalculada;
- GPS/geofence;
- rotograma;
- atraso previsto;
- ocorrência;
- perda de rastreamento;
- falso alerta;
- justificativa e histórico;
- escalonamento ao gestor.

Chegar fisicamente ao destino não equivale a finalizar a operação. A descarga/evidência e as regras documentais aplicáveis precisam ser concluídas antes de liberar o recurso.

### 1.5 Frota e Manutenção passaram a compartilhar agenda

Nova necessidade consolidada: viagem planejada e manutenção não podem competir pelo mesmo veículo sem controle. Preventiva deve bloquear disponibilidade incompatível; corretiva/emergencial deve gerar impacto operacional e permitir reação rápida.

Também foram levantadas necessidades de:

- fornecedor qualificado próximo ao veículo;
- alçada de aprovação;
- decisão custo da peça × custo da parada;
- checklist;
- telemetria;
- rastreador/espelhamento;
- pneus e itens críticos como evolução a validar.

### 1.6 Evidência digital passou a ter requisitos mínimos

A evidência no aplicativo deve permitir, conforme homologação do cliente:

- foto;
- data/hora;
- GPS;
- motorista;
- veículo;
- viagem;
- localização/marca d'água ou identificador verificável;
- compartilhamento;
- evidência de descarga.

Substituição de TimeMark/WhatsApp só após aceite formal do cliente.

### 1.7 Faturamento deixou de ser “pós-processo” e virou frente de conciliação

Ao longo da semana foram detalhados cenários de Jadlog, Amazon e Mercado Livre com necessidade de rastrear:

**demanda → rota → CT-e/documento → fatura → valor reconhecido → valor recebido → divergência → residual → complemento/ajuste.**

Pagamentos parciais e divergências precisam manter o valor original do documento sem duplicação de faturamento.

### 1.8 Custos e Controladoria entraram no Blueprint

Foi levantada necessidade de apropriar combustível, manutenção, motorista e demais custos por veículo, cliente, operação/pilar e centro de custo, com metodologia final ainda dependente de decisão de Financeiro/Controladoria.

### 1.9 PGR/SM foi corrigido de “regra única” para “matriz por cliente”

O fechamento de 03/09 mostrou que PGR, SM, seguro e contas de gerenciadora variam por cliente/operação. Portanto, não deve existir parametrização genérica até consolidar:

**Cliente | Operação | Gerenciadora | Conta utilizada | Cadastro/consulta | SM | Seguro | Responsável | Retorno | Bloqueio/Exceção**

A existência de um PGR corporativo próprio da OPR não ficou comprovada nesta semana.

### 1.10 Operação está praticamente levantada; próximo foco é Faturamento

No fechamento de 03/09 foi indicado que a parte operacional estava praticamente concluída em termos de levantamento. Isso **não equivale a aceite formal**. O próximo passo informado foi sessão com Faturamento em 04/09/2026.

---

## 2. Blueprint atualizado — AS-IS consolidado

### Line Haul

- demanda predominantemente programada, com exceções/spot;
- planejamento distribui rotas fixas e identifica falta de veículo/motorista;
- contratação busca agregado/terceiro conforme região, disponibilidade, perfil e valor;
- cadastro/consulta completa documentação e liberação;
- carregamento gera os eventos para emissão e viagem;
- emissão contempla documentos aplicáveis por cliente/operação;
- Torre acompanha previsão, GPS, ETA, ocorrências e chegada;
- descarga/evidência encerra a execução e libera o veículo;
- retorno pode ser vazio ou com oportunidade de backhaul;
- faturamento/conciliação fecha o ciclo financeiro.

### Last Mile

- coleta pode ocorrer em aeroporto, cliente ou base;
- triagem e separação de volumes/rotas ainda possuem pontos manuais;
- roteirização pode depender de lista/planilha e Envoy;
- baixa de entrega deve retornar ao sistema;
- produtividade/pagamento de agregados depende das entregas validadas;
- faturamento varia por cliente e exige conciliação com operação e documentos.

---

## 3. Blueprint atualizado — TO-BE alvo

1. **Planejamento** recebe demanda e identifica modalidade, cliente, rota, perfil e janela.
2. **Disponibilidade** verifica veículo/motorista e conflitos de manutenção.
3. **Contratação** é acionada somente quando necessário e registra negociação/aceite.
4. **Cadastro/Consulta/PGR** recebe tarefa sistêmica, completa dados e retorna liberação/bloqueio.
5. **Viagem planejada** entra na agenda da operação e da Torre.
6. **Carregamento** confirma carga e gera pendências de emissão/documentação.
7. **Emissão** gera/importa documentos e os disponibiliza à operação/motorista.
8. **Torre** acompanha viagem por exceção e registra ocorrências.
9. **Chegada** é evidenciada por cliente, GPS/geofence ou motorista, conforme regra homologada.
10. **Descarga/Evidência** confirma execução e permite encerramento documental aplicável.
11. **Liberação do veículo** disponibiliza o recurso para próxima viagem/manutenção.
12. **Faturamento/Conciliação** cruza execução, documentos, fatura, recebimento, divergências e residuais.

---

## 4. Delta controlado para a RFI oficial

Os itens abaixo são **candidatos a requisito novo, complemento ou refinamento**. Não foi realizada comparação célula a célula com o arquivo `.xlsb`; portanto, cada item deve ser classificado depois como **já existente / ampliar / novo / fora do escopo**.

| Delta | Módulo sugerido | Requisito proposto | Classificação atual |
|---|---|---|---|
| RFI-D001 | TMS | Separar workflows de Line Haul e Last Mile por cliente/modalidade | A validar na RFI |
| RFI-D002 | TMS | Registrar demanda programada, spot e alteração/cancelamento de capacidade | A validar na RFI |
| RFI-D003 | TMS/Frota | Selecionar frota própria, agregado ou terceiro considerando disponibilidade e regra econômica | A validar na RFI |
| RFI-D004 | TMS/RH | Criar pré-cadastro mínimo e handoff Contratação → Cadastro/Consulta | A validar na RFI |
| RFI-D005 | TMS | Registrar viagem planejada com agenda, veículo, motorista, origem, destino e janela | A validar na RFI |
| RFI-D006 | TMS | Manter filas operacionais por responsável/status com gestão por exceção | A validar na RFI |
| RFI-D007 | TMS | Calcular/recalcular ETA com dados de rastreamento | A validar na RFI |
| RFI-D008 | TMS | Suportar rotograma com chegada/saída prevista e realizada | A validar na RFI |
| RFI-D009 | TMS | Registrar ocorrência por viagem com tipo, data/hora, localização, evidência, responsável e histórico | A validar na RFI |
| RFI-D010 | TMS | Diferenciar atraso real, falso alerta e perda de rastreamento/espelhamento | A validar na RFI |
| RFI-D011 | TMS | Finalizar viagem somente após regra de descarga/evidência, não apenas geofence | A validar na RFI |
| RFI-D012 | TMS/Emissão | Encerrar manifesto/documento conforme evento operacional homologado | A validar na RFI |
| RFI-D013 | TMS | Registrar captação, aceite, recusa, cancelamento e motivo no Mercado Livre | A validar na RFI |
| RFI-D014 | Integrações/TMS | Importar CSV e/ou integrar API do Mercado Livre, preservando contingência | A validar na RFI |
| RFI-D015 | Integrações | Permitir integração vinculada a conta/credencial técnica e segregação de permissões | A validar na RFI |
| RFI-D016 | Risco/TMS | Parametrizar PGR/SM por cliente, operação, gerenciadora e conta | A validar na RFI |
| RFI-D017 | Risco/TMS | Consultar/criar SM e, quando suportado, listar solicitações abertas | A validar na RFI |
| RFI-D018 | Frota/Oficina | Bloquear veículo em planejamento quando houver manutenção incompatível | A validar na RFI |
| RFI-D019 | Oficina | Diferenciar preventiva, corretiva e emergencial com impacto na agenda | A validar na RFI |
| RFI-D020 | Oficina/Compras | Sugerir fornecedor qualificado por localização e aplicar alçada de aprovação | A validar na RFI |
| RFI-D021 | Frota | Registrar checklist e telemetria/rastreador, incluindo falha de posicionamento | A validar na RFI |
| RFI-D022 | TMS/Mobile | Capturar foto/evidência com data/hora, GPS, motorista, veículo e viagem | A validar na RFI |
| RFI-D023 | TMS/Mobile | Suportar marca d'água/identificador verificável e compartilhamento de evidência | A validar na RFI |
| RFI-D024 | Frota/Financeiro | Registrar abastecimento e comprovante pelo aplicativo quando aplicável | A validar na RFI |
| RFI-D025 | Faturamento | Conciliar rota/CT-e/fatura/recebimento/divergência/residual | A validar na RFI |
| RFI-D026 | Faturamento | Tratar pagamento parcial e faturamento complementar sem duplicar o valor do documento | A validar na RFI |
| RFI-D027 | Faturamento | Parametrizar regras específicas de Jadlog, Amazon e Mercado Livre | A validar na RFI |
| RFI-D028 | Controladoria | Apropriar custos por veículo, cliente, operação/pilar e centro de custo | A validar na RFI |
| RFI-D029 | Controladoria | Definir tratamento de custos compartilhados e rateio com rastreabilidade | A validar na RFI |
| RFI-D030 | Corporativo/BI | Disponibilizar dashboard por perfil com viagens ativas, no prazo, em risco, atrasadas e planejadas | A validar na RFI |
| RFI-D031 | Corporativo/BI | Registrar recusas e oportunidades perdidas por causa para análise de capacidade/rentabilidade | A validar na RFI |
| RFI-D032 | Fiscal | Parametrizar regras fiscais específicas por UF/operação somente após validação Fiscal/Contábil | A validar na RFI |
| RFI-D033 | Oficina | Auditoria de pneus/itens críticos com solução tecnológica a definir | Backlog / validar necessidade |
| RFI-D034 | Corporativo/IA | Automação/assistente de IA para tarefas e análises após estabilização dos processos e dados | Evolução futura |

---

## 5. Impacto nos documentos oficiais

### Plano de Ação

Atualizar PAs existentes, sem criar duplicidades:

- PA-009 — AS-IS/Blueprint operacional;
- PA-010 — integrações;
- PA-011 — faturamento/conciliação;
- PA-014 — PGR/seguro;
- PA-016 — workflow TO-BE;
- PA-017 — solução integrada/BI;
- PA-022 — Frota × Manutenção;
- PA-023 — ocorrências/Torre;
- PA-024 — evidência digital.

### Status Report

O Status Report deve refletir a evolução do Plano e destacar:

- avanço do Blueprint operacional;
- operação praticamente levantada, ainda sem aceite formal;
- integrações como dependência crítica;
- correção da premissa PGR/SM por cliente;
- próxima frente: Faturamento;
- RFI com delta a validar, sem alterar automaticamente a contagem oficial de 880 requisitos.

### Mapa Mestre

Atualizar a fase de Blueprint/Processos como **Em andamento / validação**, não Concluída, até aceite formal. Marcar Faturamento como próxima frente de levantamento.

### POP

Reforçar procedimentos de:

- reunião → ação/requisito;
- validação antes de alterar baseline;
- evidência mínima por requisito;
- integração com contingência;
- processo manual validado antes da automação;
- mudança de status somente com evidência.

### RFI

Manter o arquivo oficial intacto até comparação e aprovação. O delta RFI-D001 a RFI-D034 deve ser reconciliado contra a planilha oficial e classificado como **já existe / ampliar / novo / backlog**.

---

## 6. Riscos atualizados

| Risco | Impacto | Tratamento |
|---|---|---|
| Automatizar processo ainda não validado | Alto | Fechar AS-IS/TO-BE e aceite antes de desenvolver automações |
| API indisponível nos sistemas de cliente | Alto | Matriz API/arquivo/RPA + contingência |
| PGR/SM parametrizado de forma genérica | Alto | Matriz por cliente/operação/gerenciadora |
| Evidência digital não aceita pelo cliente | Alto | Protótipo + homologação formal |
| Conflito viagem × manutenção | Alto | Agenda única e bloqueio de disponibilidade |
| Divergência operação × faturamento | Alto | Conciliação ponta a ponta e residual |
| RFI alterada sem baseline | Alto | Trabalhar por delta controlado e aprovação |
| Excesso de alertas/falsos positivos | Médio | Catálogo de eventos e calibração antes de automatizar notificações |

---

## 7. Próximos passos recomendados

1. Realizar workshop de Faturamento previsto para 04/09/2026.
2. Formalizar aceite do Blueprint operacional após consolidação do texto.
3. Obter documentação atualizada da BRK e integrações prioritárias.
4. Testar tecnicamente APIs/arquivos e registrar contingências.
5. Reconciliar RFI-D001 a RFI-D034 contra os 880 requisitos oficiais.
6. Submeter somente os deltas reais aos Key Users para aprovação.
7. Atualizar baseline da RFI apenas após aprovação versionada.
8. Separar claramente MVP de implantação de backlog futuro (IA, pneus avançado, automações adicionais).

---

## 8. Evidências consideradas

- Reunião OPR de 31/08/2026 — operação/faturamento e integrações.
- Reunião OPR de 02/09/2026 — planejamento, frota, manutenção, torre, evidências, custos e fiscal.
- Reunião OPR de 03/09/2026 — manhã — Line Haul/Last Mile, contratação, Mercado Livre, Torre e manutenção.
- Reunião OPR de 03/09/2026 — fechamento — integrações/PGR, evidências, manutenção, relatórios e encerramento do levantamento operacional.
- RFP OPR Rev2.0 — baseline documental de 880 requisitos.

**Status do pacote:** Em validação.  
**Responsáveis formais por cada frente:** PENDENTE DE VALIDAÇÃO onde não houver definição explícita.
