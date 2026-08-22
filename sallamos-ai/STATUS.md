# Sallamos AI Support — status

## CONFIRMADO
- Código-fonte navegável versionado na branch `sallamos-ai-poc`.
- API Worker com chat, RAG híbrido, confidence gate, feedback, dashboard e escalonamento.
- Interface web responsiva com fallback demo controlado.
- D1/FTS5, Vectorize, R2 e Workers AI previstos no mesmo deploy.
- Sessão demo HMAC com expiração.
- Contexto do tenant read-only e redaction de campos sensíveis.
- Migrations, seed, ingestion scripts, eval runner e provisionador idempotente.
- Demo pública disponível em https://sallamos-ai-support.vercel.app.

## BLOQUEIO EXTERNO ATUAL
- O ambiente desta automação ainda não possui credencial Cloudflare autenticada. O backend Cloudflare só pode ser publicado quando `CLOUDFLARE_API_TOKEN`/OAuth estiver acessível.

## PRODUÇÃO REAL
- Trocar `DEMO_MODE` para false.
- Integrar autenticação oficial e API interna read-only do Sallamos.
- Ingerir documentação/repositório oficiais com escopo mínimo.
- Executar evals, homologação e rollout por feature flag.
