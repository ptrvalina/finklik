# Копия SQLite для Windows (локальная dev-БД).
# Запуск из корня репозитория: pwsh scripts/backup/sqlite-backup.ps1
# Переменная окружения SQLITE_DB — путь к .db, иначе backend\api-gateway\finklik.db

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$defaultDb = Join-Path $root "backend\api-gateway\finklik.db"
$db = if ($env:SQLITE_DB) { $env:SQLITE_DB } else { $defaultDb }
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $root "backups\sqlite" }
if (-not (Test-Path -LiteralPath $db)) { throw "Файл БД не найден: $db" }
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$out = Join-Path $backupDir "finklik_$stamp.db"
Copy-Item -LiteralPath $db -Destination $out -Force
Write-Host "Скопировано: $out"
