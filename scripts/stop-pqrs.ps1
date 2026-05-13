# Detiene el stack PQRS: Next.js dev (:3000) + Supabase local.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\stop-pqrs.ps1
. $PSScriptRoot\_common.ps1

Write-Section "PQRS - STOP"

Stop-NextDev 3000

Push-Location $PqrsRoot
try {
    if (Test-Docker) {
        Write-Info "Deteniendo Supabase local..."
        npx supabase stop | Out-Host
    }
} finally {
    Pop-Location
}

Write-Section "Verificacion"
$still = Get-PortOwner 3000
if ($still) { Write-Warn2 "Puerto 3000 sigue ocupado por $($still.Name) (PID $($still.Pid))" }
else        { Write-Ok    "Puerto 3000 libre" }

$running = docker ps --filter "name=supabase_" --format '{{.Names}}' 2>$null
if ($running) { Write-Warn2 "Containers Supabase aun arriba:`n$running" } else { Write-Ok "Containers Supabase detenidos" }
