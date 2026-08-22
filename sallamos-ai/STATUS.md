# Sallamos AI Support — status

## CONFIRMADO
- Código-fonte navegável versionado na branch `sallamos-ai-poc`.
- PR técnico aberto em draft: `#39`.
- API Worker com chat, RAG híbrido, confidence gate, feedback, dashboard e escalonamento.
- Interface web responsiva com fallback demo controlado.
- D1/FTS5, Vectorize, R2 e Workers AI previstos no mesmo deploy.
- AI Gateway tornou-se opcional no primeiro go-live.
- Sessão demo HMAC com expiração.
- Contexto do tenant read-only e redaction de campos sensíveis.
- Migrations, seed, ingestion scripts, eval runner e provisionador idempotente.
- Sincronização automática preparada para `sallamos/SallamosAPI` (`README.md` + `swagger.yaml`).
- Demo pública em produção: https://sallamos-ai-support.vercel.app.
- CI real no GitHub Actions aprovado: TypeScript strict, JavaScript syntax, D1 migrations/FTS5 e Wrangler dry-run.
- Demais workflows do repositório também passaram no commit atual.

## BLOQUEIO EXTERNO ATUAL
O secret `CLOUDFLARE_API_TOKEN` existente no GitHub já foi testado anteriormente com `wrangler whoami` e falhou na API Cloudflare com:
- code `6003`: Invalid request headers;
- code `6111`: Invalid format for Authorization header.

Portanto o código e o pipeline estão prontos; o bloqueio restante é a rotação/correção desse token Cloudflare.

## APÓS A ROTAÇÃO DO TOKEN
O workflow `Sallamos AI POC` precisa apenas de:
- `CLOUDFLARE_API_TOKEN` válido;
- `CLOUDFLARE_ACCOUNT_ID` válido.

`SALLAMOS_SESSION_SECRET` e `ADMIN_TOKEN` são gerados no próprio job, mascarados e enviados diretamente ao Worker. Não precisam ser cadastrados manualmente no GitHub.

## PRODUÇÃO REAL
- Trocar `DEMO_MODE` para `false`.
- Integrar autenticação oficial e API interna read-only do Sallamos.
- Ingerir documentação/repositórios privados com credencial somente leitura.
- Executar evals de homologação e rollout por feature flag.
