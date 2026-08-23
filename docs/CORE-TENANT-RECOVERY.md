# Recuperação controlada — Dual Clima, Madrid e OPR

## Objetivo

Recuperar e manter as três empresas-base do Portal PMO sem reativar qualquer mecanismo de reset ou baseline destrutiva.

Empresas canônicas:

- Dual Clima
- Madrid
- OPR

A rotina `scripts/repair-core-tenants.mjs` é operacional e manual. Ela não é chamada pelo build, deploy ou migrations.

## Princípios de segurança

1. Stage e Produção usam D1 distintos e são validados antes de qualquer operação.
2. A primeira execução é sempre dry-run.
3. Escrita exige `--apply` e confirmação específica do ambiente.
4. Antes da primeira alteração é gerado um export completo do D1 em `backups/`.
5. A rotina só cria registros ausentes ou corrige o nome da empresa, preservando IDs existentes.
6. Nenhum projeto, Report, arquivo, tarefa, usuário ou outro tenant é removido.
7. Quando existe um `company_id` órfão reconhecível em projetos/Reports/tabelas multitenant, esse ID é preservado ao recriar a empresa.
8. Ambiguidade aborta a operação. O alias antigo `PR` não é convertido automaticamente para OPR.

## Stage

Dry-run:

```cmd
node scripts/repair-core-tenants.mjs --env=stage
```

Aplicação, somente depois de revisar o plano exibido:

```cmd
node scripts/repair-core-tenants.mjs --env=stage --apply --confirm=REPAIR-STAGE
```

## Produção

Dry-run:

```cmd
node scripts/repair-core-tenants.mjs --env=production
```

Aplicação, somente depois de revisar o plano exibido:

```cmd
node scripts/repair-core-tenants.mjs --env=production --apply --confirm=REPAIR-PRODUCTION
```

## Interpretação do resultado

Após a aplicação, a rotina confirma que existe exatamente um cadastro resolvido para cada uma das três empresas e apresenta a contagem de projetos por `company_id`.

Se uma empresa for recuperada, mas a contagem esperada de projetos continuar ausente, isso indica que os projetos também não estão mais no D1 atual. Nesse cenário, não se deve recriar projetos de memória. A próxima etapa é localizar o backup anterior correspondente e executar uma recuperação aditiva específica dos registros originais, preservando IDs e relacionamentos.

## Governança permanente

Deploy atualiza código e estruturas compatíveis; deploy não cadastra, apaga ou restaura empresas. Dados operacionais permanecem responsabilidade do D1 de cada ambiente, com backup e procedimento explícito para qualquer recuperação.
