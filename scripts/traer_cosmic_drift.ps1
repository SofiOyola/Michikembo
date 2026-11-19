# ============================================================
# Descarga la versión web de Cosmic Drift en games\cosmic_drift\fuente\
# Dónde ejecutarlo: PowerShell (terminal de VS Code en Windows), en la raíz del repositorio.
#   powershell -ExecutionPolicy Bypass -File scripts\traer_cosmic_drift.ps1
# ============================================================
param([string]$Commit = "4a8857983045e86b623e5d715ace600ed799a7e1")
$ErrorActionPreference = "Stop"
$Repo = "https://github.com/SofiOyola/Cosmic-Drift.git"
$Destino = "games\cosmic_drift\fuente"
$Tmp = Join-Path $env:TEMP ("cd_" + [guid]::NewGuid())
git clone --quiet $Repo "$Tmp\cd"
git -C "$Tmp\cd" checkout --quiet $Commit
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
foreach ($x in @("index.html", "css", "js", "assets", "data", "README.md", "MIGRACION_WEB.md")) {
    if (Test-Path "$Destino\$x") { Remove-Item -Recurse -Force "$Destino\$x" }
    Copy-Item -Recurse "$Tmp\cd\$x" "$Destino\$x"
}
Set-Content -Path "$Destino\COMMIT_ORIGEN.txt" -Value $Commit
Remove-Item -Recurse -Force $Tmp
Write-Host "Cosmic Drift copiado en $Destino (commit $Commit)"
