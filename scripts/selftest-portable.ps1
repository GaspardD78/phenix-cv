# Auto-test de la version portable (CI) : copie le dossier portable ailleurs, comme sur une clé USB,
# lance l'application en mode auto-test (export PDF par WebView2, moteur d'affichage réel), puis vérifie :
#  - l'application a fonctionné (PDF valide) ;
#  - ses données sont dans « data », à côté d'elle (dossier du moteur d'affichage, journal) ;
#  - rien n'a été écrit dans le dossier de données de Windows de l'application installée.
param([string]$Folder = 'portable-out/Phenix-CV-portable')
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root $Folder
$usb = Join-Path ([System.IO.Path]::GetTempPath()) "cle-usb-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
Copy-Item -Recurse $source $usb
$exe = Join-Path $usb 'Phenix-CV.exe'
if (-not (Test-Path (Join-Path $usb '.portable'))) { throw "Le fichier .portable manque dans $usb." }
if (Test-Path (Join-Path $usb 'data')) { throw "Le dossier data ne doit pas exister avant le premier lancement." }

# Dossier de données de l'application INSTALLÉE : il ne doit pas bouger pendant l'essai.
$installed = Join-Path $env:LOCALAPPDATA 'fr.phenixcv.app'
function Get-Stamp($dir) {
  if (-not (Test-Path $dir)) { return 'absent' }
  $files = Get-ChildItem -Recurse -Force -File -ErrorAction SilentlyContinue $dir
  if (-not $files) { return 'vide' }
  $newest = ($files | Measure-Object -Property LastWriteTimeUtc -Maximum).Maximum.Ticks
  return "$($files.Count) fichiers, dernier changement $newest"
}
$before = Get-Stamp $installed

$out = Join-Path $root 'selftest-out'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$pdf = Join-Path $out 'essai-portable.pdf'
Remove-Item -Force -ErrorAction SilentlyContinue $pdf, "$pdf.json"
$env:PHENIXCV_SELFTEST_HTML = Join-Path $root 'tests/pdf-selftest/cv.html'
$env:PHENIXCV_SELFTEST_PDF = $pdf
$env:PHENIXCV_PDF_METHOD = 'webview2'

$process = Start-Process -FilePath $exe -PassThru
if (-not $process.WaitForExit(120000)) { $process.Kill(); throw "L'application portable ne s'est pas arrêtée en 120 s." }
if (Test-Path "$pdf.json") { Get-Content "$pdf.json" | Write-Host }
if ($process.ExitCode -ne 0) { throw "Auto-test portable en échec (code $($process.ExitCode))." }

python (Join-Path $root 'scripts/check-pdf.py') $pdf webview2
if ($LASTEXITCODE -ne 0) { throw 'Contrôle du PDF en échec (version portable).' }

$data = Join-Path $usb 'data'
if (-not (Test-Path $data)) { throw "Le dossier data n'a pas été créé à côté de l'application." }
$web = Join-Path $data 'webview2'
$webFiles = @(Get-ChildItem -Recurse -Force -File -ErrorAction SilentlyContinue $web)
if ($webFiles.Count -eq 0) { throw "Le moteur d'affichage n'a rien écrit dans $web : ses données ne sont pas dans le dossier portable." }
Write-Host "Données portables : $($webFiles.Count) fichiers dans data/webview2."
Get-ChildItem -Force $data | ForEach-Object { Write-Host " - data/$($_.Name)" }

$after = Get-Stamp $installed
if ($before -ne $after) { throw "La version portable a écrit dans le dossier de l'application installée ($installed) : avant = $before ; après = $after." }
Write-Host "Aucune écriture hors du dossier portable (dossier installé : $after)."
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $usb
