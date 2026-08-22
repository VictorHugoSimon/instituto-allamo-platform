# Isolamento D1 — Stage x Produção

## Bancos oficiais

- Stage: `allamo-pmo-stage` — `72e2f6a0-3d22-4d65-a820-4a9b9ea88321`
- Produção: `allamo-pmo` — `361c63ba-b9f8-409d-9a46-9609914da8b7`

## Regra de segurança

Stage e Produção nunca podem compartilhar o mesmo `database_id`.

Operações D1 remotas devem declarar o ambiente explicitamente:

```bash
npx wrangler d1 execute DB --env stage --remote --command="SELECT 1"
npx wrangler d1 execute DB --env production --remote --command="SELECT 1"
```

Para exportação:

```bash
npx wrangler d1 export DB --env stage --remote --output=backups/stage.sql
npx wrangler d1 export DB --env production --remote --output=backups/production.sql
```

## Operações destrutivas ou restauração

Antes de executar qualquer limpeza/restauração:

1. confirmar o nome e o UUID do banco;
2. criar backup antes da alteração;
3. exigir confirmação textual específica do ambiente;
4. nunca utilizar `--env production` para Stage;
5. nunca depender apenas do nome do binding `DB` sem conferir o ambiente;
6. validar a lista de empresas/projetos que serão preservados antes de qualquer `DELETE`.

Os bindings de runtime do Cloudflare Pages também devem permanecer separados no Dashboard de cada projeto (`allamo-pmo-stage` e `allamo-pmo`).
