# =====================================================================
#  restore-glpi.ps1  —  Restaure la base GLPI depuis une sauvegarde
#  ⚠️ ÉCRASE les données actuelles par celles de la sauvegarde !
#
#  Usage :
#    powershell -File DB/restore-glpi.ps1                  (prend la sauvegarde la plus récente)
#    powershell -File DB/restore-glpi.ps1 -File chemin.sql (sauvegarde précise)
# =====================================================================

param(
    [string]$File     = "",
    [string]$Db       = "gplidb",
    [string]$User     = "root",
    [string]$Password = "root"
)

# Le BON client mysql (MySQL 8, pas celui de XAMPP/MariaDB)
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
if (-not (Test-Path $mysql)) { Write-Output "Introuvable : $mysql"; exit 1 }

$backupDir = Join-Path $PSScriptRoot "backups"

# Si aucun fichier précisé : prendre la sauvegarde la plus récente
if ([string]::IsNullOrWhiteSpace($File)) {
    $latest = Get-ChildItem -Path $backupDir -Filter "*.sql" -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -eq $latest) { Write-Output "Aucune sauvegarde .sql trouvée dans $backupDir"; exit 1 }
    $File = $latest.FullName
}

if (-not (Test-Path $File)) { Write-Output "Fichier introuvable : $File"; exit 1 }

Write-Output "Restauration de '$Db' depuis :"
Write-Output "  $File"
Write-Output "(les donnees actuelles vont etre remplacees)"

# Restauration : le client mysql lit le fichier SQL et rejoue tout
& $mysql "-u$User" "-p$Password" $Db -e "source $($File -replace '\\','/')"

if ($LASTEXITCODE -eq 0) {
    Write-Output "OK -> base '$Db' restauree."
} else {
    Write-Output "ECHEC (code $LASTEXITCODE)"
}
