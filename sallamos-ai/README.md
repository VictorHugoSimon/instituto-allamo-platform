# Sallamos AI Support · Valkíria AI

Sistema de suporte inteligente do Sallamos. O agente responde somente com evidência rastreável ou encaminha o caso para revisão humana.

## Arquitetura de produção
- Runtime: Cloudflare Workers + Static Assets.
- Metadata/telemetria: D1 + FTS5.
- Busca semântica: Vectorize.
- IA: Workers AI; AI Gateway opcional.
- Evidências brutas: R2.
- Rate limiting: binding nativo Cloudflare por tenant+usuário; D1 apenas como fallback local.
- Autenticação: HMAC apenas em stage; validação externa Sallamos em produção.
- Segurança: tenant isolation, permission gate, rate limit, CORS restrito e fallback humano.
- Indexação incremental: cron a cada 5 minutos para embeddings pendentes.

## Ambientes
| Ambiente | Branch | Worker | D1 | Vectorize | R2 |
|---|---|---|---|---|---|
| Stage | `develop` | `sallamos-ai-stage` | `sallamos-ai-meta-stage` | `sallamos-docs-stage` | `sallamos-ai-sources-stage` |
| Produção | `main` | `sallamos-ai-production` | `sallamos-ai-meta-production` | `sallamos-docs-production` | `sallamos-ai-sources-production` |

Os recursos são fisicamente separados. Dados de stage nunca são reutilizados em produção.

## CI/CD
O workflow `.github/workflows/sallamos-ai-ci-cd.yml` executa:
1. TypeScript strict.
2. Validação de JavaScript.
3. Migrations e seed de stage em SQLite isolado.
4. Política de fontes.
5. Wrangler dry-run para stage e produção.
6. Merge/push em `develop`: deploy automático de stage.
7. Merge/push em `main`: deploy automático de produção.

Produção falha fechada se faltar autenticação externa, API Sallamos ou conhecimento homologado.

## Segurança de conhecimento
`seeds/stage.sql` existe somente para homologação. Produção não recebe seed fictício. Quando `onlyApproved=true`, fontes fora do status `homologado` são descartadas antes do reranking e nunca entram no prompt do modelo.

Uma fonte só pode entrar no índice produtivo quando estiver habilitada e homologada em `sources/sources.json`.

O repositório público `sallamos/SallamosAPI` foi bloqueado como fonte de produção porque, na validação atual, contém conteúdo/template Petstore e não representa a fonte de verdade do produto.

## Integração com Sallamos
Para produção, configurar no GitHub Environment `sallamos-ai-production`:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SALLAMOS_AUTH_VALIDATE_URL`
- `SALLAMOS_API_BASE`
- `SALLAMOS_API_TOKEN` quando a API interna exigir credencial de serviço
- `REPO_READ_TOKEN` para fontes privadas somente leitura

`SALLAMOS_SESSION_SECRET` e `ADMIN_TOKEN` podem ser cadastrados explicitamente ou são criados no primeiro provisionamento e preservados nos deploys seguintes.

## Readiness
- `/health` e `/health/live`: processo vivo.
- `/health/ready`: banco, autenticação e base homologada prontos.

Produção só fica `ready=true` quando a integração real estiver configurada e existir ao menos uma fonte homologada.

## Rollback
O workflow `Sallamos AI Rollback` reverte o Worker para uma versão Cloudflare anterior. Rollback de Worker não reverte dados de D1, R2 ou Vectorize; mudanças de schema devem ser backward-compatible.
