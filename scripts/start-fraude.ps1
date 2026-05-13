# Arranca el stack FRAUDE (api + worker + frontend + caddy + postgres + redis + minio).
# Frontend en :3001 por defecto (controlable con -Port).
# Uso: powershell -ExecutionPolicy Bypass -File scripts\start-fraude.ps1 [-Port 3001]
param([int]$Port = 3001)

. $PSScriptRoot\_common.ps1

Write-Section "FRAUDE - START"

if (-not (Test-Docker)) { exit 1 }
if (-not (Test-Path $FraudeRoot)) { Write-Err "No existe el proyecto en $FraudeRoot"; exit 2 }

$env:FRAUDE_FRONTEND_PORT = "$Port"
Write-Info "FRAUDE_FRONTEND_PORT=$Port"

Push-Location $FraudeRoot
try {
    Write-Info "Subiendo docker compose (proyecto fraude-stack)..."
    docker compose up -d | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Err "docker compose up fallo"; exit 3 }

    Start-Sleep -Seconds 3
    Write-Info "Estado containers:"
    docker compose ps | Out-Host
} finally {
    Pop-Location
}

Write-Section "URLs FRAUDE"
Write-Host "  Frontend    http://localhost:$Port"
Write-Host "  API         http://localhost:8000"
Write-Host "  API docs    http://localhost:8000/docs"
Write-Host "  MinIO API   http://localhost:9000"
Write-Host "  MinIO UI    http://localhost:9001"
Write-Host ""
if ((Test-Url "http://localhost:$Port" @(200,301,302,304))) { Write-Ok "Frontend responde en :$Port" }
else { Write-Warn2 "Frontend aun no responde en :$Port (puede tardar unos segundos)" }
if ((Test-Url "http://localhost:8000/health" @(200))) { Write-Ok "API healthcheck OK" }
else { Write-Warn2 "API /health aun no responde" }
