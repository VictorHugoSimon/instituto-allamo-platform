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
- Ingestão de **runtime evidence** por token de serviço separado, sempre como rascunho e com sanitização recursiva.
- Gate explícito `PRODUCTION_GO_LIVE=true`.
- Gate estrutural de dataset: mínimo 20 casos reais homologados, 3 módulos e answer/clarify/escalate.
- Gate comportamental real contra STAGE: decisão, retrieval, groundedness, termos obrigatórios, escalonamento e latência.
- Backlog sanitizado de cenários candidatos, separado do dataset produtivo.
- Runbook de go-live e processo de homologação.

## ESTRATÉGIA DE CONHECIMENTO ATUAL
A release deixa de depender de POPs no Google Drive.

Prioridade de evidência:
1. contratos e respostas reais de API;
2. erros e resoluções validadas;
3. fluxos executados com sucesso no STAGE;
4. comportamento real de permissões;
5. telemetria e integrações;
6. feedback de suporte resolvido;
7. código-fonte privado quando vier a ser disponibilizado read-only.

Toda evidência entra como `rascunho`. Nenhuma observação é automaticamente tratada como regra de negócio global.

Fontes bloqueadas continuam fora de produção:
- manual Beta legado de 2023;
- repositório público/API placeholder com conteúdo Petstore.

## BLOQUEIOS REAIS PARA GO-LIVE
1. `CLOUDFLARE_API_TOKEN` válido e `CLOUDFLARE_ACCOUNT_ID` nos GitHub Environments.
2. Deploy real de STAGE e smoke verde; registrar URL em `SALLAMOS_AI_STAGE_URL`.
3. `SALLAMOS_AUTH_VALIDATE_URL` e `SALLAMOS_API_BASE` reais em produção.
4. Configurar `EVIDENCE_INGEST_TOKEN` e integrar o Sallamos/STAGE ao endpoint `/api/ai/evidence/runtime`.
5. Homologar evidências reais suficientes para responder com segurança aos módulos prioritários.
6. Converter pelo menos 20 cenários candidatos em casos `production-real` com golden answers/evidências e homologador.
7. Executar quality gate real contra STAGE e corrigir gaps até passar.
8. Testar tenant isolation, rate limit, fallback humano e rollback em STAGE.
9. Go/No-Go formal e somente então `PRODUCTION_GO_LIVE=true` + promoção para `main`.

## REGRA
Sem os itens externos/humanos acima, produção permanece intencionalmente bloqueada. O sistema não deve inventar conhecimento para contornar o gate.
