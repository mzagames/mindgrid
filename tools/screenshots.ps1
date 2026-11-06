# Renders 1080x1920 Play Store screenshots with headless Microsoft Edge.
# Needs the local server running (tools/serve.ps1 on port 8080).
# Usage: powershell -ExecutionPolicy Bypass -File tools/screenshots.ps1 [-Port 8080]
param([int]$Port = 8080)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }
$outDir = Join-Path $root 'store\screenshots'
New-Item -ItemType Directory -Force $outDir | Out-Null
$profile = Join-Path $env:TEMP 'mindgrid-shots-profile'
if (Test-Path $profile) { Remove-Item -Recurse -Force $profile }
$base = "http://localhost:$Port"
$common = @('--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', "--user-data-dir=$profile",
  '--window-size=540,960', '--force-device-scale-factor=2', '--virtual-time-budget=4000')

function Run($argList) {
  # Start-Process joins arguments with spaces, so quote anything containing one (e.g. "MZA Games")
  $quoted = $argList | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
  $p = Start-Process -FilePath $edge -ArgumentList $quoted -PassThru -WindowStyle Hidden
  $p.WaitForExit(60000) | Out-Null
}

Run ($common + @('--dump-dom', "$base/tools/demo-seed.html?theme=light"))
$shots = [ordered]@{
  '01-today'   = 'index.html'
  '02-crowns'  = 'play.html?type=crowns&diff=medium'
  '03-link'    = 'play.html?type=link&diff=medium'
  '04-pipes'   = 'play.html?type=pipes&diff=medium'
  '05-balance' = 'play.html?type=balance&diff=medium'
  '06-archive' = 'archive.html'
  '07-stats'   = 'stats.html'
}
foreach ($k in $shots.Keys) {
  $file = Join-Path $outDir "$k.png"
  Run ($common + @("--screenshot=$file", "$base/$($shots[$k])"))
  if (Test-Path $file) { $img = [System.Drawing.Image]::FromFile($file); Write-Host "$k.png  $($img.Width)x$($img.Height)"; $img.Dispose() }
  else { Write-Host "FAILED $k" }
}
