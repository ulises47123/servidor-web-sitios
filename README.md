# Servidor web: Good + panel + sitios

Proyecto web en **PHP 8.4 + MariaDB + nginx** para un servidor casero (Alpine Linux):

- **Good** (`web/good/`): portada y buscador interno de los sitios del servidor.
- **Panel de administración** (`web/admin/`): crear/publicar sitios, gestor de archivos, música, anime, cuentas, administradores y registro de auditoría (login con bloqueo por intentos, CSRF, sesiones con vencimiento).
- **Sitios** (`web/sitios/`): TS_LINE (música), AniNube (videos), La Olla (recetas), Mundo a Pie (viajes), Sabelopedia (enciclopedia) y Pinar (tablero de ideas).
- **nginx con tres "puertas"**: pública (para un túnel), LAN y panel privado (`deploy/nginx/`).

## Documentación

- [`LEEME.md`](LEEME.md): estructura del proyecto y cómo probarlo en una PC con Windows (`dev/iniciar.ps1`).
- [`deploy/LEEME-despliegue.md`](deploy/LEEME-despliegue.md): pasos para instalarlo en el servidor.

## Configuración

Las claves no están en el repo. Copiá `dev/config.local.example.php` a `dev/config.local.php` (PC de pruebas) o creá `web/_datos/config.local.php` en el servidor, y completá los valores marcados como `<password>`.
