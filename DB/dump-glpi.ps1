# =====================================================================
#  dump-glpi.ps1  —  Sauvegarde (dump) de la base GLPI
#  À lancer à tout moment :   powershell -File DB/dump-glpi.ps1
#  Crée un fichier horodaté dans DB/backups/
# =====================================================================

param(
    [string]$Db       = "glpi",
    [string]$User     = "root",
    [string]$Password = "root"
)

# Le BON mysqldump (MySQL 8, pas celui de XAMPP/MariaDB)
$mysqldump = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"

if (-not (Test-Path $mysqldump)) {
    Write-Output "Introuvable : $mysqldump"
    exit 1
}

# Dossier de destination des sauvegardes
$backupDir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Nom de fichier horodaté : gplidb_2026-06-04_153000.sql
$stamp   = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile = Join-Path $backupDir "$($Db)_$stamp.sql"

Write-Output "Sauvegarde de '$Db' en cours..."

# --result-file = mysqldump écrit directement dans le fichier
#   (évite les soucis d'encodage d'une redirection PowerShell)
# --single-transaction = capture cohérente sans bloquer la base
# --routines --events  = inclut aussi procédures stockées et événements
& $mysqldump "-u$User" "-p$Password" --single-transaction --routines --events --result-file="$outFile" $Db

if ($LASTEXITCODE -eq 0) {
    $sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
    Write-Output "OK -> $outFile  ($sizeKB Ko)"
} else {
    Write-Output "ECHEC (code $LASTEXITCODE)"
}
