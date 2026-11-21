# Rebuilds the PDFs in docs/expert-testing/ from the HTML files in this folder.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File docs\expert-testing\source\build.ps1
# Uses Microsoft Edge (installed on every Windows 10/11 PC) in headless mode.

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$out = Split-Path $src -Parent

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge or Google Chrome is required.' }

$docs = [ordered]@{
  '01-database-setup-tutorial.html'  = '01 - Database Setup Tutorial.pdf'
  '02-expert-tester-profile.html'    = '02 - Expert Tester Profile Form.pdf'
  '03-expert-testing-evaluation.html' = '03 - Expert Testing Evaluation Form.pdf'
  '04-expert-assessment.html'        = '04 - Expert Assessment Form.pdf'
}

$profileDir = Join-Path $env:TEMP 'saraza-pdf-build'
foreach ($html in $docs.Keys) {
  $pdf = Join-Path $out $docs[$html]
  $url = ([Uri](Join-Path $src $html)).AbsoluteUri
  if (Test-Path $pdf) { Remove-Item $pdf }
  # Edge writes harmless warnings to stderr; keep them out of the console.
  $log = Join-Path $env:TEMP 'saraza-pdf-build.log'
  Start-Process -FilePath $edge -Wait -WindowStyle Hidden -RedirectStandardError $log -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=`"$profileDir`"",
    '--no-pdf-header-footer', "--print-to-pdf=`"$pdf`"", $url
  )
  if (-not (Test-Path $pdf)) { throw "Failed to build $pdf (see $log)" }
  Write-Host "Built $($docs[$html])"
}
