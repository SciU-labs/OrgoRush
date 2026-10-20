param([Parameter(Mandatory=$true)][string[]]$NodeArgs)
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = (Get-Command node.exe).Source
foreach ($arg in $NodeArgs) { $psi.ArgumentList.Add($arg) }
$psi.WorkingDirectory = (Get-Location).Path
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$proc = [System.Diagnostics.Process]::new()
$proc.StartInfo = $psi
$watch = [System.Diagnostics.Stopwatch]::StartNew()
[void]$proc.Start()
$outTask = $proc.StandardOutput.ReadToEndAsync()
$errTask = $proc.StandardError.ReadToEndAsync()
$timedOut = -not $proc.WaitForExit(85000)
if ($timedOut) { $proc.Kill($true) }
$proc.WaitForExit()
$watch.Stop()
$outTask.Result
$errTask.Result
Write-Output ('WALL_SECONDS: {0:F2}' -f $watch.Elapsed.TotalSeconds)
if ($timedOut) { Write-Output 'TIMEOUT: process tree killed at 85s'; exit 124 }
exit $proc.ExitCode
