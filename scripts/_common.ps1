# Funciones compartidas para los scripts de orquestacion PQRS / FRAUDE.
# Importar con:  . $PSScriptRoot\_common.ps1
# ASCII puro: PowerShell 5.1 lee .ps1 sin BOM como cp1252 y rompe acentos / em-dashes.

$ErrorActionPreference = 'Stop'

$global:PqrsRoot   = 'C:\Users\msalcedo\Documents\sss\projects\05-PQRS'
$global:FraudeRoot = 'C:\Users\msalcedo\Documents\sss\projects\01-gestion-perdidas\fraud-automation-pipeline\reper-tool-v2'

$global:PqrsContainers   = @('supabase_db_pqrs-energia','supabase_studio_pqrs-energia','supabase_pg_meta_pqrs-energia','supabase_storage_pqrs-energia','supabase_rest_pqrs-energia','supabase_realtime_pqrs-energia','supabase_inbucket_pqrs-energia','supabase_auth_pqrs-energia','supabase_kong_pqrs-energia')
$global:FraudeContainers = @('fraude-postgres','fraude-redis','fraude-minio','fraude-api','fraude-worker','fraude-frontend','fraude-caddy')

function Write-Info($msg)   { Write-Host "[INFO ] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)     { Write-Host "[OK   ] $msg" -ForegroundColor Green }
function Write-Warn2($msg)  { Write-Host "[WARN ] $msg" -ForegroundColor Yellow }
function Write-Err($msg)    { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Section($t)  { Write-Host "`n==== $t ====" -ForegroundColor Magenta }

function Test-Docker {
    try { docker info --format '{{.ServerVersion}}' | Out-Null; return $true }
    catch { Write-Err "Docker Desktop no responde. Abrelo y reintenta."; return $false }
}

function Test-PortListening($port) {
    try {
        $tnc = Test-NetConnection -ComputerName '127.0.0.1' -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
        return [bool]$tnc
    } catch { return $false }
}

function Get-PortOwner($port) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) {
        if (Test-PortListening $port) {
            return [pscustomobject]@{ Port = $port; Pid = 0; Name = 'docker/wsl-relay'; Path = '' }
        }
        return $null
    }
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    return [pscustomobject]@{ Port = $port; Pid = $c.OwningProcess; Name = $p.ProcessName; Path = $p.Path }
}

function Stop-NextDev($port) {
    $owner = Get-PortOwner $port
    if (-not $owner) { return }
    if ($owner.Name -match 'node') {
        Write-Warn2 "Matando Next.js dev en :$port (PID $($owner.Pid))"
        try { Stop-Process -Id $owner.Pid -Force -ErrorAction Stop } catch {}
    } else {
        Write-Warn2 "Puerto $port ocupado por $($owner.Name) (PID $($owner.Pid)) - no se mata automaticamente"
    }
}

function Test-Url($url, $okCodes = @(200,301,302,307)) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop
        return ($okCodes -contains [int]$r.StatusCode)
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -and ($okCodes -contains [int]$code)) { return $true }
        return $false
    }
}

function Get-DockerContainerStatus($name) {
    $filter = 'name=^' + $name + '$'
    $s = docker ps -a --filter $filter --format '{{.Status}}' 2>$null
    if (-not $s) { return 'missing' }
    if ($s -match '^Up')     { return 'up' }
    if ($s -match '^Exited') { return 'exited' }
    return $s
}
