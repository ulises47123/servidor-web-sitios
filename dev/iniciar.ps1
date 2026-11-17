# Arranca el entorno de pruebas local: MariaDB (3307) + PHP (9000) + nginx (8080/8081/8090).
# Uso:  powershell -ExecutionPolicy Bypass -File dev\iniciar.ps1
$ErrorActionPreference = 'Stop'
$dev   = $PSScriptRoot
$raiz  = Split-Path $dev
$web   = Join-Path $raiz 'web'
$ngx   = Join-Path $dev 'nginx'
$env:WEB_CONFIG = Join-Path $dev 'config.local.php'
$env:PHP_FCGI_MAX_REQUESTS = '0'

$mariadb = scoop prefix mariadb
$php     = scoop prefix php84
$nginx   = scoop prefix nginx
$datos   = Join-Path $dev 'mariadb-data'

# --- config de nginx: la misma que va al servidor ---
New-Item -ItemType Directory -Force (Join-Path $ngx 'conf\web') | Out-Null
Copy-Item (Join-Path $raiz 'deploy\nginx\web\*') (Join-Path $ngx 'conf\web') -Force
foreach ($f in 'mime.types', 'fastcgi_params') { Copy-Item (Join-Path $nginx "conf\$f") (Join-Path $ngx 'conf') -Force }
foreach ($d in 'client_body','fastcgi','proxy','scgi','uwsgi') { New-Item -ItemType Directory -Force (Join-Path $ngx "temp\$d") | Out-Null }

# --- MariaDB ---
$primeraVez = -not (Test-Path $datos)
if ($primeraVez) {
    & "$mariadb\bin\mariadb-install-db.exe" "--datadir=$datos" '--port=3307' | Out-Null
}
if (-not (Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue)) {
    Start-Process "$mariadb\bin\mariadbd.exe" -ArgumentList "--datadir=`"$datos`"", '--port=3307', '--bind-address=127.0.0.1' -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not (Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
}
# idempotente: se corre siempre
if ($true) {
    $sql = "CREATE DATABASE IF NOT EXISTS servidor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" +
           "CREATE USER IF NOT EXISTS 'panel'@'localhost' IDENTIFIED BY 'dev-panel-local';" +
           "CREATE USER IF NOT EXISTS 'panel'@'127.0.0.1' IDENTIFIED BY 'dev-panel-local';" +
           "GRANT ALL ON servidor.* TO 'panel'@'localhost'; GRANT ALL ON servidor.* TO 'panel'@'127.0.0.1';" +
           "FLUSH PRIVILEGES;"
    $ErrorActionPreference = 'Continue'
    & "$mariadb\bin\mariadb.exe" '--user=root' '--host=127.0.0.1' '--port=3307' -e $sql 2>$null
    $ErrorActionPreference = 'Stop'
}

# --- migraciones ---
& "$php\php.exe" -c (Join-Path $dev 'php\php.ini') (Join-Path $web '_app\cli\migrar.php')

# --- PHP (FastCGI) ---
if (-not (Get-NetTCPConnection -State Listen -LocalPort 9000 -ErrorAction SilentlyContinue)) {
    Start-Process "$php\php-cgi.exe" -ArgumentList '-b', '127.0.0.1:9000', '-c', "`"$dev\php\php.ini`"" -WindowStyle Hidden
}

# --- nginx ---
$ErrorActionPreference = 'Continue'
& "$nginx\nginx.exe" -p "$ngx" -t 2>$null
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) { throw 'Config de nginx con errores (ver dev\nginx\logs\error.log)' }
if (-not (Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue)) {
    Start-Process "$nginx\nginx.exe" -ArgumentList '-p', "`"$ngx`"" -WorkingDirectory $ngx -WindowStyle Hidden
} else {
    & "$nginx\nginx.exe" -p "$ngx" -s reload
}
Start-Sleep -Seconds 1
Write-Host ''
Write-Host 'Listo:'
Write-Host '  http://127.0.0.1:8081   puerta PUBLICA (lo que ve el tunel)'
Write-Host '  http://127.0.0.1:8080   puerta LAN (publico + privado)'
Write-Host '  http://127.0.0.1:8090   PANEL ADMIN'
