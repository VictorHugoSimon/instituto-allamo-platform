@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo ERRO: Node.js nao encontrado.& pause & exit /b 1)
call npm install
if errorlevel 1 goto :fail
call npx wrangler login
if errorlevel 1 goto :fail
call npm run provision
if errorlevel 1 goto :fail
echo Deploy concluido.
pause
exit /b 0
:fail
echo Deploy interrompido por erro.
pause
exit /b 1
