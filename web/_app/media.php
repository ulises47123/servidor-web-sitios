<?php
/** Resuelve que archivo multimedia corresponde a (tipo, id). Lo usan los sitios y el panel. */
declare(strict_types=1);

require_once __DIR__ . '/musica.php';
require_once __DIR__ . '/anime.php';

/** Devuelve [ruta relativa a _datos/media, mime] o null. */
function media_resolver(string $t, int $id): ?array
{
    $img = fn(string $f) => MIME_IMAGEN[strtolower(pathinfo($f, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    switch ($t) {
        case 'audio':
            $p = fila('SELECT archivo, mime FROM musica_pistas WHERE id=?', [$id]);
            return $p && $p['archivo'] !== '' ? ['musica/audio/' . $p['archivo'], $p['mime']] : null;
        case 'cover':   // portada de cancion
            $p = fila('SELECT portada FROM musica_pistas WHERE id=?', [$id]);
            return $p && $p['portada'] !== '' ? ['musica/portadas/' . $p['portada'], $img($p['portada'])] : null;
        case 'letra':
            $p = fila('SELECT letra FROM musica_pistas WHERE id=?', [$id]);
            return $p && $p['letra'] !== '' ? ['musica/letras/' . $p['letra'], 'text/plain; charset=utf-8'] : null;
        case 'portada': // portada de serie
        case 'banner':
            $s = fila("SELECT $t AS f FROM anime_series WHERE id=?", [$id]);
            return $s && $s['f'] !== '' ? ["anime/{$t}s/" . $s['f'], $img($s['f'])] : null;
        case 'video':
            $e = fila('SELECT archivo, mime FROM anime_episodios WHERE id=?', [$id]);
            return $e && $e['archivo'] !== '' ? ['anime/episodios/' . $e['archivo'], $e['mime']] : null;
        case 'miniatura':
            $e = fila('SELECT miniatura FROM anime_episodios WHERE id=?', [$id]);
            return $e && $e['miniatura'] !== '' ? ['anime/miniaturas/' . $e['miniatura'], $img($e['miniatura'])] : null;
    }
    return null;
}

/** Atiende media.php?t=..&id=.. limitado a los tipos permitidos. */
function media_atender(array $tipos): never
{
    $t = (string)($_GET['t'] ?? '');
    $id = (int)($_GET['id'] ?? 0);
    if (!in_array($t, $tipos, true) || $id < 1) {
        http_response_code(404);
        exit;
    }
    $r = media_resolver($t, $id);
    if (!$r) {
        http_response_code(404);
        exit;
    }
    servir_media($r[0], $r[1]);
}
