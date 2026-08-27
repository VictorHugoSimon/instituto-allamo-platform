# Runbook Operacional — Portal PMO Instituto Államo

## Objetivo

Manter Stage e Produção disponíveis, persistentes, isolados por tenant e com processo de release verificável. Deploy nunca é sinônimo de reset de dados.

## Ambientes oficiais

- Stage: `https://allamo-pmo-stage.pages.dev`
- Produção: `https://allamo-pmo.pages.dev`
- Branch de Stage: `develop`
- Branch de Produção: `main`

## Release

### Stage

O workflow `Release STAGE - Auto + Manual Gate` executa build único, gate consolidado, autenticação Cloudflare, backup obrigatório do D1, schema apenas aditivo, reparo idempotente dos tenants essenciais, deploy canônico, fingerprint da release e smokes pós-deploy.

### Produção

Produção somente deve receber o artefato após Stage homologado e promoção por PR para `main`. Antes de alterações estruturais no D1, manter backup obrigatório e migração somente aditiva/revisada.

## Saúde operacional

O workflow `Operational Health - Stage + Production` executa a cada 2 horas e é estritamente read-only. Ele valida:

- `/release.json` e fingerprint da release;
- `/api/companies`;
- `/api/projects`;
- ausência de projetos órfãos de empresa;
- links públicos isolados de Dual Clima, Madrid e OPR;
- no Stage, `/api/stage-health`, persistência ativa e reset desabilitado.

Em falha, uma única issue `[OPS] Saúde operacional indisponível` é aberta/atualizada. Quando o ambiente se recupera, o workflow registra a recuperação e fecha a issue.

## FCH → Curva S

Existe uma única rotina agendada oficial: `FCH Sync Oficial - Curva S`.

As rotinas históricas `FCH Hours Sync - OPR e MADRI` e `Sync FCH Hours to PMO` ficam apenas em modo manual, sem escrita, para evitar concorrência, dupla carga e três falhas horárias simultâneas.

A fonte oficial é o Google Drive em escopo `drive.readonly`. O arquivo atual é identificado por `FCH_FILE_ID`; `FCH_FOLDER_ID` pode ser configurado posteriormente para entrada automática dos meses seguintes.

### Credencial Google obrigatória

Preferência operacional: criar uma Service Account exclusiva para a automação FCH e conceder acesso somente ao arquivo/pasta FCH. No GitHub Actions, cadastrar o JSON completo como secret:

`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`

Alternativa suportada: OAuth read-only com os três secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REFRESH_TOKEN`.

A rotina possui preflight: sem uma dessas credenciais, ela para antes de qualquer escrita no Stage ou em Produção e informa explicitamente o bloqueio.

Nunca tornar a planilha FCH pública apenas para contornar autenticação e nunca versionar o arquivo `.xlsx` no repositório.

## Segurança e dados

- Não executar `npm audit fix --force`.
- Não versionar `.wrangler/`, backups D1, credenciais ou planilhas operacionais.
- Não usar `DELETE`, `DROP`, `TRUNCATE` ou reset automático em deploy.
- Alterações de banco devem ser aditivas e idempotentes quando possível.
- Produção deve preservar dados já cadastrados.
- Links públicos precisam permanecer isolados por empresa/projeto.

## Gate para considerar 100% operacional

1. Stage release verde e smoke pós-deploy aprovado.
2. Produção release verde e monitor operacional aprovado.
3. FCH oficial com credencial read-only configurada e uma execução completa bem-sucedida.
4. Nenhuma rotina FCH legada agendada.
5. Backups de D1 e política de persistência ativos.
6. Nenhum alerta operacional aberto.
7. `main` protegida contra push direto/force push e com PR/checks obrigatórios — configuração de governança do GitHub a ser mantida no repositório.

## Resposta a incidentes

1. Não executar reset nem limpeza de D1.
2. Confirmar se a falha é de código, integração, credencial ou disponibilidade externa.
3. Verificar o workflow de release/saúde correspondente.
4. Preservar backup antes de qualquer intervenção no banco.
5. Corrigir primeiro em `develop` e homologar no Stage.
6. Promover para `main` somente após gates verdes.
7. Registrar causa, impacto, correção e prevenção na issue/registro de incidente.
