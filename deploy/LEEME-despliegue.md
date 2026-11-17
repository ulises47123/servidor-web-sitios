# Pasar la versión nueva al servidor (Alpine)

> **No se ejecutó todavía.** Estos pasos cambian el servidor y hay que hacerlos con un respaldo previo.
> Todo se corre como `root` por SSH (`ssh root@<IP_TAILSCALE_SERVIDOR>`).

## 0. Respaldo completo (antes de tocar nada)

```sh
F=$(date +%Y%m%d-%H%M%S)
mkdir -p /root/respaldos-config/$F
tar czf /root/respaldos-config/$F/web.tar.gz -C /root web
cp -a /etc/nginx /root/respaldos-config/$F/nginx
cp /etc/init.d/cloudflared-tunel /root/respaldos-config/$F/
mariadb-dump --databases servidor > /root/respaldos-config/$F/servidor.sql
```

## 1. Subir los archivos

Desde la PC, copiar a `/root/web/` **solo** estas carpetas de `pepa12/web/`:
`_app/`, `admin/`, `good/`, `sitios/` (tsline, aninube, laolla, mundoapie, sabelopedia, pinar).

**No subir** `_datos/` de la PC: ahí están la base de pruebas, los marcadores y los archivos de prueba.
En el servidor `_datos/` se crea solo.

Los archivos viejos (`index.php`, `paginas.json`, `panel/`, `sitios/TS_LINE`, `sitios/Crunchyroll`, `sitios/Tosho`)
se mueven a una carpeta aparte, no se borran:

```sh
mkdir -p /root/web-viejo
cd /root/web && mv index.php index.php.save paginas.json panel /root/web-viejo/ 2>/dev/null
mkdir -p /root/web-viejo/sitios && mv sitios/TS_LINE sitios/Crunchyroll sitios/Tosho /root/web-viejo/sitios/ 2>/dev/null
```

## 2. Configuración y permisos

```sh
mkdir -p /root/web/_datos
cat > /root/web/_datos/config.local.php <<'EOF'
<?php
return [
    'entorno' => 'servidor',
    'db' => ['host' => 'localhost', 'user' => 'panel', 'pass' => '<password>', 'name' => 'servidor', 'socket' => '/run/mysqld/mysqld.sock'],
    'energia_cmd' => '/usr/bin/doas /usr/local/sbin/panel-energia',
];
EOF
chmod 640 /root/web/_datos/config.local.php
chown root:nobody /root/web/_datos/config.local.php

# PHP (usuario nobody) necesita escribir en sitios/ y _datos/ para crear, subir y borrar
chown -R nobody:nobody /root/web/sitios /root/web/_datos
chown root:nobody /root/web/_datos/config.local.php

# El usuario 'panel' de MariaDB necesita poder crear las tablas nuevas
mariadb -e "GRANT ALL PRIVILEGES ON servidor.* TO 'panel'@'localhost'; FLUSH PRIVILEGES;"
```

> Recomendado: aprovechar para **cambiar la contraseña de `panel`** (estaba escrita en dos archivos viejos)
> y la de **root del sistema**.

## 3. Base de datos, música vieja y primer administrador

```sh
cd /srv/www/web
su -s /bin/sh nobody -c "php84 _app/cli/migrar.php"
su -s /bin/sh nobody -c "php84 _app/cli/importar-musica.php /root/web-viejo/sitios/TS_LINE/subidas"   # canciones subidas
su -s /bin/sh nobody -c "php84 _app/cli/importar-musica.php /root/web-viejo/sitios/TS_LINE"           # elements.webm
php84 _app/cli/crear-admin.php TU_USUARIO     # pide la contraseña (mínimo 10 caracteres)
su -s /bin/sh nobody -c "php84 _app/cli/indexar.php"
```

(Si `nobody` no puede leer `/root/web-viejo`, copiar antes esas carpetas a `/tmp` y apuntar ahí.)
Las cuentas de TS_LINE (`admin`, `Julian`) pasan solas a la tabla `cuentas` con la misma contraseña.

## 4. nginx: las tres puertas

```sh
mkdir -p /etc/nginx/web /etc/nginx/web-entorno
# copiar deploy/nginx/web/*                  -> /etc/nginx/web/
# copiar deploy/nginx/web-entorno-servidor/* -> /etc/nginx/web-entorno/
cat > /etc/nginx/http.d/default.conf <<'EOF'
include /etc/nginx/web-entorno/entorno.conf;
include /etc/nginx/web/web.conf;
EOF
nginx -t && rc-service nginx reload
```

| Puerta | Dirección | Para qué |
|---|---|---|
| Pública | `127.0.0.1:8081` | solo el túnel de Cloudflare |
| LAN | `http://<IP_LAN_SERVIDOR>/` o `http://<IP_TAILSCALE_SERVIDOR>/` | Good + sitios públicos y privados |
| Panel | `http://<IP_LAN_SERVIDOR>:8090/` o `http://<IP_TAILSCALE_SERVIDOR>:8090/` | administración |

## 5. Túnel de Cloudflare → puerta pública

En `/etc/init.d/cloudflared-tunel` cambiar:

```
command_args="tunnel --no-autoupdate --url http://localhost:80"
```
por
```
command_args="tunnel --no-autoupdate --url http://127.0.0.1:8081"
```
y `rc-service cloudflared-tunel restart`. El enlace nuevo aparece en `/var/log/cloudflared.log`.

## 6. Cron del indexador (carpetas nuevas cada 10 minutos)

```sh
echo '*/10 * * * * su -s /bin/sh nobody -c "php84 /srv/www/web/_app/cli/indexar.php" >/dev/null 2>&1' >> /etc/crontabs/root
rc-service crond restart
```

## 7. Comprobar

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/            # 200 (Good)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/login.php   # 404 (el panel no existe por el túnel)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:80/              # 403 (la LAN no acepta 127.0.0.1, a propósito)
curl -s -o /dev/null -w '%{http_code}\n' http://<IP_LAN_SERVIDOR>:8090/login.php  # 200
```

## Volver atrás

```sh
F=<carpeta del respaldo>
rm -rf /etc/nginx && cp -a /root/respaldos-config/$F/nginx /etc/nginx && rc-service nginx reload
cp /root/respaldos-config/$F/cloudflared-tunel /etc/init.d/ && rc-service cloudflared-tunel restart
cd /root && mv web web-nuevo && tar xzf /root/respaldos-config/$F/web.tar.gz
mariadb < /root/respaldos-config/$F/servidor.sql
```
