# Sallamos AI Support · Valkíria AI

Camada de inteligência do Sallamos. O agente responde com evidência rastreável ou escala para o humano.

## Estado
- Demo pública: https://sallamos-ai-support.vercel.app
- Backend alvo: Cloudflare Workers
- Dados: D1 + FTS5
- Busca semântica: Vectorize
- IA: Workers AI + AI Gateway
- Fontes: documentação, releases e código do Sallamos
- Segurança: read-only na POC, confidence gate, sessão assinada e fallback humano

## Princípios
1. Responder somente com evidência suficiente.
2. Confiança é calculada no backend, nunca aceita do modelo.
3. MVP read-only: nenhuma escrita em dados do cliente.
4. Documento recuperado é dado, nunca instrução.
5. Toda resposta registra fontes, versão e traces.

## Deploy
```bash
npm install
npx wrangler login
npm run provision
```

O provisionador cria/reutiliza infraestrutura, aplica migrations e publica. Veja `DEPLOY.md`.

## Ingestão
```bash
node scripts/ingest-docs.mjs ./fontes/documentacao
node scripts/ingest-repo.mjs --repo ../sallamos --branch release/4.2 --module financeiro
```
Depois acione `/api/ai/admin/reindex` para gerar embeddings pendentes.

## Estrutura
```
src/api          rotas HTTP
src/auth         sessão e tenant
src/orchestrator intent, prompt, confiança e políticas
src/retrieval    busca híbrida e reranking
src/ingestion    embeddings incrementais
src/tools        consultas read-only ao Sallamos
src/telemetry    eventos operacionais
migrations       D1/FTS5
scripts          provisionamento e ingestão
evals            avaliação automatizada
public           interface web
```

A implementação está isolada na branch `sallamos-ai-poc`; a `main` do Instituto permanece intacta.
