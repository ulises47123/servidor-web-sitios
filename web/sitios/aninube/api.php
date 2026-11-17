<?php
/** API de AniNube (ver anime). Lecturas por GET; progreso y Mi lista por POST con CSRF. */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';
require_once __DIR__ . '/../../_app/anime.php';

$yo = cuenta_requerir_api();
$cid = $yo['id'];
$a = (string)($_GET['a'] ?? '');
$post = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

const SQL_SERIES = 'SELECT s.*, (SELECT COUNT(*) FROM anime_episodios e WHERE e.serie_id=s.id) AS n_eps FROM anime_series s';

/** Todas las series con sus generos (una sola consulta de generos). */
function series_todas(): array
{
    $gen = [];
    foreach (filas('SELECT serie_id, genero FROM anime_generos ORDER BY genero') as $g) {
        $gen[(int)$g['serie_id']][] = $g['genero'];
    }
    return array_map(function ($s) use ($gen) {
        $p = anime_serie_publica($s, false);
        $p['generos'] = $gen[(int)$s['id']] ?? [];
        $p['actualizado'] = $s['actualizado'];
        return $p;
    }, filas(SQL_SERIES . ' ORDER BY s.titulo'));
}

/** Ultimo episodio en curso por serie (para "Seguir viendo"). */
function seguir_viendo(int $cid): array
{
    $filas = filas(
        'SELECT p.episodio_id, p.segundos, p.visto, p.actualizado, e.serie_id, e.temporada, e.numero, e.titulo AS ep_titulo, e.duracion, e.miniatura
         FROM anime_progreso p JOIN anime_episodios e ON e.id = p.episodio_id
         WHERE p.cuenta_id=? ORDER BY p.actualizado DESC LIMIT 60', [$cid]);
    $out = [];
    foreach ($filas as $f) {
        $sid = (int)$f['serie_id'];
        if (array_key_exists($sid, $out)) {   // null = serie terminada, tampoco se repite
            continue;
        }
        $epId = (int)$f['episodio_id'];
        $seg = (int)$f['segundos'];
        // si ya lo termino, proponer el siguiente episodio
        if ((int)$f['visto'] === 1) {
            $sig = fila('SELECT * FROM anime_episodios WHERE serie_id=? AND (temporada > ? OR (temporada = ? AND numero > ?)) ORDER BY temporada, numero LIMIT 1',
                [$sid, (int)$f['temporada'], (int)$f['temporada'], (int)$f['numero']]);
            if (!$sig) {
                $out[$sid] = null; // serie terminada: no se muestra
                continue;
            }
            $f = ['episodio_id' => $sig['id'], 'temporada' => $sig['temporada'], 'numero' => $sig['numero'], 'ep_titulo' => $sig['titulo'],
                'duracion' => $sig['duracion'], 'miniatura' => $sig['miniatura'], 'actualizado' => $f['actualizado']];
            $epId = (int)$sig['id'];
            $seg = 0;
        }
        $out[$sid] = [
            'serie_id' => $sid, 'episodio_id' => $epId, 'temporada' => (int)$f['temporada'], 'numero' => (int)$f['numero'],
            'titulo' => $f['ep_titulo'], 'segundos' => $seg, 'duracion' => (int)$f['duracion'],
            'miniatura' => $f['miniatura'] !== '' ? "media.php?t=miniatura&id=$epId" : '',
        ];
    }
    return array_values(array_filter($out));
}

try {
    switch ($a) {
        case 'inicio':
            json_salida([
                'ok' => true,
                'usuario' => $yo['usuario'],
                'series' => series_todas(),
                'seguir' => seguir_viendo($cid),
                'mi_lista' => array_map('intval', array_column(filas('SELECT serie_id FROM anime_lista WHERE cuenta_id=? ORDER BY fecha DESC', [$cid]), 'serie_id')),
                'generos' => GENEROS_ANIME,
                'estados' => ESTADOS_ANIME,
            ]);

        case 'serie':
            $id = (int)($_GET['id'] ?? 0);
            $s = fila(SQL_SERIES . ' WHERE s.id=?', [$id]);
            if (!$s) json_error('No existe la serie', 404);
            $eps = filas('SELECT * FROM anime_episodios WHERE serie_id=? ORDER BY temporada, numero', [$id]);
            $prog = [];
            foreach (filas('SELECT p.episodio_id, p.segundos, p.visto FROM anime_progreso p JOIN anime_episodios e ON e.id=p.episodio_id WHERE p.cuenta_id=? AND e.serie_id=?', [$cid, $id]) as $p) {
                $prog[(int)$p['episodio_id']] = ['segundos' => (int)$p['segundos'], 'visto' => (int)$p['visto'] === 1];
            }
            json_salida([
                'ok' => true,
                'serie' => anime_serie_publica($s),
                'episodios' => array_map(fn($e) => anime_episodio_publico($e) + ['progreso' => $prog[(int)$e['id']] ?? null], $eps),
                'en_lista' => (bool)valor('SELECT 1 FROM anime_lista WHERE cuenta_id=? AND serie_id=?', [$cid, $id]),
            ]);

        case 'episodio':
            $id = (int)($_GET['id'] ?? 0);
            $e = fila('SELECT * FROM anime_episodios WHERE id=?', [$id]);
            if (!$e) json_error('No existe el episodio', 404);
            $s = fila(SQL_SERIES . ' WHERE s.id=?', [(int)$e['serie_id']]);
            $orden = array_map('intval', array_column(filas('SELECT id FROM anime_episodios WHERE serie_id=? ORDER BY temporada, numero', [(int)$e['serie_id']]), 'id'));
            $i = array_search($id, $orden, true);
            $sig = $orden[$i + 1] ?? null;
            $p = fila('SELECT segundos, visto FROM anime_progreso WHERE cuenta_id=? AND episodio_id=?', [$cid, $id]);
            json_salida([
                'ok' => true,
                'episodio' => anime_episodio_publico($e),
                'serie' => anime_serie_publica($s),
                'anterior' => $i > 0 ? $orden[$i - 1] : null,
                'siguiente' => $sig ? anime_episodio_publico(fila('SELECT * FROM anime_episodios WHERE id=?', [$sig])) : null,
                'progreso' => $p ? ['segundos' => (int)$p['segundos'], 'visto' => (int)$p['visto'] === 1] : null,
            ]);

        case 'progreso':
            if (!$post) json_error('Método no permitido', 405);
            $eid = ent_int('episodio');
            $e = fila('SELECT duracion FROM anime_episodios WHERE id=?', [$eid]);
            if (!$e) json_error('No existe el episodio', 404);
            $seg = max(0, ent_int('segundos'));
            $dur = max((int)$e['duracion'], ent_int('duracion'));
            if ($dur > 0 && (int)$e['duracion'] === 0) {
                q('UPDATE anime_episodios SET duracion=? WHERE id=?', [$dur, $eid]); // la aprende del reproductor
            }
            $visto = ent_bool('visto') || ($dur > 0 && $seg >= $dur * 0.9);
            q('INSERT INTO anime_progreso (cuenta_id, episodio_id, segundos, visto) VALUES (?,?,?,?)
               ON DUPLICATE KEY UPDATE segundos=VALUES(segundos), visto=GREATEST(visto, VALUES(visto)), actualizado=NOW()',
                [$cid, $eid, $seg, $visto ? 1 : 0]);
            json_salida(['ok' => true, 'visto' => $visto]);

        case 'marcar':
            if (!$post) json_error('Método no permitido', 405);
            $eid = ent_int('episodio');
            if (!valor('SELECT id FROM anime_episodios WHERE id=?', [$eid])) json_error('No existe el episodio', 404);
            if (ent_bool('visto')) {
                q('INSERT INTO anime_progreso (cuenta_id, episodio_id, segundos, visto) VALUES (?,?,0,1) ON DUPLICATE KEY UPDATE visto=1, actualizado=NOW()', [$cid, $eid]);
            } else {
                q('DELETE FROM anime_progreso WHERE cuenta_id=? AND episodio_id=?', [$cid, $eid]);
            }
            json_salida(['ok' => true]);

        case 'lista':
            if (!$post) json_error('Método no permitido', 405);
            $sid = ent_int('serie');
            if (!valor('SELECT id FROM anime_series WHERE id=?', [$sid])) json_error('No existe la serie', 404);
            if (ent_bool('on')) {
                q('INSERT IGNORE INTO anime_lista (cuenta_id, serie_id) VALUES (?,?)', [$cid, $sid]);
            } else {
                q('DELETE FROM anime_lista WHERE cuenta_id=? AND serie_id=?', [$cid, $sid]);
            }
            json_salida(['ok' => true]);

        case 'historial':
            json_salida(['ok' => true, 'items' => array_map(fn($f) => [
                'episodio_id' => (int)$f['id'], 'serie_id' => (int)$f['serie_id'], 'serie' => $f['serie'], 'temporada' => (int)$f['temporada'],
                'numero' => (int)$f['numero'], 'titulo' => $f['titulo'], 'segundos' => (int)$f['segundos'], 'duracion' => (int)$f['duracion'],
                'visto' => (int)$f['visto'] === 1, 'fecha' => $f['actualizado'],
                'miniatura' => $f['miniatura'] !== '' ? 'media.php?t=miniatura&id=' . $f['id'] : '',
            ], filas('SELECT e.*, s.titulo AS serie, p.segundos, p.visto, p.actualizado FROM anime_progreso p
                       JOIN anime_episodios e ON e.id=p.episodio_id JOIN anime_series s ON s.id=e.serie_id
                       WHERE p.cuenta_id=? ORDER BY p.actualizado DESC LIMIT 60', [$cid]))]);
    }
    json_error('Acción desconocida', 404);
} catch (Throwable $e) {
    error_log('[aninube] ' . $e->getMessage());
    json_error('Error del servidor', 500);
}
