# Deploy da POC Sallamos AI Support

A POC usa Cloudflare Workers + Static Assets, D1/FTS5, Vectorize, Workers AI e R2. AI Gateway é opcional no primeiro go-live.

## Estado de validação

O GitHub Actions já aprovou:
- TypeScript strict;
- sintaxe JavaScript;
- migrations D1/FTS5;
- `wrangler deploy --dry-run`.

## Bloqueio atual

O `CLOUDFLARE_API_TOKEN` que já existe no repositório falhou historicamente no `wrangler whoami` com Cloudflare API `6003 / 6111` (Authorization header inválido). Ele deve ser rotacionado; não reutilizar o valor atual.

## Token recomendado

Crie um **User API Token** limitado à conta correta. Como base, use o template **Edit Cloudflare Workers** e adicione as permissões necessárias ao provisionamento desta POC:

- Account Settings: Read;
- Workers Scripts: Edit;
- Workers R2 Storage: Edit;
- D1: Edit;
- Vectorize: Edit;
- Workers AI: Read;
- Workers AI: Edit;
- User Details: Read;
- Memberships: Read.

Workers Routes: Edit só é necessário quando houver rota/domínio customizado. AI Gateway Read/Edit só será necessário quando `AI_GATEWAY_ID` for configurado.

Restrinja `Account Resources` à conta usada pelo Sallamos AI.

## GitHub Actions

Depois de criar o token, substitua apenas os repository secrets:
- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`.

O workflow gera `SALLAMOS_SESSION_SECRET` e `ADMIN_TOKEN` durante o deploy, mascara os valores e grava os secrets diretamente no Worker. `REPO_READ_TOKEN` é opcional enquanto apenas fontes públicas forem ingeridas.

Depois, execute manualmente o workflow **Sallamos AI POC**. O job:
1. valida o projeto;
2. executa `wrangler whoami`;
3. cria/reutiliza D1, Vectorize e R2;
4. grava secrets do Worker;
5. aplica migrations;
6. publica Worker + Static Assets;
7. sincroniza `sallamos/SallamosAPI` (`README.md` e `swagger.yaml`).

## Execução local alternativa

```bash
npm install
npx wrangler login
npm run provision
npm run sync:sallamos-api
```

## Reindex

O cron do Worker gera embeddings pendentes. Para reindex administrativo imediato, use `/api/ai/admin/reindex` com o `ADMIN_TOKEN` vigente.

## Antes de produção real

- `DEMO_MODE=false`;
- configurar `SALLAMOS_API_BASE`;
- integrar sessão oficial do Sallamos;
- adicionar fontes privadas com token read-only;
- executar evals e homologação;
- rollout por feature flag.

Nunca commitar secrets.
