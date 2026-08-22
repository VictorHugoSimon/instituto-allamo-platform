@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "RESULT=1"
set "WORKTREE_CREATED="
set "INSIDE_WORKTREE="
set "ROOT_DIR=%CD%"
set "BUILD_DIR=%TEMP%\allamo-production-build-%RANDOM%-%RANDOM%"
set "BACKUP_DIR=%ROOT_DIR%\backups"

if /I not "%~1"=="DEPLOY-PRODUCTION" (
  echo ============================================================
  echo RELEASE DE PRODUCAO BLOQUEADA
  echo Execute somente apos homologacao formal do Stage:
  echo scripts\deploy-production-safe.cmd DEPLOY-PRODUCTION
  echo ============================================================
  exit /b 2
)

echo ============================================================
echo Instituto Allamo PMO - Release segura de PRODUCAO
echo Branch main, build unico, gate consolidado, backup D1 e deploy.
echo Nao executa reset, DELETE ou migration.
echo ============================================================
echo.

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%B"
if not defined BRANCH exit /b 1
if /I not "%BRANCH%"=="main" (
  echo [ERRO] Producao so pode ser publicada a partir da branch main.
  exit /b 1
)

echo [1/9] Conferindo origin/main...
git fetch origin main || exit /b 1
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/main') do set "REMOTE_SHA=%%R"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] main local difere de origin/main.
  echo Execute: git pull --ff-only origin main
  exit /b 1
)

echo [2/9] Criando worktree limpo da release candidata...
git worktree add --detach "%BUILD_DIR%" origin/main || goto :fail
set "WORKTREE_CREATED=1"
pushd "%BUILD_DIR%" || goto :fail
set "INSIDE_WORKTREE=1"

echo [3/9] Instalando dependencias travadas...
call npm ci || goto :fail

echo [4/9] Gerando o unico artefato da release...
call npm run build:work || goto :fail

echo [5/9] Executando gate consolidado...
call npm run test:release || goto :fail

echo [6/9] Materializando config exclusiva de Producao...
copy /Y wrangler.production.toml wrangler.toml >nul || goto :fail
findstr /C:"allamo-pmo" wrangler.toml >nul || (
  echo [ERRO] wrangler.toml temporario nao aponta para o projeto de Producao.
  goto :fail
)

echo [7/9] Exportando backup do D1 produtivo...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%" || goto :fail
set "BACKUP_FILE=%BACKUP_DIR%\backup-production-%REMOTE_SHA%.sql"
call npx wrangler@4.124.0 d1 export DB --remote --output="%BACKUP_FILE%" || goto :fail
if not exist "%BACKUP_FILE%" (
  echo [ERRO] Backup produtivo nao foi criado. Deploy abortado.
  goto :fail
)

echo [8/9] Publicando exatamente o artefato validado em PRODUCAO...
call npx wrangler@4.124.0 pages deploy public --project-name allamo-pmo --branch main --commit-dirty=true || goto :fail

set "RESULT=0"
goto :cleanup

:fail
echo.
echo [ERRO] Release de Producao interrompida. Nenhum reset/migration foi executado.
set "RESULT=1"

:cleanup
if defined INSIDE_WORKTREE popd
if defined WORKTREE_CREATED (
  git worktree remove --force "%BUILD_DIR%" >nul 2>&1
  git worktree prune >nul 2>&1
)
if not "%RESULT%"=="0" exit /b %RESULT%

echo [9/9] PRODUCAO publicada com sucesso.
echo Commit: %REMOTE_SHA%
echo URL: https://allamo-pmo.pages.dev
echo Backup: %BACKUP_FILE%
echo Nenhuma migration/reset foi executado.
exit /b 0
