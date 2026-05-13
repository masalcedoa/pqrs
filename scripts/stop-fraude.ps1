# Detiene el stack FRAUDE. Conserva volumenes y datos.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\stop-fraude.ps1
. $PSScriptRoot\_common.ps1

Write-Section "FRAUDE - STOP"

if (-not (Test-Docker)) { exit 1 }
if (-not (Test-Path $FraudeRoot)) { Write-Err "No existe $FraudeRoot"; exit 2 }

Push-Location $FraudeRoot
try {
    Write-Info "Bajando docker compose (sin tocar volumenes ni imagenes)..."
    docker compose stop | Out-Host
} finally {
    Pop-Location
}

Write-Section "Verificacion"
$running = docker ps --filter "name=fraude-" --format '{{.Names}}' 2>$null
if ($running) { Write-Warn2 "Containers FRAUDE aun arriba:`n$running" } else { Write-Ok "Containers FRAUDE detenidos" }
