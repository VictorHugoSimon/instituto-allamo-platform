# Sallamos AI Support · Valkíria AI

POC da camada de inteligência do Sallamos.

## Estado

- Frontend público: https://sallamos-ai-support.vercel.app
- Backend-alvo: Cloudflare Workers
- Dados: D1 + FTS5
- Busca semântica: Vectorize
- IA: Workers AI + AI Gateway
- Fontes: documentação, releases e código do Sallamos
- Segurança: read-only na POC, confidence gate e escalonamento humano

## Branch

Esta implementação está isolada em `sallamos-ai-poc`. A `main` do Instituto não é alterada por esta POC.

## Provisionamento Cloudflare

O pacote executável validado contém `scripts/provision.mjs`, que cria/reutiliza D1, Vectorize e R2, gera secrets, aplica migrations e publica o Worker.

O único pré-requisito externo é uma credencial/autorização Cloudflare válida (`wrangler login` ou API token). Nenhum secret deve ser commitado no Git.

## Fonte Sallamos

A ingestão foi preparada para trabalhar em modo leitura. O repositório público `sallamos/SallamosAPI` pode ser usado como fonte inicial de API/documentação; código e documentação privados devem ser conectados somente com token read-only.
