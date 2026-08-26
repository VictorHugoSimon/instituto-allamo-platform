# Integração automática de horas FCH → Portal PMO → Curva S

## Objetivo
Eliminar o apontamento manual das horas nos Status Reports. O Portal PMO deve buscar as horas registradas nos FCHs, consolidar por cliente/projeto/mês e usar o resultado na Curva S e nos KPIs de horas.

## Fonte
Prestadores considerados nesta primeira regra:
- `FCH - Victor Hugo`
- `FCH - Gabriel`

O layout das duas abas não é igual. Portanto, a integração deve localizar as colunas pelos cabeçalhos `Tempo da Atividade`, `Projeto` e `Data`, e nunca por uma letra fixa.

Exemplo observado no FCH de agosto/2026:
- Victor Hugo: `Tempo da Atividade` em D e `Projeto` em E;
- Gabriel: `Tempo da Atividade` em E e `Projeto` em F.

## Regra de horas
A duração originada de Excel/Google Sheets pode estar armazenada como fração de um dia. Exemplo: `0,1666667` = 4 horas. O normalizador converte essa duração para horas decimais antes de enviar ao Portal.

## Regra OPR / Madri
Quando o projeto de origem contiver `OPR_Madri` (ex.: `RFP OPR_Madri`), as mesmas horas devem aparecer integralmente nos dois reports:
- Report OPR: 100% das horas;
- Report Madri: 100% das horas.

Exemplo: um lançamento de 4h em `RFP OPR_Madri` gera 4h na visão OPR e 4h na visão Madri.

**Importante:** a duplicação é uma regra de alocação por report. Para uma visão global de horas do Instituto, o lançamento compartilhado deve ser contado apenas uma vez para evitar dupla contagem.

Lançamentos diretamente em `Madri ExpressLog` entram somente no report Madri. Lançamentos diretamente em `Dual Clima` entram somente no report Dual.

## Fluxo técnico
1. FCHs mensais ficam em uma pasta do Google Drive como Google Sheets.
2. O Apps Script `integrations/google-apps-script/FCH-Horas-PMO.gs` lê todos os arquivos mensais da pasta.
3. O script considera apenas as abas Victor Hugo e Gabriel, localiza colunas pelos cabeçalhos e converte duração para horas.
4. A regra de projeto transforma `RFP OPR_Madri` em duas linhas normalizadas: OPR e Madri.
5. O Apps Script publica CSV com colunas:
   - `empresa`
   - `projeto`
   - `hora`
   - `mes`
   - `consultor`
   - `projeto_origem`
   - `origem_compartilhada`
6. A URL do Web App é configurada no Cloudflare como `HORAS_CSV_URL`.
7. O backend já possui o importador `importHoras(env)`, que grava os dados em `horas_import`.
8. O endpoint `GET /api/horas` devolve os totais agregados por empresa/projeto/mês.
9. A Curva S usa esses totais mensais como série Realizada. A série Planejada continua vindo da baseline contratual do projeto.

## Curva S
A regra geral é:

- `Realizado mês` = soma das horas importadas para o projeto naquele mês;
- `Realizado acumulado` = soma progressiva dos meses;
- `Planejado mês` = baseline mensal definida no contrato/projeto;
- `Planejado acumulado` = soma progressiva do planejado;
- `% consumo contrato` = Realizado acumulado / horas totais contratadas × 100;
- `saldo` = horas totais contratadas - Realizado acumulado.

### Dual Clima
Baseline da proposta contratada:
- 38h/mês;
- mai/26 a mai/27;
- 13 meses;
- 494h planejadas.

## Validação com FCH Agosto/2026
Leitura das abas `FCH - Victor Hugo` e `FCH - Gabriel`:

### Dual Clima
- Victor Hugo: 25,00h
- Gabriel Pedroso: 8,85h
- **Total agosto: 33,85h**

### OPR
- `RFP OPR_Madri`: 11,50h
- **Total agosto para o report OPR: 11,50h**

### Madri
- horas compartilhadas `RFP OPR_Madri`: 11,50h
- lançamento direto `Madri ExpressLog`: 1,00h
- **Total agosto para o report Madri: 12,50h**

## Segurança contra erros de layout
A integração não depende das letras D/E/F porque as posições diferem entre os prestadores. O cabeçalho é detectado dinamicamente.

## Atualização automática
Sempre que um FCH da pasta for alterado, o endpoint do Apps Script passa a refletir os valores novos. O Portal pode executar sua rotina de importação em cada abertura de relatório ou por uma rotina agendada. Após a importação, a Curva S e os KPIs devem ser recalculados a partir de `/api/horas`.

## Configuração única necessária
- Criar/definir pasta Google Drive com os FCHs mensais;
- configurar `FCH_FOLDER_ID` no Apps Script;
- publicar o Apps Script como Web App;
- configurar a URL do Web App em `HORAS_CSV_URL` nos ambientes Stage e Produção.
