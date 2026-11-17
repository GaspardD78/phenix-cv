# Assemble la version portable (sans installation) : un dossier prêt à copier sur une clé USB, et son
# archive ZIP. Le dossier contient l'application, le fichier « .portable » (qui active le mode
# portable : toutes les données vont dans « data », à côté de l'application) et un LISEZMOI.
# Windows uniquement (CI ou poste de développement, après « bun run tauri build »).
param([string]$Out = 'portable-out')
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'src-tauri/target/release/phenix-cv.exe'
if (-not (Test-Path $exe)) { throw "Application introuvable : $exe. Lancez d'abord « bun run tauri build »." }

$outDir = Join-Path $root $Out
$name = 'Phenix-CV-portable'
$folder = Join-Path $outDir $name
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $outDir
New-Item -ItemType Directory -Force -Path $folder | Out-Null

Copy-Item $exe (Join-Path $folder 'Phenix-CV.exe')
New-Item -ItemType File -Path (Join-Path $folder '.portable') | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'portable-lisezmoi.txt') (Join-Path $folder 'LISEZMOI.txt')

$zip = Join-Path $outDir "$name.zip"
Compress-Archive -Path $folder -DestinationPath $zip

# Contrôle de l'archive : le fichier marqueur est la pièce essentielle, et il doit y être.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $entries = $archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') }
} finally { $archive.Dispose() }
foreach ($required in @("$name/Phenix-CV.exe", "$name/.portable", "$name/LISEZMOI.txt")) {
  if ($entries -notcontains $required) { throw "L'archive ne contient pas $required (contenu : $($entries -join ', '))." }
}
if ($entries | Where-Object { $_ -like "$name/data*" }) { throw "L'archive ne doit contenir aucune donnée (dossier data)." }

$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Version portable prête : $zip ($size Mo)"
