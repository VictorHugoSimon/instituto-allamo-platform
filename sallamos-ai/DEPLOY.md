# Deploy da POC Sallamos AI Support

A POC usa Cloudflare Workers + Static Assets, D1/FTS5, Vectorize, Workers AI/AI Gateway e R2.

## Execução local assistida

```bash
npm install
npx wrangler login
npm run provision
```

O provisionador é idempotente: cria ou reutiliza D1, Vectorize e R2, preserva secrets já existentes, aplica migrations e publica o Worker.

Depois do primeiro deploy, gere embeddings pendentes:

```bash
curl -X POST https://SEU-WORKER.workers.dev/api/ai/admin/reindex \
  -H "authorization: Bearer SEU_ADMIN_TOKEN"
```

## GitHub Actions

A branch `sallamos-ai-poc` executa validação automática a cada push. O deploy Cloudflare é manual (`workflow_dispatch`) e requer secrets no GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SALLAMOS_SESSION_SECRET` e `ADMIN_TOKEN`. `REPO_READ_TOKEN` é opcional enquanto a ingestão usar somente fontes públicas.

Nunca commitar secrets. Antes de produção real, usar `DEMO_MODE=false`, configurar `SALLAMOS_API_BASE`, integrar a sessão oficial do Sallamos, ingerir fontes homologadas e executar evals.
