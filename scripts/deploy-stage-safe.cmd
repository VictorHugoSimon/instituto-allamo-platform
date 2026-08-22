@echo off
setlocal EnableExtensions

echo ============================================================
echo Instituto Allamo PMO - Deploy seguro de STAGE
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

echo [1/10] Atualizando referencia origin/develop...
git fetch origin develop || exit /b 1
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/develop') do set "REMOTE_SHA=%%R"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] Seu develop local nao esta igual ao origin/develop.
  echo Local : %LOCAL_SHA%
  echo Remoto: %REMOTE_SHA%
  echo Execute git pull origin develop e rode novamente.
  echo Este script NAO faz reset nem descarta alteracoes locais.
  exit /b 1
)

echo.
echo Estado atual do repositorio:
git status --short
echo.
echo ATENCAO: alteracoes locais serao consideradas pelo build.
echo O script nao apaga, nao restaura e nao limpa nenhum arquivo.
echo Pressione CTRL+C agora para cancelar ou qualquer tecla para continuar.
pause >nul

echo [2/10] Instalando dependencias travadas...
call npm ci || exit /b 1

echo [3/10] Gerando artefato final...
call npm run build:work || exit /b 1

echo [4/10] Validando bundle...
call npm run test:bundle || exit /b 1

echo [5/10] Validando sessao, cache e contexto...
call npm run test:session || exit /b 1
call npm run test:freshness || exit /b 1

echo [6/10] Validando multitenancy e portal publico...
call npm run test:tenant || exit /b 1
call npm run test:public || exit /b 1
call npm run test:platform || exit /b 1

echo [7/10] Validando Reports e IA...
call npm run test:report-ai || exit /b 1
call npm run test:series || exit /b 1

echo [8/10] Validando responsividade...
call npm run test:ux || exit /b 1

echo [9/10] Publicando somente no Cloudflare Pages STAGE...
call npx wrangler pages deploy public --project-name allamo-pmo-stage --branch production --commit-dirty=true || exit /b 1

echo [10/10] Concluido.
echo.
echo STAGE canonico: https://allamo-pmo-stage.pages.dev
echo Nenhuma migration foi executada.
echo Nenhum dado do D1 foi apagado.
echo Producao NAO foi alterada.
echo.
echo Homologue: login, F5, multiplas abas, empresas/projetos, Reports, anexos e link publico.
exit /b 0
