@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "RESULT=1"
set "WORKTREE_CREATED="
set "INSIDE_WORKTREE="
set "BUILD_DIR=%TEMP%\allamo-stage-build-%RANDOM%-%RANDOM%"

echo ============================================================
echo Instituto Allamo PMO - Release segura de STAGE
echo Um build. Um gate consolidado. Um deploy.
echo Nao executa reset, DELETE, migration ou deploy de producao.
echo Config Cloudflare: wrangler.stage.toml (isolada de Producao).
echo ============================================================
echo.

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%B"
if not defined BRANCH exit /b 1
if /I not "%BRANCH%"=="develop" (
  echo [ERRO] Mude para develop antes de publicar o Stage.
  exit /b 1
)

echo [1/7] Conferindo origin/develop...
git fetch origin develop || exit /b 1
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/develop') do set "REMOTE_SHA=%%R"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] develop local difere de origin/develop.
  echo Execute: git pull --ff-only origin develop
  exit /b 1
)

echo [2/7] Criando worktree limpo da release candidata...
git worktree add --detach "%BUILD_DIR%" origin/develop || goto :fail
set "WORKTREE_CREATED=1"
pushd "%BUILD_DIR%" || goto :fail
set "INSIDE_WORKTREE=1"

echo [3/7] Instalando dependencias travadas...
call npm ci || goto :fail

echo [4/7] Gerando o unico artefato da release...
call npm run build:work || goto :fail

echo [5/7] Executando gate consolidado...
call npm run test:release || goto :fail

echo [6/7] Publicando exatamente o artefato validado no STAGE...
call npx wrangler@4.124.0 pages deploy public --config wrangler.stage.toml --project-name allamo-pmo-stage --branch production --commit-dirty=true || goto :fail

set "RESULT=0"
goto :cleanup

:fail
echo.
echo [ERRO] Release interrompida ANTES de qualquer reset ou migration.
set "RESULT=1"

:cleanup
if defined INSIDE_WORKTREE popd
if defined WORKTREE_CREATED (
  git worktree remove --force "%BUILD_DIR%" >nul 2>&1
  git worktree prune >nul 2>&1
)
if not "%RESULT%"=="0" exit /b %RESULT%

echo [7/7] STAGE publicado com sucesso.
echo Commit: %REMOTE_SHA%
echo URL: https://allamo-pmo-stage.pages.dev
echo Config: wrangler.stage.toml
echo Nenhuma migration/reset foi executado.
echo Producao nao foi alterada.
exit /b 0
