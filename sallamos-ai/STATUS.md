# Sallamos AI Support — status production-ready

## CONCLUÍDO
- Arquitetura separada para STAGE e PRODUCTION.
- `develop` configurado como trilha automática de stage.
- `main` configurado como trilha automática de produção.
- Recursos isolados por ambiente: Worker, D1, Vectorize e R2.
- CI aprovado para TypeScript, JavaScript, migrations, seed, source policy e Wrangler dry-run nos dois ambientes.
- Tenant isolation aplicado em dashboards, feedback e escalonamentos.
- Autenticação externa obrigatória em produção.
- Rate limit persistente.
- Health/readiness e security headers.
- UI produtiva sem mock/fallback de resposta.
- Seed fictício removido do caminho de migrations e restrito a stage.
- Fontes não homologadas bloqueadas para produção.
- Production knowledge gate antes do deploy.
- Rollback versionado por GitHub Actions.

## STAGE
Código já integrado à branch `develop`. O workflow automático está habilitado por push/merge.

## PRODUÇÃO
PR production-ready aberto contra `main`. A promoção deve ocorrer somente após stage e credenciais externas estarem válidos.

## BLOQUEIOS EXTERNOS
1. O `CLOUDFLARE_API_TOKEN` disponível anteriormente falhou com Cloudflare 6003/6111 e precisa ser substituído por token válido.
2. É necessário informar `SALLAMOS_AUTH_VALIDATE_URL` real para produção.
3. É necessário informar `SALLAMOS_API_BASE` real para contexto read-only.
4. É necessário disponibilizar e homologar a fonte real de código/documentação Sallamos. O repositório público encontrado não é fonte de verdade utilizável.

Sem esses quatro itens, produção permanece fail-closed e não atende usuários com informação simulada.
