# Sallamos AI Support — status de finalização

## ENGENHARIA CONCLUÍDA
- Ambientes STAGE e PRODUCTION isolados em Worker, D1, Vectorize e R2.
- CI/CD por `develop` e `main`.
- TypeScript strict, JavaScript syntax, migrations, seed policy, source policy e Wrangler dry-run.
- Tenant isolation, permission gate e autenticação externa fail-closed em produção.
- Rate limiting por tenant+usuário.
- RAG híbrido e bloqueio de fontes não homologadas antes do prompt.
- Smoke pós-deploy e health/readiness.
- Rollback versionado.
- Redaction/minimização, telemetria crítica e retenção automática.
- Importação segura de conhecimento como rascunho, aprovação/rejeição humana e auditoria.
- Gate explícito `PRODUCTION_GO_LIVE=true`.
- Gate estrutural de dataset: mínimo 20 casos reais homologados, 3 módulos e answer/clarify/escalate.
- Gate comportamental real contra STAGE: decisão, retrieval, groundedness, termos obrigatórios, escalonamento e latência.
- Backlog sanitizado de 32 cenários candidatos, separado do dataset produtivo.
- Matriz pública-safe de fontes candidatas.
- Runbook de go-live e processo de homologação.

## ESTRATÉGIA DE CONHECIMENTO
A primeira release está formalmente definida como **document-first** até o código-fonte atual do Sallamos ser disponibilizado em uma fonte acessível e read-only.

Fontes candidatas localizadas:
- mapa funcional amplo atualizado em 2025;
- evidência de POPs financeiros e cadastros sendo elaborados/revisados em agosto de 2026;
- evidências recentes de Open Finance/OFX, conciliação, saldo bancário e suporte.

Fontes bloqueadas:
- manual Beta legado de 2023;
- repositório público/API placeholder com conteúdo Petstore.

Nenhuma fonte candidata é automaticamente homologada.

## BLOQUEIOS REAIS PARA GO-LIVE
1. `CLOUDFLARE_API_TOKEN` válido e `CLOUDFLARE_ACCOUNT_ID` nos GitHub Environments.
2. Deploy real de STAGE e smoke verde; registrar URL em `SALLAMOS_AI_STAGE_URL`.
3. `SALLAMOS_AUTH_VALIDATE_URL` e `SALLAMOS_API_BASE` reais em produção.
4. Owner funcional localizar/aprovar a versão vigente dos POPs e demais fontes candidatas.
5. Converter pelo menos 20 cenários candidatos em casos `production-real` com golden answers/evidências e homologador.
6. Executar quality gate real contra STAGE e corrigir gaps até passar.
7. Testar tenant isolation, rate limit, fallback humano e rollback em STAGE.
8. Go/No-Go formal e somente então `PRODUCTION_GO_LIVE=true` + promoção para `main`.

## REGRA
Sem os itens externos/humanos acima, produção permanece intencionalmente bloqueada. O sistema não deve responder com conhecimento simulado para contornar o gate.
