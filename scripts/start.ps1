param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$nodeMajor = [int]((& $nodeExe --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) { throw 'Node.js 24 or newer is required.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env'))) { throw 'Missing .env. Copy .env.example and configure the API key first.' }
$envFile = Join-Path $projectRoot '.env'
$configuredPort = (& $nodeExe "--env-file=$envFile" -p 'Number(process.env.PORT)||8787').Trim()
$serviceUrl = "http://127.0.0.1:$configuredPort"
try {
    $health = Invoke-RestMethod "$serviceUrl/api/health" -TimeoutSec 2
    if ($health.version -eq '1.0.0') {
        Write-Host "AstraQuant is already running: $serviceUrl"
        if (-not $NoBrowser) { Start-Process $serviceUrl }
        exit 0
    }
} catch {}
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'logs'),(Join-Path $projectRoot 'data') | Out-Null
$arguments = '--env-file="' + (Join-Path $projectRoot '.env') + '" "' + (Join-Path $projectRoot 'server.mjs') + '"'
$process = Start-Process -FilePath $nodeExe -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'logs/server.log') -RedirectStandardError (Join-Path $projectRoot 'logs/server-error.log')
Set-Content -LiteralPath (Join-Path $projectRoot 'data/server.pid') -Value $process.Id -Encoding ascii
for ($attempt=0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod "$serviceUrl/api/health" -TimeoutSec 2
        if ($health.ok) {
            Write-Host "AstraQuant started: $serviceUrl"
            if (-not $NoBrowser) { Start-Process $serviceUrl }
            exit 0
        }
    } catch {}
    if ($process.HasExited) { throw "Server stopped. See $projectRoot\logs\server-error.log" }
}
throw "Server did not become ready. See $projectRoot\logs\server-error.log"
