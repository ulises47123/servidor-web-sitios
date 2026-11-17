# Detiene el entorno de pruebas local (nginx, php-cgi y la MariaDB del puerto 3307).
$dev = $PSScriptRoot
$nginx = scoop prefix nginx
& "$nginx\nginx.exe" -p (Join-Path $dev 'nginx') -s quit 2>$null
Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force
$c = Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force }
Write-Host 'Entorno detenido.'
