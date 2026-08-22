# Sallamos AI / Valkíria — Runbook de Go-Live

## 1. Regra de ouro
Produção só é liberada quando **infraestrutura, conhecimento e comportamento do agente** estiverem homologados. Nenhum gate deve ser contornado para cumprir prazo.

## 2. Estratégia da primeira release
A primeira release é **document-first**. O código-fonte atual do Sallamos ainda não foi localizado nas integrações acessíveis. Quando for disponibilizado, entra como nova fonte read-only e segue o mesmo fluxo de homologação.

## 3. STAGE — configuração
No GitHub Environment `sallamos-ai-stage`, configurar:
- `CLOUDFLARE_API_TOKEN` — token válido, menor privilégio, com permissões suficientes para os recursos usados pelo Worker/D1/Vectorize/R2;
- `CLOUDFLARE_ACCOUNT_ID`;
- `SALLAMOS_SESSION_SECRET` e `ADMIN_TOKEN` quando a equipe quiser gerenciá-los externamente; o provisionador preserva secrets existentes;
- opcionais enquanto a integração real não estiver pronta: `SALLAMOS_API_BASE`, `SALLAMOS_AUTH_VALIDATE_URL`, `SALLAMOS_API_TOKEN`, `REPO_READ_TOKEN`;
- variável `SYNC_KNOWLEDGE=false` até existir fonte automatizada validada.

Executar/confirmar:
1. `node scripts/preflight.mjs stage`;
2. `npx wrangler whoami`;
3. `npm run provision:stage`;
4. smoke automático `/health/live`, `/health/ready`, sessão controlada, overview e consulta Valkíria;
5. registrar a URL publicada como `SALLAMOS_AI_STAGE_URL` no Environment de produção.

## 4. Conhecimento
Fluxo obrigatório:
`fonte interna → sanitização → rascunho → revisão humana → homologado → reindex → retrieval`.

Prioridade recomendada:
1. localizar/exportar a versão aprovada dos POPs financeiros 2026;
2. homologar o mapa funcional de processos somente para capacidades ainda vigentes;
3. localizar/exportar POPs de clientes/parceiros/produtos;
4. documentar Open Finance/OFX a partir da versão homologada atual;
5. manter manual Beta legado e API Petstore fora de produção.

Nunca enviar documento interno diretamente para o repositório público. Usar o endpoint administrativo de importação, que sanitiza e grava em D1/R2 como rascunho.

## 5. Dataset de homologação
`eval-data/candidates.jsonl` contém cenários **candidatos**, não respostas oficiais.

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

O resultado é salvo como artifact `sallamos-ai-production-eval`.

## 7. Integração Sallamos real
Configurar no Environment de produção:
- `SALLAMOS_AUTH_VALIDATE_URL` HTTPS;
- `SALLAMOS_API_BASE` HTTPS;
- `SALLAMOS_API_TOKEN` se o contrato exigir;
- `REPO_READ_TOKEN` somente quando houver fonte de código privada e sempre read-only.

Validar obrigatoriamente:
- sessão válida devolve usuário, tenant, perfil, permissões e versão;
- sessão de tenant A não acessa tenant B;
- indisponibilidade do auth falha fechada;
- indisponibilidade de contexto reduz confiança/escala, sem invenção;
- endpoints read-only não retornam PII bloqueada.

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
- admin knowledge import/approve/reject;
- retenção;
- rollback para versão anterior;
- `/health/ready` estável.

## 9. Promoção
Somente após os testes:
1. manter Issue de Go-Live com todas as evidências;
2. definir `PRODUCTION_GO_LIVE=true` deliberadamente;
3. abrir/revisar PR da árvore atual de `develop` para `main`;
4. production-gate revalida dataset e STAGE em tempo real;
5. deploy provisiona recursos isolados;
6. smoke produtivo exige readiness;
7. se smoke falhar, executar rollback e reabrir gate.

## 10. Rollback
Rollback do Worker não reverte automaticamente D1/R2/Vectorize. Migrations devem permanecer backward-compatible. Mudança destrutiva de schema/dados exige plano separado, backup e aprovação explícita.

## 11. Critério de finalização técnica
A engenharia é considerada pronta quando todos os gates automatizáveis existem e passam. Go-live só é considerado finalizado quando credenciais externas, endpoints Sallamos, fontes homologadas e aprovação funcional humana também estiverem concluídos.
