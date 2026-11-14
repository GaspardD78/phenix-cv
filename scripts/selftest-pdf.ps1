# Lance l'application construite en mode auto-test : génère tests/pdf-selftest/cv.html en PDF avec la
# méthode demandée, puis vérifie le résultat (scripts/check-pdf.py). Windows uniquement (CI).
param(
  [Parameter(Mandatory = $true)][ValidateSet('auto', 'webview2', 'edge', 'chrome')][string]$Method,
  [string]$Expected = ''
)
$ErrorActionPreference = 'Stop'
if ($Expected -eq '') { $Expected = $Method }

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'src-tauri/target/release/phenix-cv.exe'
$out = Join-Path $root 'selftest-out'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$pdf = Join-Path $out "essai-$Method.pdf"
Remove-Item -Force -ErrorAction SilentlyContinue $pdf, "$pdf.json"

$env:PHENIXCV_SELFTEST_HTML = Join-Path $root 'tests/pdf-selftest/cv.html'
$env:PHENIXCV_SELFTEST_PDF = $pdf
$env:PHENIXCV_PDF_METHOD = $Method

$process = Start-Process -FilePath $exe -PassThru
if (-not $process.WaitForExit(120000)) {
  $process.Kill()
  throw "L'application ne s'est pas arrêtée en 120 s (méthode $Method)."
}
if (Test-Path "$pdf.json") { Get-Content "$pdf.json" | Write-Host }
if ($process.ExitCode -ne 0) { throw "Auto-test en échec (code $($process.ExitCode), méthode $Method)." }

python (Join-Path $root 'scripts/check-pdf.py') $pdf $Expected
if ($LASTEXITCODE -ne 0) { throw "Contrôle du PDF en échec (méthode $Method)." }
