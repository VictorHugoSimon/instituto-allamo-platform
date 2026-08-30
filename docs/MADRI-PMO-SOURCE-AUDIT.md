# MADRI PMO — Auditoria de Fontes

Data da consolidação: 30/08/2026

## Regra de origem

Fluxo obrigatório desta ferramenta:

**Evidência → Plano de Ação → Visões Operacionais → Status Report**

O Plano Mestre é persistido em `work_items` com `pmo_scope=MADRI_NUCCI`. O Status Report não possui uma base paralela de ações: consulta o endpoint derivado dessa mesma fonte.

Quando uma informação não possui comprovação suficiente, são usados os valores padronizados:

- `PENDENTE DE VALIDAÇÃO`
- `A confirmar`
- `Não informado`
- `Sem evidência suficiente`

## Fontes auditadas

### Business Blueprint MADRI × Nucci ERP v1.0 — 24/08/2026

Evidências utilizadas:

- versão 1.0 é registrada como versão inicial;
- objetivo de mapear o processo atual e implantar Nucci TMS/ERP;
- módulos em escopo: TMS, Comercial/CRM, Roteirizador, Financeiro, Fiscal, Contábil, Compras, Frotas, RNC e MobiTruck;
- Nucci é responsável por cadastros/configurações conforme dados fornecidos, operacionalização, treinamento e apoio à homologação/entrada em produção;
- MADRI deve fornecer/auditar dados, disponibilizar usuários-chave/equipe e executar/documentar homologações;
- o documento ainda possui lacunas de AS IS, portanto não é tratado como Blueprint final aprovado.

### Reuniões e transcrições — 24 a 28/08/2026

#### Comercial — 24/08

- clientes, tabelas de frete, métodos comerciais e regras relacionadas;
- pendências COM01–COM06 continuam como itens a fechar.

#### Emissão — 25–26/08

- entrada XML e emissão manual;
- DHL/WB/romaneio;
- Panfarma e arquivo/rota/diária;
- CT-e, minuta e NFS-e;
- complemento, substituição e CC-e;
- autorização/impressão em lote;
- MDF-e, manifesto interno e CIOT;
- averbação, DDR e gerenciadora de risco;
- cadastros de veículos e rastreamento;
- necessidade de validação fiscal antes da parametrização definitiva.

#### Roteirização / Comprovante de Entrega — 27/08

- particularidades de Manaus e Marabá;
- rota operacional MADRI como referência;
- etiquetas e vínculo volume ↔ nota fiscal;
- Scorpions App, Comprovei e MobiTruck;
- POD, canhoto, baixa e exceções;
- parceiros da ponta final, motorista/veículo e liberação de risco;
- encerramento manual de Manifesto/MDF-e e SM;
- DHL, Panfarma e controles de receita/frete extra.

#### Faturamento / Financeiro — 28/08

- governança de acessos e risco de permissões administrativas excessivas;
- GNRE manual e operação fora de horário;
- oportunidade de integração bancária para guia, boleto, Pix/pagamento, autorização, comprovante e baixa;
- fatura baseada em documentos não faturados, com filtros e ajustes;
- regras distintas de autorização/faturamento por cliente;
- necessidade de reconciliar operação, autorização, fatura, pagamento, desconto e pendência;
- controles atuais distribuídos entre sistema, relatórios, planilhas, e-mail e comunicação operacional.

#### GED / Maranhão — 28/08

- operação descentralizada do Maranhão;
- baixas em Scorpions e Comprovei conforme operação;
- Panfarma com dedicados, transbordo, guias e controles em planilhas;
- dado operacional citado para contrato Panfarma Maranhão: 2.250 volumes por coleta/dia e R$ 5,36 por volume excedente — **requer validação contratual antes de uso externo como valor definitivo**;
- gestão documental atual baseada em digitalização, e-mail, agenda e planilhas;
- documentos regulatórios: alvarás, certificados, licenças, dedetização, limpeza de caixa d'água, AFE/AE, calibração de dataloggers, qualificação térmica de rotas/salas e validação de caixas;
- necessidade de validade, versão, responsável, alerta e vínculo do documento à base/veículo/processo;
- gaps de monitoramento térmico de veículos e controles para transporte de medicamentos;
- devoluções e emissão Panfarma ainda precisam de validação fiscal/processual.

## Divergências e pontos não consolidados

- aprovador do cliente por frente: `PENDENTE DE VALIDAÇÃO`;
- responsável técnico/desenvolvimento consolidado no RACI: `PENDENTE DE VALIDAÇÃO`;
- cronograma formal e Go-live: `A confirmar`;
- percentual de avanço: `PENDENTE DE VALIDAÇÃO` enquanto não houver baseline objetiva;
- realização da agenda SAC de 28/08: `A confirmar` por ausência de evidência suficiente na consolidação atual;
- regras fiscais de minuta/CT-e/NFS-e: exigem validação Fiscal/Contábil;
- códigos MIT: não foram encontrados códigos oficiais; a ferramenta usa **Customizações / Desenvolvimentos** e não inventa MIT.

## Isolamento

A implementação usa exclusivamente `company_id` resolvido para o tenant canônico Madrid/Madri e `pmo_scope=MADRI_NUCCI`.

Antes de publicar, o gate `validate-madri-pmo-static.mjs` procura deliberadamente referências de projetos alheios nos arquivos da ferramenta e bloqueia a release se encontrar mistura.
