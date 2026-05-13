# Estado consolidado de los stacks PQRS y FRAUDE.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\status-projects.ps1
. $PSScriptRoot\_common.ps1

Write-Section "Docker"
if (Test-Docker) { Write-Ok ("Docker {0}" -f (docker info --format '{{.ServerVersion}}')) }

Write-Section "PQRS"
foreach ($c in $PqrsContainers) {
    $st = Get-DockerContainerStatus $c
    switch ($st) {
        'up'      { Write-Ok    ("{0,-40} UP"      -f $c) }
        'exited'  { Write-Warn2 ("{0,-40} EXITED"  -f $c) }
        'missing' { Write-Warn2 ("{0,-40} MISSING" -f $c) }
        default   { Write-Host  ("{0,-40} {1}"     -f $c,$st) }
    }
}
$next = Get-PortOwner 3000
if ($next -and $next.Name -match 'node') { Write-Ok    ("Next.js dev en :3000 (PID {0})" -f $next.Pid) }
elseif ($next)                           { Write-Warn2 ("Puerto 3000 ocupado por {0} (PID {1})" -f $next.Name,$next.Pid) }
else                                     { Write-Warn2 "Next.js dev no esta corriendo" }

Write-Host ""
function _ok($b) { if ($b) { '(OK)' } else { '(DOWN)' } }
Write-Host ("  URL App      http://localhost:3000   {0}" -f (_ok (Test-Url 'http://localhost:3000')))
Write-Host ("  Supabase API http://localhost:54321  {0}" -f (_ok (Test-Url 'http://localhost:54321' @(200,301,302,307,404))))
Write-Host ("  Studio       http://localhost:54323  {0}" -f (_ok (Test-Url 'http://localhost:54323')))
Write-Host ("  Inbucket     http://localhost:54324  {0}" -f (_ok (Test-Url 'http://localhost:54324')))

Write-Section "FRAUDE"
foreach ($c in $FraudeContainers) {
    $st = Get-DockerContainerStatus $c
    switch ($st) {
        'up'      { Write-Ok    ("{0,-40} UP"      -f $c) }
        'exited'  { Write-Warn2 ("{0,-40} EXITED"  -f $c) }
        'missing' { Write-Warn2 ("{0,-40} MISSING" -f $c) }
        default   { Write-Host  ("{0,-40} {1}"     -f $c,$st) }
    }
}

# Detectar puerto real del frontend FRAUDE (lee de docker inspect, mas robusto).
$fraudePort = 3001
try {
    $hp = docker inspect fraude-frontend --format '{{ (index (index .NetworkSettings.Ports "80/tcp") 0).HostPort }}' 2>$null
    if ($hp -match '^\d+$') { $fraudePort = [int]$hp }
} catch {}

Write-Host ""
Write-Host ("  Frontend     http://localhost:{0}   {1}" -f $fraudePort,(_ok (Test-Url ("http://localhost:$fraudePort") @(200,301,302,304))))
Write-Host ("  API          http://localhost:8000   {0}" -f (_ok (Test-Url 'http://localhost:8000/health' @(200))))
Write-Host ("  MinIO UI     http://localhost:9001   {0}" -f (_ok (Test-Url 'http://localhost:9001' @(200,302,307))))

Write-Section "Resumen puertos"
$ports = 3000,3001,8000,9000,9001,16379,54321,54322,54323,54324
foreach ($p in $ports) {
    $o = Get-PortOwner $p
    if ($o) { Write-Host ("  {0,-6} {1,-22} PID {2}" -f $p,$o.Name,$o.Pid) }
    else    { Write-Host ("  {0,-6} libre" -f $p) }
}

exit 0
