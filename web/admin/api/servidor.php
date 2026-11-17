<?php
/** API: estado del servidor, base de datos, energia y registro de auditoria. */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/admin_auth.php';

function leer_cpu(): array
{
    $l = @file('/proc/stat');
    if (!$l) {
        return [0, 0];
    }
    $p = array_map('intval', array_slice(preg_split('/\s+/', trim($l[0])), 1));
    return [array_sum($p), ($p[3] ?? 0) + ($p[4] ?? 0)];
}

admin_despachar([
    'estado' => function (): array {
        [$t1, $i1] = leer_cpu();
        usleep(200000);
        [$t2, $i2] = leer_cpu();
        $cpu = ($t2 - $t1) > 0 ? (int)round((1 - ($i2 - $i1) / ($t2 - $t1)) * 100) : 0;
        $mem = [];
        foreach (@file('/proc/meminfo') ?: [] as $line) {
            if (preg_match('/^(\w+):\s+(\d+)/', $line, $m)) {
                $mem[$m[1]] = (int)$m[2];
            }
        }
        $memTotal = $mem['MemTotal'] ?? 0;
        $memDisp = $mem['MemAvailable'] ?? ($mem['MemFree'] ?? 0);
        $raiz = PHP_OS_FAMILY === 'Windows' ? substr(WEB_RAIZ, 0, 3) : '/';
        $dT = @disk_total_space($raiz) ?: 0;
        $dL = @disk_free_space($raiz) ?: 0;
        $up = @file_get_contents('/proc/uptime');
        $load = @file_get_contents('/proc/loadavg');
        $nucleos = 0;
        foreach (@file('/proc/cpuinfo') ?: [] as $l) {
            if (str_starts_with($l, 'processor')) {
                $nucleos++;
            }
        }
        $nombres = [
            'nginx' => 'Servidor web (nginx)', 'php-fpm84' => 'PHP-FPM 8.4', 'mariadb' => 'Base de datos (MariaDB)',
            'samba' => 'Samba (compartido)', 'sshd' => 'SSH', 'tailscale' => 'Tailscale (VPN)',
            'cloudflared-tunel' => 'Túnel Cloudflare', 'crond' => 'Cron', 'ntpd' => 'Reloj (NTP)',
        ];
        $iniciados = array_flip(@scandir('/run/openrc/started') ?: []);
        $servicios = [];
        foreach ($nombres as $id => $n) {
            $servicios[] = ['id' => $id, 'nombre' => $n, 'activo' => isset($iniciados[$id]), 'conocido' => $iniciados !== []];
        }
        $sit = filas('SELECT activa, publica FROM sitios');
        return [
            'hostname' => trim(@file_get_contents('/proc/sys/kernel/hostname') ?: gethostname() ?: 'servidor'),
            'cpu' => ['pct' => max(0, min(100, $cpu)), 'carga' => $load ? array_slice(preg_split('/\s+/', trim($load)), 0, 3) : null, 'nucleos' => max(1, $nucleos)],
            'memoria' => ['pct' => $memTotal ? (int)round(($memTotal - $memDisp) / $memTotal * 100) : 0, 'total_kb' => $memTotal, 'usado_kb' => max(0, $memTotal - $memDisp)],
            'disco' => ['pct' => $dT ? (int)round(($dT - $dL) / $dT * 100) : 0, 'total' => $dT, 'usado' => $dT - $dL],
            'uptime' => $up ? (int)floatval(explode(' ', $up)[0]) : null,
            'servicios' => $servicios,
            'sitios' => ['total' => count($sit), 'activos' => count(array_filter($sit, fn($s) => (int)$s['activa'] === 1)),
                'publicos' => count(array_filter($sit, fn($s) => (int)$s['activa'] === 1 && (int)$s['publica'] === 1))],
            'contenido' => [
                'canciones' => (int)valor('SELECT COUNT(*) FROM musica_pistas'),
                'series' => (int)valor('SELECT COUNT(*) FROM anime_series'),
                'episodios' => (int)valor('SELECT COUNT(*) FROM anime_episodios'),
                'cuentas' => (int)valor('SELECT COUNT(*) FROM cuentas'),
                'paginas_indexadas' => (int)valor('SELECT COUNT(*) FROM good_paginas'),
            ],
            'actividad' => filas('SELECT fecha, evento, usuario, detalle FROM registro ORDER BY id DESC LIMIT 8'),
            'ts' => time(),
        ];
    },

    'basedatos' => function (): array {
        $bases = filas("SELECT table_schema AS nombre, COUNT(*) AS tablas, COALESCE(SUM(data_length+index_length),0) AS bytes
                        FROM information_schema.tables GROUP BY table_schema ORDER BY bytes DESC");
        $tablas = filas("SELECT table_name AS nombre, table_rows AS filas, COALESCE(data_length+index_length,0) AS bytes
                         FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name");
        return ['motor' => 'MariaDB ' . valor('SELECT VERSION()'), 'bases' => $bases, 'tablas' => $tablas];
    },

    'registro' => function (): array {
        $buscar = ent_str('buscar', '', 80);
        $evento = ent_str('evento', '', 80);
        $pag = max(0, ent_int('pagina'));
        $where = [];
        $p = [];
        if ($buscar !== '') {
            $where[] = '(detalle LIKE ? OR usuario LIKE ? OR ip LIKE ?)';
            array_push($p, "%$buscar%", "%$buscar%", "%$buscar%");
        }
        if ($evento !== '') {
            $where[] = 'evento = ?';
            $p[] = $evento;
        }
        $w = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $total = (int)valor("SELECT COUNT(*) FROM registro $w", $p);
        $filas = filas("SELECT id, fecha, evento, usuario, ip, detalle FROM registro $w ORDER BY id DESC LIMIT 50 OFFSET " . ($pag * 50), $p);
        $eventos = array_column(filas('SELECT DISTINCT evento FROM registro ORDER BY evento'), 'evento');
        return ['total' => $total, 'filas' => $filas, 'eventos' => $eventos];
    },

    'energia' => function (string $yo): array {
        $accion = ent_str('accion');
        if (!in_array($accion, ['pantalla-on', 'pantalla-off', 'pantalla-estado', 'apagar'], true)) {
            throw new InvalidArgumentException('Acción inválida');
        }
        if ($accion === 'apagar' && ent_str('confirmar') !== 'APAGAR') {
            throw new InvalidArgumentException('Falta la confirmación (escribí APAGAR)');
        }
        $cmd = (string)cfg('energia_cmd', '');
        if ($cmd === '') {
            throw new InvalidArgumentException('Los controles de energía no están configurados en este equipo.');
        }
        $salida = [];
        $rc = 0;
        exec($cmd . ' ' . escapeshellarg($accion) . ' 2>&1', $salida, $rc);
        $txt = trim(implode("\n", $salida));
        if ($rc !== 0) {
            throw new RuntimeException($txt !== '' ? $txt : "código $rc");
        }
        if ($accion !== 'pantalla-estado') {
            registrar('energia', $accion, $yo);
        }
        return ['salida' => $txt];
    },
]);
