@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "RESULT=1"
set "WORKTREE_CREATED="
set "INSIDE_WORKTREE="
set "BUILD_DIR=%TEMP%\allamo-stage-build-%RANDOM%-%RANDOM%"

echo ============================================================
echo Instituto Allamo PMO - Release segura de STAGE
echo Um build. Um gate consolidado. Um deploy canonico.
echo Nao executa reset, DELETE, migration ou deploy de producao.
echo Config Cloudflare: wrangler.stage.toml materializada temporariamente.
echo Production branch do projeto Stage: develop.
echo ============================================================
echo.

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%B"
if not defined BRANCH exit /b 1
if /I not "%BRANCH%"=="develop" (
  echo [ERRO] Mude para develop antes de publicar o Stage.
  exit /b 1
)

echo [1/8] Conferindo origin/develop...
git fetch origin develop || exit /b 1
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/develop') do set "REMOTE_SHA=%%R"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] develop local difere de origin/develop.
  echo Execute: git pull --ff-only origin develop
  exit /b 1
)

echo [2/8] Criando worktree limpo da release candidata...
git worktree add --detach "%BUILD_DIR%" origin/develop || goto :fail
set "WORKTREE_CREATED=1"
pushd "%BUILD_DIR%" || goto :fail
set "INSIDE_WORKTREE=1"

echo [3/8] Instalando dependencias travadas...
call npm ci || goto :fail

echo [4/8] Gerando o unico artefato da release...
call npm run build:work || goto :fail

echo [5/8] Executando gate consolidado...
call npm run test:release || goto :fail

echo [6/8] Materializando config exclusiva e publicando o STAGE canonico...
copy /Y wrangler.stage.toml wrangler.toml >nul || goto :fail
findstr /C:"allamo-pmo-stage" wrangler.toml >nul || (
  echo [ERRO] wrangler.toml temporario nao aponta para o projeto de Stage.
  goto :fail
)
call npx wrangler@4.124.0 pages deploy public --project-name allamo-pmo-stage --branch develop --commit-hash "%REMOTE_SHA%" --commit-dirty=true || goto :fail

echo [7/8] Confirmando que allamo-pmo-stage.pages.dev recebeu este commit...
call node scripts/verify-stage-canonical-release.mjs --base=https://allamo-pmo-stage.pages.dev --sha=%REMOTE_SHA% || goto :fail

set "RESULT=0"
goto :cleanup

:fail
echo.
echo [ERRO] Release interrompida. Nenhum reset ou migration destrutiva foi executado.
set "RESULT=1"

:cleanup
if defined INSIDE_WORKTREE popd
if defined WORKTREE_CREATED (
  git worktree remove --force "%BUILD_DIR%" >nul 2>&1
  git worktree prune >nul 2>&1
)
if not "%RESULT%"=="0" exit /b %RESULT%

echo [8/8] STAGE canonico publicado e validado com sucesso.
echo Commit: %REMOTE_SHA%
echo URL: https://allamo-pmo-stage.pages.dev
echo Branch Cloudflare Pages: develop ^(production branch do projeto Stage^).
echo Config: wrangler.stage.toml materializada apenas no worktree temporario.
echo Nenhuma migration/reset destrutivo foi executado.
echo Producao nao foi alterada.
exit /b 0
