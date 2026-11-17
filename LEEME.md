# Proyecto web del servidor

```
pepa12/
  web/                 lo que va al servidor (/root/web)
    good/              Good: portada y buscador
    admin/             panel de administración (puerto privado 8090)
    sitios/<slug>/     cada sitio: tsline, aninube, laolla, mundoapie, sabelopedia, pinar
    _app/              código PHP compartido (nunca se sirve por HTTP)
      sql/             migraciones de la base de datos
      cli/             migrar.php, crear-admin.php, indexar.php, importar-musica.php
    _datos/            datos de cada equipo: config.local.php, multimedia, marcadores de acceso (NO se copia entre equipos)
    _backups/          respaldos viejos del servidor
  deploy/              config de nginx y guía para instalar en el servidor (LEEME-despliegue.md)
  dev/                 entorno de pruebas en esta PC (nginx + PHP 8.4 + MariaDB con scoop)
  viejo/               lo que se reemplazó (portal viejo, panel viejo, TS_LINE/Crunchyroll/Tosho viejos)
```

## Probar en esta PC

```powershell
powershell -ExecutionPolicy Bypass -File dev\iniciar.ps1    # arranca todo
powershell -ExecutionPolicy Bypass -File dev\detener.ps1    # lo apaga
```

Copiá `dev/config.local.example.php` a `dev/config.local.php` y completá la clave de MariaDB.

- http://127.0.0.1:8081 — puerta **pública** (lo que ve internet por el túnel)
- http://127.0.0.1:8080 — puerta **LAN** (también ve los sitios privados)
- http://127.0.0.1:8090 — **panel** (usuario de prueba `<usuario>` / `<password>`, creado con `crear-admin.php`)
- Cuenta de prueba para TS_LINE y AniNube: `<usuario>` / `<password>` (se crea desde el panel > Cuentas)

Para correr los scripts de consola en esta PC hay que indicar la config de pruebas:
```powershell
$env:WEB_CONFIG = "$PWD\dev\config.local.php"
php -c dev\php\php.ini web\_app\cli\indexar.php
```

## Cómo se decide qué es público

nginx mira archivos marcador en `_datos/acceso/publico/<slug>` y `_datos/acceso/local/<slug>`.
El panel los crea o borra al activar o publicar un sitio. Sin marcador, el sitio da 404 por esa puerta.
Una carpeta nueva en `sitios/` con `index.html` se registra **privada** (botón "Detectar carpetas nuevas" o el cron).
Un `good.json` opcional en la carpeta define nombre, descripción, categoría, ícono y color.
