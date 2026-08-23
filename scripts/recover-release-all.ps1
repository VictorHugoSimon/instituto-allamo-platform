param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$Confirm = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Confirm -ne 'RECOVER-AND-DEPLOY') {
  Write-Host 'Execução bloqueada. Use:' -ForegroundColor Yellow
  Write-Host 'powershell -ExecutionPolicy Bypass -File <script> -RepoRoot "C:\caminho\repo" -Confirm RECOVER-AND-DEPLOY'
  exit 2
}

function Invoke-Checked {
  param([string]$File,[string[]]$Arguments)
  Write-Host ("> " + $File + " " + ($Arguments -join ' ')) -ForegroundColor DarkGray
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Falha ($LASTEXITCODE): $File $($Arguments -join ' ')" }
}

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
if (-not (Test-Path (Join-Path $RepoRoot '.git'))) { throw "Repo Git não encontrado em $RepoRoot" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$buildDir = Join-Path $env:TEMP ("allamo-core-release-" + $stamp + '-' + (Get-Random))
$backupDir = Join-Path $RepoRoot 'backups'
$logDir = Join-Path $RepoRoot 'release-logs'
New-Item -ItemType Directory -Force -Path $backupDir,$logDir | Out-Null
$logFile = Join-Path $logDir ("core-recovery-release-" + $stamp + '.log')

Start-Transcript -Path $logFile -Force | Out-Null
$worktreeCreated = $false
$insideWorktree = $false

try {
  Push-Location $RepoRoot
  Write-Host '============================================================' -ForegroundColor Cyan
  Write-Host 'INSTITUTO ÁLLAMO PMO - RECUPERAÇÃO + RELEASE COMPLETA' -ForegroundColor Cyan
  Write-Host 'Preserva a pasta local atual; opera em worktree limpo.' -ForegroundColor Cyan
  Write-Host 'Fluxo: gates -> backup/reparo Stage -> deploy/smoke -> backup/reparo Prod -> deploy/smoke.' -ForegroundColor Cyan
  Write-Host '============================================================' -ForegroundColor Cyan

  Write-Host '[1/14] Atualizando referências remotas sem tocar nos seus arquivos locais...'
  Invoke-Checked 'git' @('fetch','origin','main','develop','--prune')

  # Gate de igualdade de árvore sem capturar SHA em pipeline PowerShell.
  # git diff --quiet retorna 0 quando as árvores são equivalentes,
  # 1 quando há diferença e >1 em erro real de Git.
  Write-Host '> git diff --quiet origin/main origin/develop --' -ForegroundColor DarkGray
  & git diff --quiet origin/main origin/develop --
  $treeDiffExit = $LASTEXITCODE
  if ($treeDiffExit -eq 1) {
    throw 'main e develop não estão com a mesma árvore. Sincronize os branches antes da recuperação.'
  }
  if ($treeDiffExit -ne 0) {
    throw "Git falhou ao comparar main/develop (exit $treeDiffExit)."
  }
  Write-Host 'Gate OK: main e develop possuem a mesma árvore.' -ForegroundColor Green

  Write-Host '[2/14] Criando worktree limpo a partir de origin/main...'
  Invoke-Checked 'git' @('worktree','add','--detach',$buildDir,'origin/main')
  $worktreeCreated = $true
  Push-Location $buildDir
  $insideWorktree = $true

  Write-Host '[3/14] Instalando dependências travadas...'
  Invoke-Checked 'npm' @('ci')

  Write-Host '[4/14] Gerando artefato e executando todos os gates...'
  Invoke-Checked 'npm' @('run','build:work')
  Invoke-Checked 'npm' @('run','test:release')

  Write-Host '[5/14] Validando autenticação Wrangler local...'
  Invoke-Checked 'npx' @('wrangler@4.124.0','whoami')

  $stageBackup = Join-Path $backupDir ("backup-stage-before-core-recovery-" + $stamp + '.sql')
  Write-Host '[6/14] Backup + dry-run do D1 Stage...'
  Invoke-Checked 'npx' @('wrangler@4.124.0','d1','export','DB','--remote','--config','wrangler.stage.toml','--output',$stageBackup)
  if (-not (Test-Path $stageBackup) -or (Get-Item $stageBackup).Length -eq 0) { throw 'Backup do Stage não foi criado.' }
  Invoke-Checked 'node' @('scripts/repair-core-tenants-portable.mjs','--env=stage')

  Write-Host '[7/14] Aplicando reparo aditivo de Dual Clima, Madrid e OPR no Stage...'
  Invoke-Checked 'node' @('scripts/repair-core-tenants-portable.mjs','--env=stage','--apply','--confirm=REPAIR-STAGE')
  Invoke-Checked 'node' @('scripts/repair-core-tenants-portable.mjs','--env=stage')

  Write-Host '[8/14] Publicando exatamente o artefato validado no Stage...'
  Copy-Item -Force 'wrangler.stage.toml' 'wrangler.toml'
  Invoke-Checked 'npx' @('wrangler@4.124.0','pages','deploy','public','--project-name','allamo-pmo-stage','--branch','production','--commit-dirty=true')

  Write-Host '[9/14] Smoke test Stage: empresas, projetos e isolamento público...'
  Invoke-Checked 'node' @('scripts/smoke-core-tenants.mjs','--base=https://allamo-pmo-stage.pages.dev','--env=stage')

  $prodBackup = Join-Path $backupDir ("backup-production-before-core-recovery-" + $stamp + '.sql')
  Write-Host '[10/14] Backup + dry-run do D1 Produção...'
  Invoke-Checked 'npx' @('wrangler@4.124.0','d1','export','DB','--remote','--config','wrangler.production.toml','--output',$prodBackup)
  if (-not (Test-Path $prodBackup) -or (Get-Item $prodBackup).Length -eq 0) { throw 'Backup de Produção não foi criado.' }
  Invoke-Checked 'node' @('scripts/repair-core-tenants-portable.mjs','--env=production')

  Write-Host '[11/14] Aplicando reparo aditivo em Produção...'
  Invoke-Checked 'node' @('scripts/repair-core-tenants-portable.mjs','--env=production','--apply','--confirm=REPAIR-PRODUCTION')
  Invoke-Checked 'node' @('scripts/repair-core-tenants-portable.mjs','--env=production')

  Write-Host '[12/14] Gate final antes do deploy produtivo...'
  Invoke-Checked 'npm' @('run','test:release')

  Write-Host '[13/14] Publicando o mesmo artefato em Produção...'
  Copy-Item -Force 'wrangler.production.toml' 'wrangler.toml'
  Invoke-Checked 'npx' @('wrangler@4.124.0','pages','deploy','public','--project-name','allamo-pmo','--branch','main','--commit-dirty=true')

  Write-Host '[14/14] Smoke test Produção...'
  Invoke-Checked 'node' @('scripts/smoke-core-tenants.mjs','--base=https://allamo-pmo.pages.dev','--env=production')

  Write-Host ''
  Write-Host 'SUCESSO: Stage e Produção recuperados e validados.' -ForegroundColor Green
  Write-Host 'Empresas obrigatórias: Dual Clima, Madrid e OPR.' -ForegroundColor Green
  Write-Host "Backup Stage: $stageBackup"
  Write-Host "Backup Produção: $prodBackup"
  Write-Host "Log: $logFile"
  Write-Host 'Nenhum reset, DELETE, DROP ou migration destrutiva foi executado.'
}
catch {
  Write-Host ''
  Write-Host ('FALHA SEGURA: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'A próxima fase não foi executada. Backups já criados permanecem preservados.' -ForegroundColor Yellow
  Write-Host "Log: $logFile"
  exit 1
}
finally {
  if ($insideWorktree) { Pop-Location; $insideWorktree = $false }
  if ($worktreeCreated) {
    try { Invoke-Checked 'git' @('worktree','remove','--force',$buildDir) } catch { Write-Warning $_.Exception.Message }
    try { & git worktree prune | Out-Null } catch {}
  }
  try { Pop-Location } catch {}
  try { Stop-Transcript | Out-Null } catch {}
}
