@echo off
setlocal enabledelayedexpansion

set DBNAME=allamo-pmo-stage
set SQLFILE=ops\stage\restore-baseline-three-companies.sql

if not exist "%SQLFILE%" (
  echo ERRO: execute este comando na raiz do repositorio.
  exit /b 1
)

if not exist backups mkdir backups
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TS=%%i
set BACKUP=backups\stage-before-baseline-3-%TS%.sql

echo.
echo ============================================================
echo RESTAURACAO CONTROLADA - SOMENTE STAGE
 echo Banco: %DBNAME%
echo Baseline: Madrid ^| PR ^| Dual Clima
echo Producao NAO sera acessada por este script.
echo ============================================================
echo.

echo [1/5] Conferindo empresas atuais no Stage...
call npx wrangler d1 execute %DBNAME% --remote --command "SELECT id,name FROM companies ORDER BY name;"
if errorlevel 1 exit /b 1

echo.
echo [2/5] Criando backup do Stage antes da limpeza...
call npx wrangler d1 export %DBNAME% --remote --output="%BACKUP%"
if errorlevel 1 (
  echo ERRO: backup falhou. Nenhum dado sera removido.
  exit /b 1
)

echo Backup criado em %BACKUP%
echo.
echo Digite exatamente RESTAURAR-STAGE-3 para continuar.
set /p CONFIRM=Confirmacao: 
if /I not "%CONFIRM%"=="RESTAURAR-STAGE-3" (
  echo Operacao cancelada. Nenhum dado foi removido.
  exit /b 2
)

echo.
echo [3/5] Aplicando baseline de 3 empresas...
call npx wrangler d1 execute %DBNAME% --remote --file="%SQLFILE%"
if errorlevel 1 (
  echo ERRO: restauracao interrompida. Revise a mensagem acima.
  echo O backup permanece em %BACKUP%
  exit /b 1
)

echo.
echo [4/5] Validando empresas restantes...
call npx wrangler d1 execute %DBNAME% --remote --command "SELECT COUNT(*) AS empresas FROM companies; SELECT id,name FROM companies ORDER BY name;"
if errorlevel 1 exit /b 1

echo.
echo [5/5] Validando projetos e Reports por tenant/projeto...
call npx wrangler d1 execute %DBNAME% --remote --command "SELECT c.name AS empresa,p.id AS project_id,p.name AS projeto FROM projects p JOIN companies c ON c.id=p.company_id ORDER BY c.name,p.name; SELECT c.name AS empresa,p.name AS projeto,COUNT(r.id) AS reports FROM projects p JOIN companies c ON c.id=p.company_id LEFT JOIN report_records r ON r.company_id=c.id AND r.project_id=p.id AND r.archived_at IS NULL GROUP BY c.name,p.id,p.name ORDER BY c.name,p.name;"
if errorlevel 1 exit /b 1

echo.
echo OK: Stage restaurado para o baseline de Madrid, PR e Dual Clima.
echo Backup preservado em %BACKUP%
exit /b 0
