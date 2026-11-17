<?php
/** Dominio de musica (TS_LINE): lo usan el panel (alta/baja) y el sitio (escuchar). */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';

const MUSICA_DIR = MEDIA_DIR . '/musica';
const GENEROS_MUSICA = ['Pop', 'Rock', 'Hip-Hop', 'Reggaetón', 'Electrónica', 'Cumbia', 'Cuarteto', 'Trap', 'Indie',
    'Jazz', 'Clásica', 'Folklore', 'Tango', 'Metal', 'R&B', 'Soundtrack', 'Lo-fi', 'Otros'];

function musica_pista_publica(array $p): array
{
    return [
        'id'       => (int)$p['id'],
        'titulo'   => $p['titulo'],
        'artista'  => $p['artista'],
        'album'    => $p['album'],
        'genero'   => $p['genero'],
        'duracion' => (int)$p['duracion'],
        'portada'  => $p['portada'] !== '' ? 'media.php?t=cover&id=' . $p['id'] . '&v=' . rawurlencode($p['portada']) : '',
        'letra'    => $p['letra'] !== '',
        'audio'    => 'media.php?t=audio&id=' . $p['id'],
        'reproducciones' => (int)$p['reproducciones'],
        'subido'   => $p['subido'],
    ];
}

/** Da de alta una pista a partir de un archivo ya en disco (se mueve a media/musica/audio). */
function musica_alta(string $archivo_tmp, string $ext, array $m, bool $mover_subido = false): int
{
    if (!isset(MIME_AUDIO[$ext])) {
        throw new InvalidArgumentException('Formato de audio no permitido');
    }
    asegurar_dir(MUSICA_DIR . '/audio');
    $titulo = mb_substr(trim((string)($m['titulo'] ?? '')), 0, 200) ?: 'Sin título';
    $genero = in_array($m['genero'] ?? '', GENEROS_MUSICA, true) ? $m['genero'] : 'Otros';
    q(
        'INSERT INTO musica_pistas (archivo, mime, titulo, artista, album, genero, duracion, bytes) VALUES (?,?,?,?,?,?,?,?)',
        ['', MIME_AUDIO[$ext], $titulo, mb_substr(trim((string)($m['artista'] ?? '')), 0, 160),
            mb_substr(trim((string)($m['album'] ?? '')), 0, 160), $genero, max(0, (int)($m['duracion'] ?? 0)), (int)filesize($archivo_tmp)]
    );
    $id = ultimo_id();
    $nombre = "$id.$ext";
    $ok = $mover_subido ? move_uploaded_file($archivo_tmp, MUSICA_DIR . "/audio/$nombre") : rename($archivo_tmp, MUSICA_DIR . "/audio/$nombre");
    if (!$ok) {
        q('DELETE FROM musica_pistas WHERE id=?', [$id]);
        throw new RuntimeException('No se pudo guardar el audio');
    }
    q('UPDATE musica_pistas SET archivo=? WHERE id=?', [$nombre, $id]);
    return $id;
}

/** Guarda la portada desde bytes (ej. la imagen embebida en el ID3 que manda el navegador). */
function musica_portada_bytes(int $id, string $bytes): void
{
    $tmp = tempnam(sys_get_temp_dir(), 'por');
    file_put_contents($tmp, $bytes);
    $ext = tipo_imagen_real($tmp);
    if ($ext === null || strlen($bytes) > 8 * 1024 * 1024) {
        @unlink($tmp);
        return;
    }
    asegurar_dir(MUSICA_DIR . '/portadas');
    foreach (glob(MUSICA_DIR . "/portadas/$id.*") ?: [] as $v) {
        @unlink($v);
    }
    rename($tmp, MUSICA_DIR . "/portadas/$id.$ext");
    q('UPDATE musica_pistas SET portada=? WHERE id=?', ["$id.$ext", $id]);
}

function musica_borrar(int $id): ?array
{
    $p = fila('SELECT * FROM musica_pistas WHERE id=?', [$id]);
    if (!$p) {
        return null;
    }
    foreach (['audio' => $p['archivo'], 'portadas' => $p['portada'], 'letras' => $p['letra']] as $sub => $f) {
        if ($f !== '') {
            @unlink(MUSICA_DIR . "/$sub/$f");
        }
    }
    q('DELETE FROM musica_pistas WHERE id=?', [$id]);
    return $p;
}
