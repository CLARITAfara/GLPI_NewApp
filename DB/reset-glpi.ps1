# =====================================================================
#  reset-glpi.ps1 — Réinitialise la base SQLite
#  ⚠️  Vide toutes les données sauf les essentielles (seed.sql)
#      Une sauvegarde automatique est créée avant chaque reset
#
#  Usage : powershell -File DB/reset-glpi.ps1
# =====================================================================

$root      = Split-Path $PSScriptRoot -Parent
$resetScript = Join-Path $PSScriptRoot "reset.js"

if (-not (Test-Path $resetScript)) {
    Write-Output "Fichier introuvable : $resetScript"
    exit 1
}

Write-Output "=== Reset de la base GLPI ==="
Write-Output ""

node --experimental-vm-modules $resetScript 2>$null
if ($LASTEXITCODE -ne 0) {
    node $resetScript
}

Write-Output ""
Write-Output "Redémarrez le serveur Node.js pour prendre en compte les changements."
