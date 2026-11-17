<?php
/**
 * Aplica las migraciones SQL pendientes de _app/sql/ (en orden) y deja los
 * sitios del sistema registrados. Uso:  php _app/cli/migrar.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}
require_once __DIR__ . '/../sitios.php';

db()->query('CREATE TABLE IF NOT EXISTS migraciones (nombre VARCHAR(120) PRIMARY KEY, aplicada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$hechas = array_column(filas('SELECT nombre FROM migraciones'), 'nombre', 'nombre');

$archivos = glob(APP_DIR . '/sql/*.sql') ?: [];
sort($archivos);
foreach ($archivos as $f) {
    $n = basename($f);
    if (isset($hechas[$n])) {
        continue;
    }
    echo "Aplicando $n ... ";
    $sql = (string)file_get_contents($f);
    $c = db();
    if (!$c->multi_query($sql)) {
        fwrite(STDERR, "ERROR: {$c->error}\n");
        exit(1);
    }
    do {
        if ($r = $c->store_result()) {
            $r->free();
        }
    } while ($c->more_results() && $c->next_result());
    if ($c->errno) {
        fwrite(STDERR, "ERROR: {$c->error}\n");
        exit(1);
    }
    q('INSERT INTO migraciones (nombre) VALUES (?)', [$n]);
    echo "ok\n";
}

// Sitios del sistema (si la carpeta existe y todavia no estan registrados)
$sistema = [
    'tsline'  => ['TS_LINE', 'Reproductor de música: playlists, me gusta, cola y letras sincronizadas.', 'Música', '🎵', 'orange'],
    'aninube' => ['AniNube', 'Anime para ver online: catálogo, episodios, Mi lista y seguir viendo.', 'Anime', '☁️', 'purple'],
];
foreach ($sistema as $slug => [$nombre, $desc, $cat, $ico, $color]) {
    if (is_dir(SITIOS_DIR . "/$slug") && !sitio_obtener($slug)) {
        q('INSERT INTO sitios (slug, nombre, descripcion, categoria, icono, color, publica, activa, sistema) VALUES (?,?,?,?,?,?,1,1,1)',
            [$slug, $nombre, $desc, $cat, $ico, $color]);
        echo "Sitio del sistema registrado: $slug\n";
    }
}
asegurar_dir(MEDIA_DIR);
asegurar_dir(DATOS_DIR . '/tmp');
sitios_sincronizar_acceso();
echo "Migraciones al día.\n";
