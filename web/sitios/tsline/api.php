<?php
/** API de TS_LINE (escuchar). Lecturas por GET; cambios por POST con token CSRF. */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';
require_once __DIR__ . '/../../_app/musica.php';

$yo = cuenta_requerir_api();
$cid = $yo['id'];
$a = (string)($_GET['a'] ?? '');
$post = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

function lista_propia(int $lista, int $cid): void
{
    if (!valor('SELECT id FROM musica_listas WHERE id=? AND cuenta_id=?', [$lista, $cid])) {
        json_error('Esa playlist no existe', 404);
    }
}

function listas_de(int $cid): array
{
    $ls = filas('SELECT id, nombre, creado FROM musica_listas WHERE cuenta_id=? ORDER BY creado DESC', [$cid]);
    foreach ($ls as &$l) {
        $l['id'] = (int)$l['id'];
        $l['pistas'] = array_map('intval', array_column(filas('SELECT pista_id FROM musica_lista_pistas WHERE lista_id=? ORDER BY orden, pista_id', [$l['id']]), 'pista_id'));
    }
    return $ls;
}

try {
    switch ($a) {
        case 'biblioteca':
            $pref = fila('SELECT generos, volumen FROM musica_prefs WHERE cuenta_id=?', [$cid]);
            $hist = array_map('intval', array_column(filas(
                'SELECT pista_id, MAX(fecha) f FROM musica_historial WHERE cuenta_id=? GROUP BY pista_id ORDER BY f DESC LIMIT 30', [$cid]), 'pista_id'));
            json_salida([
                'ok'      => true,
                'usuario' => $yo['usuario'],
                'pistas'  => array_map('musica_pista_publica', filas('SELECT * FROM musica_pistas ORDER BY titulo')),
                'likes'   => array_map('intval', array_column(filas('SELECT pista_id FROM musica_likes WHERE cuenta_id=? ORDER BY fecha DESC', [$cid]), 'pista_id')),
                'listas'  => listas_de($cid),
                'historial' => $hist,
                'prefs'   => [
                    'generos' => $pref && $pref['generos'] !== '' ? explode(',', $pref['generos']) : [],
                    'volumen' => $pref ? (int)$pref['volumen'] : 80,
                    'configuradas' => (bool)$pref,
                ],
                'generos' => GENEROS_MUSICA,
            ]);

        case 'like':
            if (!$post) json_error('Método no permitido', 405);
            $pid = ent_int('id');
            if (!valor('SELECT id FROM musica_pistas WHERE id=?', [$pid])) json_error('No existe la canción', 404);
            if (ent_bool('on')) {
                q('INSERT IGNORE INTO musica_likes (cuenta_id, pista_id) VALUES (?,?)', [$cid, $pid]);
            } else {
                q('DELETE FROM musica_likes WHERE cuenta_id=? AND pista_id=?', [$cid, $pid]);
            }
            json_salida(['ok' => true]);

        case 'lista_crear':
            if (!$post) json_error('Método no permitido', 405);
            $nombre = ent_str('nombre', '', 80) ?: 'Mi playlist';
            if ((int)valor('SELECT COUNT(*) FROM musica_listas WHERE cuenta_id=?', [$cid]) >= 200) json_error('Llegaste al máximo de playlists');
            q('INSERT INTO musica_listas (cuenta_id, nombre) VALUES (?,?)', [$cid, $nombre]);
            $id = ultimo_id();
            $pid = ent_int('pista');
            if ($pid && valor('SELECT id FROM musica_pistas WHERE id=?', [$pid])) {
                q('INSERT IGNORE INTO musica_lista_pistas (lista_id, pista_id, orden) VALUES (?,?,0)', [$id, $pid]);
            }
            json_salida(['ok' => true, 'id' => $id, 'listas' => listas_de($cid)]);

        case 'lista_renombrar':
            if (!$post) json_error('Método no permitido', 405);
            lista_propia(ent_int('lista'), $cid);
            $nombre = ent_str('nombre', '', 80);
            if ($nombre === '') json_error('El nombre no puede quedar vacío');
            q('UPDATE musica_listas SET nombre=? WHERE id=?', [$nombre, ent_int('lista')]);
            json_salida(['ok' => true, 'listas' => listas_de($cid)]);

        case 'lista_borrar':
            if (!$post) json_error('Método no permitido', 405);
            lista_propia(ent_int('lista'), $cid);
            q('DELETE FROM musica_listas WHERE id=?', [ent_int('lista')]);
            json_salida(['ok' => true, 'listas' => listas_de($cid)]);

        case 'lista_agregar':
            if (!$post) json_error('Método no permitido', 405);
            $l = ent_int('lista');
            lista_propia($l, $cid);
            $pid = ent_int('pista');
            if (!valor('SELECT id FROM musica_pistas WHERE id=?', [$pid])) json_error('No existe la canción', 404);
            if (valor('SELECT 1 FROM musica_lista_pistas WHERE lista_id=? AND pista_id=?', [$l, $pid])) {
                json_salida(['ok' => true, 'ya' => true, 'listas' => listas_de($cid)]);
            }
            $orden = (int)valor('SELECT COALESCE(MAX(orden),0)+1 FROM musica_lista_pistas WHERE lista_id=?', [$l]);
            q('INSERT INTO musica_lista_pistas (lista_id, pista_id, orden) VALUES (?,?,?)', [$l, $pid, $orden]);
            json_salida(['ok' => true, 'listas' => listas_de($cid)]);

        case 'lista_quitar':
            if (!$post) json_error('Método no permitido', 405);
            lista_propia(ent_int('lista'), $cid);
            q('DELETE FROM musica_lista_pistas WHERE lista_id=? AND pista_id=?', [ent_int('lista'), ent_int('pista')]);
            json_salida(['ok' => true, 'listas' => listas_de($cid)]);

        case 'lista_orden':
            if (!$post) json_error('Método no permitido', 405);
            $l = ent_int('lista');
            lista_propia($l, $cid);
            $ids = entrada()['ids'] ?? [];
            if (!is_array($ids)) json_error('Orden inválido');
            foreach (array_values($ids) as $i => $pid) {
                q('UPDATE musica_lista_pistas SET orden=? WHERE lista_id=? AND pista_id=?', [$i, $l, (int)$pid]);
            }
            json_salida(['ok' => true, 'listas' => listas_de($cid)]);

        case 'reproducida':
            if (!$post) json_error('Método no permitido', 405);
            $pid = ent_int('id');
            if (!valor('SELECT id FROM musica_pistas WHERE id=?', [$pid])) json_error('No existe la canción', 404);
            // no contar dos veces la misma cancion en menos de un minuto
            $ultima = fila('SELECT pista_id, fecha FROM musica_historial WHERE cuenta_id=? ORDER BY id DESC LIMIT 1', [$cid]);
            if (!$ultima || (int)$ultima['pista_id'] !== $pid || strtotime($ultima['fecha']) < time() - 60) {
                q('INSERT INTO musica_historial (cuenta_id, pista_id) VALUES (?,?)', [$cid, $pid]);
                q('UPDATE musica_pistas SET reproducciones = reproducciones + 1 WHERE id=?', [$pid]);
                if (random_int(1, 20) === 1) {
                    q('DELETE FROM musica_historial WHERE cuenta_id=? AND id NOT IN (SELECT id FROM (SELECT id FROM musica_historial WHERE cuenta_id=? ORDER BY id DESC LIMIT 500) t)', [$cid, $cid]);
                }
            }
            json_salida(['ok' => true]);

        case 'prefs':
            if (!$post) json_error('Método no permitido', 405);
            $g = entrada()['generos'] ?? null;
            $pref = fila('SELECT generos, volumen FROM musica_prefs WHERE cuenta_id=?', [$cid]);
            $generos = is_array($g) ? implode(',', array_intersect(GENEROS_MUSICA, $g)) : ($pref['generos'] ?? '');
            $vol = array_key_exists('volumen', entrada()) ? max(0, min(100, ent_int('volumen'))) : (int)($pref['volumen'] ?? 80);
            q('INSERT INTO musica_prefs (cuenta_id, generos, volumen) VALUES (?,?,?) ON DUPLICATE KEY UPDATE generos=VALUES(generos), volumen=VALUES(volumen)', [$cid, $generos, $vol]);
            json_salida(['ok' => true]);
    }
    json_error('Acción desconocida', 404);
} catch (Throwable $e) {
    error_log('[tsline] ' . $e->getMessage());
    json_error('Error del servidor', 500);
}
