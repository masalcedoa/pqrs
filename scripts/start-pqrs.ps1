# Arranca el stack PQRS: Supabase local + Next.js dev en :3000.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\start-pqrs.ps1
. $PSScriptRoot\_common.ps1

Write-Section "PQRS - START"

if (-not (Test-Docker)) { exit 1 }

# 1. Liberar puerto 3000 si lo ocupa fraude-frontend u otro container.
$owner = Get-PortOwner 3000
if ($owner -and $owner.Name -notmatch 'node') {
    Write-Warn2 "Puerto 3000 ocupado por $($owner.Name). Verificando container fraude-frontend..."
    $st = Get-DockerContainerStatus 'fraude-frontend'
    if ($st -eq 'up') {
        Write-Info "Deteniendo fraude-frontend para liberar :3000"
        docker stop fraude-frontend | Out-Null
        Start-Sleep -Seconds 2
    }
}

# 2. Matar Next.js dev anterior en :3000.
Stop-NextDev 3000

# 3. Levantar Supabase local.
Push-Location $PqrsRoot
try {
    Write-Info "Iniciando Supabase local (puede tardar 30-60s la primera vez)..."
    npx supabase start | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Err "supabase start fallo (exit $LASTEXITCODE)"; exit 2 }

    Write-Info "Validando variables de entorno..."
    npm run check:env | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Err "check:env fallo"; exit 3 }

    # 4. Arrancar Next.js dev en background.
    $log = Join-Path $PqrsRoot '.next-dev.log'
    if (Test-Path $log) { Remove-Item $log -Force }
    Write-Info "Arrancando Next.js dev (log: $log)"
    $proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory $PqrsRoot -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -WindowStyle Hidden
    Write-Ok "Next.js dev PID=$($proc.Id)"

    # 5. Esperar Ready.
    $deadline = (Get-Date).AddSeconds(60)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'Ready in|ready in' -Quiet)) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { Write-Warn2 "Next.js no reporto Ready en 60s. Revisa $log" } else { Write-Ok "Next.js Ready" }
} finally {
    Pop-Location
}

Write-Section "URLs PQRS"
Write-Host "  App         http://localhost:3000"
Write-Host "  Login       http://localhost:3000/login"
Write-Host "  Radicar     http://localhost:3000/radicar"
Write-Host "  Dashboard   http://localhost:3000/dashboard"
Write-Host "  Supabase    http://localhost:54321"
Write-Host "  Studio      http://localhost:54323"
Write-Host "  Inbucket    http://localhost:54324"
Write-Host ""
Write-Host "  Admin user: admin@pqrs.local / PQRS-Admin-2026!"
