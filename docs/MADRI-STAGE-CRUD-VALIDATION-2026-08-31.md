# MADRI PMO — revalidação CRUD no Stage

Data: 2026-08-31

Objetivo: registrar e disparar uma nova execução do gate dedicado `MADRI PMO - Stage Schema + CRUD Smoke` após a correção de aridade dos INSERTs MADRI no artefato de homologação.

## Escopo da validação

- Ambiente: Cloudflare Pages STAGE (`allamo-pmo-stage`).
- Banco: D1 de STAGE configurado por `wrangler.stage.toml`.
- Nenhuma alteração ou promoção para Produção.
- Schema: somente operação aditiva/idempotente prevista pelo workflow.
- Smoke obrigatório: criação, leitura, atualização, mudança de status, histórico, lixeira, restauração, customização, cadência e Report do Plano MADRI.
- O workflow deve aguardar o status `allamo/stage-deploy=success` para o mesmo commit antes de executar o CRUD real.

## Critério de aceite

A homologação técnica do CRUD MADRI só é considerada concluída quando o workflow dedicado terminar com `success` no mesmo commit publicado no Stage.
