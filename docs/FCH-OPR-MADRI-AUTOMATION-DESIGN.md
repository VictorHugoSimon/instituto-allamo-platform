# Automação FCH → Curva S OPR / MADRI

Status: desenho técnico para implementação em branch dedicada.

## Regra de negócio

- A planilha FCH no Google Drive é somente leitura. Nenhuma célula, aba, fórmula, nome ou permissão é alterada pelo painel.
- Abas monitoradas: `FCH - Victor Hugo` e `FCH - Gabriel`.
- O importador identifica as colunas pelo texto dos cabeçalhos (`Data`, `Tempo da Atividade`, `Projeto`) e não por letras fixas, pois as abas possuem deslocamentos diferentes.
- Lançamentos cujo projeto contenha simultaneamente `OPR` e `Madri` (ex.: `RFP OPR_Madri`) são alocados integralmente em dois centros analíticos: `OPR` e `MADRI`.
- A duplicação é exclusivamente analítica: uma entrada de 4h continua sendo 4h de capacidade interna do Államo, mas aparece como 4h no report OPR e 4h no report MADRI.
- Lançamentos exclusivos de MADRI são alocados apenas em MADRI; lançamentos exclusivos de OPR, apenas em OPR.
- A origem é preservada por `source_entry_hash`, permitindo calcular capacidade sem duplicidade.

## Leitura validada do FCH Agosto/2026

- `FCH - Victor Hugo`: `Tempo da Atividade` em D e `Projeto` em E.
- `FCH - Gabriel`: `Tempo da Atividade` em E e `Projeto` em F.
- Victor possui 11,5h em `RFP OPR_Madri` no arquivo analisado (19/08, 21/08 e 24/08).
- Gabriel possui 1h em `Madri ExpressLog`; não há entrada `RFP OPR_Madri` na aba analisada.

## Arquitetura

1. GitHub Action agendado faz download read-only do arquivo via Google Drive API (`drive.readonly`).
2. Script Node lê apenas as abas configuradas e normaliza Data / Horas / Projeto.
3. O script gera alocações analíticas OPR/MADRI e envia JSON ao endpoint autenticado do Portal PMO.
4. Cloudflare Worker grava os fatos no D1 em tabela própria, sem tocar no FCH.
5. Endpoint de Curva S combina:
   - Realizado: horas FCH acumuladas por data e projeto analítico.
   - Planejado: `plan_items.horas_prev`, distribuídas linearmente em dias úteis entre início e fim quando houver baseline de plano.
6. Runtime do portal injeta a Curva S automática nos reports OPR e MADRI.

## Segurança

- Google: escopo read-only.
- Portal: ingestão protegida por `HOURS_INGEST_TOKEN`.
- O fluxo não escreve no Google Drive.
- O backend substitui somente os fatos importados da mesma fonte, preservando demais dados do PMO.

## Secrets necessários no GitHub

- Uma das opções de autenticação Google:
  - `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, ou
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
- `PANEL_HOURS_INGEST_URLS`: um ou mais endpoints, separados por vírgula (Stage e/ou Produção).
- `HOURS_INGEST_TOKEN`: segredo idêntico ao configurado no Cloudflare.

## Critério de aceite

- Alterar/adicionar horas no FCH deve refletir, após o próximo job, no realizado da Curva S sem edição manual no Portal.
- Uma entrada compartilhada OPR_Madri deve aparecer integralmente em OPR e MADRI.
- A capacidade interna não pode dobrar por causa da regra compartilhada.
- O painel deve exibir data/hora da última sincronização e a fonte utilizada.
