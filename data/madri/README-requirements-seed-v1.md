# MADRI — Seed de requisitos v1

Pacote de carga controlada para o **D1 Stage** da governança MADRI × NUCCI.

## Conteúdo

- 71 requisitos reconstruídos na matriz de auditoria RFI × Blueprint;
- 15 requisitos novos identificados após RFI/workshops;
- total: 86 requisitos.

Fonte: `Matriz_Auditoria_RFI_x_Blueprint_MADRI_v1.xlsx`.

## Ressalva documental obrigatória

A RFI final standalone efetivamente enviada aos fornecedores ainda não foi localizada. Os 71 requisitos foram reconstruídos a partir da auditoria existente e de suas fontes de apoio. Quando a RFI final for localizada, a reconciliação deverá ser feita linha a linha. O seed não deve ser tratado como substituto documental da RFI original.

## Segurança de carga

A carga é **somente Stage**. `scripts/seed-madri-requirements-stage.mjs` não oferece modo Production e exige a confirmação `SEED-MADRI-REQ-STAGE` para escrita. A operação usa `INSERT OR IGNORE`: registros existentes não são sobrescritos. Antes da carga, o workflow gera backup do D1 Stage e o retém como artefato.

O arquivo `requirements-seed-v1.json.gz.b64` é apenas uma representação comprimida do JSON de origem para manter o repositório compacto. O script valida quantidade, IDs, composição 71+15, enums e padrões de segredo antes de acessar o banco.
