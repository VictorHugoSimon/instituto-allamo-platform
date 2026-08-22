# Release Stabilization — Portal PMO

## Objetivo
Interromper o ciclo de hotfix/deploy e tornar o STAGE previsível, preservando dados e permitindo promoção segura para Produção.

## Regra de congelamento
Enquanto esta política estiver ativa, mudanças funcionais novas não devem ser promovidas ao STAGE sem uma release candidata explícita. `develop` pode receber correções e testes, mas publicar exige o gate consolidado.

## Fluxo único de Stage
1. Consolidar correções em `develop`.
2. Criar worktree limpo a partir de `origin/develop`.
3. Executar `npm ci`.
4. Executar `npm run build:work` uma única vez.
5. Executar `npm run test:release` sobre o mesmo artefato.
6. Se qualquer gate falhar, não publicar.
7. Depois dos gates, copiar `wrangler.stage.toml` para `wrangler.toml` **somente dentro do worktree/runner temporário**.
8. Executar `wrangler pages deploy public --project-name allamo-pmo-stage --branch production`.
9. Homologar o mesmo commit no STAGE.

> Cloudflare Pages não aceita caminho customizado de `--config` no comando `pages deploy`. Por isso o arquivo dedicado é materializado temporariamente como `wrangler.toml` apenas depois dos testes. O `wrangler.toml` versionado continua sendo um guard sem D1.

## Isolamento Cloudflare Pages / D1
A plataforma usa arquivos separados por projeto:
- `wrangler.stage.toml`: projeto `allamo-pmo-stage`; produção e preview desse projeto usam exclusivamente o D1 não produtivo de Stage;
- `wrangler.production.toml`: projeto `allamo-pmo`; `env.production` usa exclusivamente o D1 produtivo e `env.preview` aponta para o D1 não produtivo;
- `wrangler.toml`: guard neutro, sem D1, impedindo seleção acidental de banco no repositório.

Stage e Produção nunca reutilizam o mesmo arquivo de configuração durante uma operação remota. A materialização acontece somente dentro de ambiente efêmero de release.

## Saneamento de dados de Stage
Saneamento de empresas **não faz parte do deploy**. O script `scripts/cleanup-stage-tenants.mjs` é uma operação manual separada.

Regras obrigatórias:
- dry-run por padrão;
- allowlist exata: `Dual Clima`, `Madrid` e `OPR`;
- se qualquer uma das três não resolver exatamente um cadastro, a operação aborta sem alterar dados;
- antes de qualquer remoção é criado backup completo do D1 de Stage em `backups/`;
- dados relacionados por `company_id`/`project_id` são removidos somente para empresas fora da allowlist;
- há pós-validação das empresas restantes;
- deploys de Stage e Produção são proibidos de chamar o saneamento automaticamente.

Comandos:
```bash
node scripts/cleanup-stage-tenants.mjs
node scripts/cleanup-stage-tenants.mjs --apply
```
O primeiro comando é somente conferência. O segundo deve ser executado apenas após validar a lista exibida pelo dry-run.

## O que não acontece mais
- deploy automático a cada push em `develop`;
- reset de D1 durante deploy;
- restauração de baseline automática;
- rebuild entre validação e publicação;
- promoção para Produção sem homologação do Stage;
- deploy Pages usando ambiente nomeado `stage`;
- `pages deploy --config <arquivo>`;
- seleção implícita do D1 por um `wrangler.toml` compartilhado;
- preview do projeto de Produção escrevendo no D1 produtivo;
- limpeza de tenants acoplada ao deploy.

## Gate consolidado
`npm run test:release` valida bundle, sessão, freshness/cache, isolamento multitenant, portal público, PWA, bootstrap live, baseline funcional, escopo de Reports, plataforma dinâmica, IA, recorrência, responsividade, isolamento de ambientes D1/Pages e segurança do saneamento manual.

## Critério de saída da estabilização
A release candidata deve permanecer estável em homologação para os fluxos críticos: login/sessão, F5/múltiplas abas, empresa → projetos → Reports, links públicos por tenant, edição de Report, anexos, Work Management, PWA e persistência de dados.

## Produção
Produção permanece bloqueada até homologação formal do Stage.

### Release local
Executar na branch `main`, sincronizada com `origin/main`:
```bat
scripts\deploy-production-safe.cmd DEPLOY-PRODUCTION
```
O script:
1. cria worktree limpo de `origin/main`;
2. instala dependências travadas;
3. gera um único artefato;
4. executa o gate consolidado;
5. materializa `wrangler.production.toml` como `wrangler.toml` somente no worktree;
6. exporta backup obrigatório do D1 produtivo para `backups/`;
7. publica exatamente o artefato validado no projeto `allamo-pmo`, branch `main`;
8. não executa reset ou migration.

### GitHub Actions
O workflow `Release PRODUCTION - Manual Gate` só roda manualmente na branch `main` com a confirmação `DEPLOY-PRODUCTION`. Ele também exige backup D1 antes do deploy e armazena o SQL como artifact.

**Observação operacional:** o workflow depende de `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` válidos nos Secrets do GitHub. Se o token do Actions estiver inválido, usar o script local autenticado até corrigir o secret; não contornar os gates.
