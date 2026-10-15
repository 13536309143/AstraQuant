$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pidFile = Join-Path $projectRoot 'data/server.pid'
$expectedScript = (Join-Path $projectRoot 'server.mjs').Replace('/', '\')
# A saved PID can be stale after a restart or an already-running launch.
# Match the complete absolute script argument before stopping any process.
$serverArgument = '(?i)(?:^|\s)"?' + [regex]::Escape($expectedScript) + '"?(?:\s|$)'
$instances = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Replace('/', '\') -match $serverArgument
})
foreach ($instance in $instances) {
    # Recheck identity immediately before Stop-Process to avoid trusting a stale PID.
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($instance.ProcessId)" -ErrorAction SilentlyContinue
    if ($current -and $current.Name -eq 'node.exe' -and $current.CommandLine -and $current.CommandLine.Replace('/', '\') -match $serverArgument) {
        Stop-Process -Id $current.ProcessId -ErrorAction Stop
        Write-Host "AstraQuant stopped (PID $($current.ProcessId))."
    }
}
$remaining = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Replace('/', '\') -match $serverArgument
})
if ($remaining.Count) { throw 'AstraQuant is still running. The saved PID was retained.' }
if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile }
if (-not $instances.Count) { Write-Host 'AstraQuant is already stopped.' }
