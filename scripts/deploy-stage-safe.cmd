@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "RESULT=1"
set "WORKTREE_CREATED="
set "INSIDE_WORKTREE="
set "BUILD_DIR=%TEMP%\allamo-stage-build-%RANDOM%-%RANDOM%"

echo ============================================================
echo Instituto Allamo PMO - Deploy seguro de STAGE
echo Build isolado em worktree limpo de origin/develop.
echo Nao executa reset, DELETE, migration ou deploy de producao.
echo ============================================================
echo.

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%B"
if not defined BRANCH (
  echo [ERRO] Execute este arquivo dentro do repositorio Git.
  exit /b 1
)
if /I not "%BRANCH%"=="develop" (
  echo [ERRO] Branch atual: %BRANCH%
  echo Mude para develop antes de publicar o Stage.
  exit /b 1
)

echo [1/11] Atualizando referencia origin/develop...
git fetch origin develop || exit /b 1
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/develop') do set "REMOTE_SHA=%%R"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] Seu develop local nao esta igual ao origin/develop.
  echo Local : %LOCAL_SHA%
  echo Remoto: %REMOTE_SHA%
  echo Execute git pull --ff-only origin develop e rode novamente.
  echo Este script NAO faz reset nem descarta alteracoes locais.
  exit /b 1
)

echo.
echo Estado do repositorio principal - somente informativo:
git status --short
echo.
echo IMPORTANTE:
echo - Alteracoes locais NAO entram mais no build de Stage.
echo - public/index.html, public/_worker.js e public/sw.js locais permanecem intactos.
echo - .wrangler, backups e HTMLs locais permanecem intactos.
echo - O build sera feito em: %BUILD_DIR%
echo.

echo [2/11] Criando worktree temporario limpo...
git worktree add --detach "%BUILD_DIR%" origin/develop || goto :fail
set "WORKTREE_CREATED=1"
pushd "%BUILD_DIR%" || goto :fail
set "INSIDE_WORKTREE=1"

echo [3/11] Instalando dependencias travadas no worktree...
call npm ci || goto :fail

echo [4/11] Gerando artefato final limpo...
call npm run build:work || goto :fail

echo [5/11] Validando bundle...
call npm run test:bundle || goto :fail

echo [6/11] Validando sessao, cache e contexto...
call npm run test:session || goto :fail
call npm run test:freshness || goto :fail

echo [7/11] Validando multitenancy e portal publico...
call npm run test:tenant || goto :fail
call npm run test:public || goto :fail
call npm run test:platform || goto :fail

echo [8/11] Validando Reports e IA...
call npm run test:report-ai || goto :fail
call npm run test:series || goto :fail

echo [9/11] Validando responsividade...
call npm run test:ux || goto :fail

echo [10/11] Publicando somente no Cloudflare Pages STAGE...
call npx wrangler pages deploy public --project-name allamo-pmo-stage --branch production --commit-dirty=true || goto :fail

set "RESULT=0"
goto :cleanup

:fail
echo.
echo [ERRO] O deploy de Stage foi interrompido.
echo Nenhum reset, migration ou deploy de producao foi executado por este script.
set "RESULT=1"

:cleanup
if defined INSIDE_WORKTREE (
  popd
  set "INSIDE_WORKTREE="
)
if defined WORKTREE_CREATED (
  echo.
  echo Removendo somente o worktree temporario criado por este deploy...
  git worktree remove --force "%BUILD_DIR%" >nul 2>&1
  git worktree prune >nul 2>&1
)

if not "%RESULT%"=="0" exit /b %RESULT%

echo [11/11] Concluido.
echo.
echo STAGE canonico: https://allamo-pmo-stage.pages.dev
echo Build executado a partir de origin/develop: %REMOTE_SHA%
echo Nenhuma migration foi executada.
echo Nenhum dado do D1 foi apagado.
echo Producao NAO foi alterada.
echo Arquivos locais do repositorio principal NAO foram usados nem descartados.
echo.
echo Homologue: login, F5, multiplas abas, empresas/projetos, Reports, anexos e link publico.
exit /b 0
