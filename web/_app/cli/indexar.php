<?php
/**
 * Detecta carpetas nuevas en sitios/ y reindexa Good. Pensado para cron:
 *   *\/10 * * * *  php /srv/www/web/_app/cli/indexar.php >/dev/null
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}
require_once __DIR__ . '/../indexador.php';

$r = indexar_todo();
foreach ($r['detectados']['nuevos'] as $s) {
    echo "Nuevo sitio detectado (privado): $s\n";
}
foreach ($r['detectados']['ignorados'] as $s => $motivo) {
    echo "Ignorado $s: $motivo\n";
}
foreach ($r['sitios'] as $s => $n) {
    echo str_pad($s, 20) . " $n entradas\n";
}
