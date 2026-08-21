# Instituto Államo PMO

Sistema atual: Cloudflare Pages + Pages Functions em Advanced Mode (`public/_worker.js`) + Cloudflare D1.

## Ambientes
- STAGE: `allamo-pmo-stage` / branch `develop` / D1 `allamo-pmo-stage`.
- PRODUÇÃO: `allamo-pmo` / branch `main` / D1 `allamo-pmo`.

## Regras
- Não usar Supabase para o sistema atual.
- Não alterar produção diretamente durante desenvolvimento.
- Toda mudança deve ser validada em STAGE antes de promoção para `main`.
- Secrets nunca devem ser versionados.
- Novas alterações de banco devem ser versionadas em `migrations/` e aplicadas primeiro no D1 STAGE.
