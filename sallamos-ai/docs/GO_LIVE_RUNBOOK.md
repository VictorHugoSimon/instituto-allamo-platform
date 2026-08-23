# Sallamos AI / Valkíria — Runbook de Go-Live

## 1. Regra de ouro
Produção só é liberada quando **infraestrutura, conhecimento e comportamento do agente** estiverem homologados. Nenhum gate deve ser contornado para cumprir prazo.

## 2. Estratégia da primeira release
A primeira release é **runtime-evidence-first**. Não há dependência de busca de POPs no Google Drive. O conhecimento será construído a partir do comportamento real do Sallamos/STAGE, APIs, erros resolvidos, fluxos executados e feedback homologado. Código-fonte privado poderá entrar depois como fonte read-only adicional.

## 3. STAGE — configuração
No GitHub Environment `sallamos-ai-stage`, configurar:
- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `SALLAMOS_SESSION_SECRET` e `ADMIN_TOKEN` quando gerenciados externamente;
- `EVIDENCE_INGEST_TOKEN` para a integração de evidências reais;
- quando disponíveis: `SALLAMOS_API_BASE`, `SALLAMOS_AUTH_VALIDATE_URL`, `SALLAMOS_API_TOKEN`;
- `REPO_READ_TOKEN` somente quando houver repositório privado acessível e read-only.

Executar/confirmar:
1. `node scripts/preflight.mjs stage`;
2. `npx wrangler whoami`;
3. `npm run provision:stage`;
4. smoke automático `/health/live`, `/health/ready`, proteção do endpoint de evidência, sessão, overview e consulta Valkíria;
5. registrar a URL publicada como `SALLAMOS_AI_STAGE_URL` no Environment de produção.

## 4. Conhecimento por evidência real
Fluxo obrigatório:
`evento real → sanitização → rascunho → revisão humana → homologado → reindex → retrieval`.

Endpoint: `POST /api/ai/evidence/runtime`.

Prioridade recomendada:
1. requests/responses reais das APIs dos módulos prioritários;
2. erros reais com resolução confirmada;
3. fluxos completos executados com sucesso no STAGE;
4. permissões observadas por perfil;
5. integrações e telemetria relevantes;
6. casos de suporte encerrados como resolvidos;
7. código privado, quando disponibilizado, seguindo o mesmo processo de homologação.

Nunca usar ocorrência específica de cliente como regra global sem revisão. Nunca incluir segredo, token ou PII deliberadamente no payload. Ver `docs/RUNTIME_EVIDENCE.md`.

## 5. Dataset de homologação
`eval-data/candidates.jsonl` contém cenários candidatos, não respostas oficiais.

Para promover um cenário a `eval-data/dataset.jsonl`, um homologador deve preencher:
- `dataset_type: production-real`;
- `approved: true`;
- `owner`;
- `module`;
- pergunta sanitizada;
- `expect_decision` (`answer`, `clarify` ou `escalate`);
- `expected_source` para casos de resposta;
- `golden_answer` para answer/clarify;
- `must_contain` com termos mínimos nos casos `answer`;
- `evidence` com referência de homologação sem PII.

Regras mínimas: 20 casos, 3 módulos e cobertura de answer/clarify/escalate.

## 6. Quality Gate real
Antes de produção, o workflow executa contra o STAGE homologado:
- decision accuracy >= 90%;
- retrieval hit rate >= 85%;
- aderência aos termos obrigatórios >= 90%;
- groundedness = 100%;
- recall de escalonamento = 100%;
- p95 <= 12 s;
- zero erros HTTP/rede.

## 7. Integração Sallamos real
Configurar no Environment de produção:
- `SALLAMOS_AUTH_VALIDATE_URL` HTTPS;
- `SALLAMOS_API_BASE` HTTPS;
- `SALLAMOS_API_TOKEN` se exigido;
- `EVIDENCE_INGEST_TOKEN` exclusivo da integração de evidências;
- `REPO_READ_TOKEN` somente se existir fonte privada read-only.

Validar obrigatoriamente:
- sessão válida devolve usuário, tenant, perfil, permissões e versão;
- tenant A não acessa tenant B;
- indisponibilidade do auth falha fechada;
- indisponibilidade de contexto reduz confiança/escala, sem invenção;
- endpoint de runtime evidence rejeita chamada sem token;
- evidência importada fica em rascunho até homologação.

## 8. Testes de Go/No-Go
Executar no STAGE:
- login/sessão;
- 20+ evals reais;
- tenant isolation com dois tenants;
- permission gate;
- rate limit;
- pergunta sem evidência → clarificação/escalonamento;
- pergunta de alto risco → escalonamento;
- fallback humano;
- runtime evidence import → rascunho → approve/reject → reindex;
- retenção;
- rollback para versão anterior;
- `/health/ready` estável.

## 9. Promoção
Somente após os testes:
1. manter Issue de Go-Live com todas as evidências;
2. definir `PRODUCTION_GO_LIVE=true` deliberadamente;
3. revisar PR da árvore atual de `develop` para `main`;
4. production-gate revalida dataset e STAGE em tempo real;
5. deploy provisiona recursos isolados;
6. smoke produtivo exige readiness;
7. se smoke falhar, rollback e No-Go.

## 10. Rollback
Rollback do Worker não reverte automaticamente D1/R2/Vectorize. Migrations devem permanecer backward-compatible. Mudança destrutiva exige plano separado, backup e aprovação explícita.

## 11. Critério de finalização técnica
A engenharia é pronta quando os gates automatizáveis passam. Go-live só é finalizado quando credenciais externas, endpoints Sallamos, evidências homologadas, dataset real e aprovação funcional humana estiverem concluídos.
