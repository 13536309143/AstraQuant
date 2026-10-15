$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pidFile = Join-Path $projectRoot 'data/server.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'No saved server process.'; exit 0 }
$serverProcessId = [int](Get-Content -LiteralPath $pidFile)
$instance = Get-CimInstance Win32_Process -Filter "ProcessId=$serverProcessId" -ErrorAction SilentlyContinue
$expectedScript = Join-Path $projectRoot 'server.mjs'
if ($instance -and $instance.Name -eq 'node.exe' -and $instance.CommandLine -match [regex]::Escape($expectedScript)) {
    Stop-Process -Id $serverProcessId
    Remove-Item -LiteralPath $pidFile
    Write-Host 'AstraQuant stopped.'
} elseif (-not $instance) {
    Remove-Item -LiteralPath $pidFile
    Write-Host 'Server was already stopped.'
} else {
    throw 'Saved PID no longer identifies this server. No process was stopped.'
}
