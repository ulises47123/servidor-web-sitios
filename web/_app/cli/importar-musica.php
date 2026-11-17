<?php
/**
 * Importa canciones de una carpeta (formato viejo de TS_LINE: audio + <archivo>.meta.json
 * con title/artist/cover(data URL)/genero). Copia los archivos; no borra el origen.
 * Uso:  php _app/cli/importar-musica.php <carpeta>
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}
require_once __DIR__ . '/../musica.php';
require_once __DIR__ . '/../indexador.php';

$dir = $argv[1] ?? '';
if (!is_dir($dir)) {
    fwrite(STDERR, "Uso: php importar-musica.php <carpeta>\n");
    exit(1);
}
$n = 0;
foreach (scandir($dir) ?: [] as $f) {
    $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
    if (!isset(MIME_AUDIO[$ext]) || !is_file("$dir/$f")) {
        continue;
    }
    $base = pathinfo($f, PATHINFO_FILENAME);
    $meta = [];
    if (is_file("$dir/$f.meta.json")) {
        $meta = json_decode((string)file_get_contents("$dir/$f.meta.json"), true) ?: [];
    }
    // titulo: metadato o nombre limpio (sin el [ID] de YouTube)
    $titulo = trim((string)($meta['title'] ?? ''));
    if ($titulo === '') {
        $titulo = trim(preg_replace('/\s*[\[\(_][A-Za-z0-9_\-]{6,}[\]\)_]\s*$/u', '', $base) ?? $base);
    }
    $artista = trim((string)($meta['artist'] ?? ''));
    if ($artista === '' && str_contains($titulo, ' - ')) {
        [$artista, $titulo] = array_map('trim', explode(' - ', $titulo, 2));
    }
    // limpiar marcas tipicas de YouTube y el artista repetido al principio
    $titulo = trim(preg_replace('/\s*[\(\[](official\s*(music\s*)?video|video\s*oficial|lyric\s*video|audio\s*oficial|official\s*audio)[\)\]]\s*/iu', ' ', $titulo) ?? $titulo);
    if ($artista !== '' && mb_stripos($titulo, $artista . ' - ') === 0) {
        $titulo = trim(mb_substr($titulo, mb_strlen($artista) + 3));
    }
    if (valor('SELECT COUNT(*) FROM musica_pistas WHERE titulo=? AND artista=?', [$titulo, $artista])) {
        echo "Ya existe: $titulo\n";
        continue;
    }
    // duracion con ffprobe si esta instalado (si no, la calcula el reproductor)
    $duracion = 0;
    $fp = trim((string)@shell_exec('ffprobe -v error -show_entries format=duration -of csv=p=0 ' . escapeshellarg("$dir/$f") . ' 2>' . (DIRECTORY_SEPARATOR === '/' ? '/dev/null' : 'NUL')));
    if (is_numeric($fp)) {
        $duracion = (int)round((float)$fp);
    }
    $tmp = tempnam(sys_get_temp_dir(), 'imp');
    copy("$dir/$f", $tmp);
    $id = musica_alta($tmp, $ext, [
        'titulo' => $titulo,
        'artista' => $artista,
        'duracion' => $duracion,
        'genero' => in_array($meta['genero'] ?? '', GENEROS_MUSICA, true) ? $meta['genero'] : 'Otros',
    ]);
    $cover = (string)($meta['cover'] ?? '');
    if (preg_match('~^data:image/[a-z+]+;base64,(.+)$~i', $cover, $m)) {
        musica_portada_bytes($id, (string)base64_decode($m[1]));
    }
    echo "Importada #$id: $titulo" . ($artista ? " – $artista" : '') . "\n";
    $n++;
}
if ($n && sitio_obtener('tsline')) {
    indexar_sitio('tsline');
}
echo "$n canciones importadas.\n";
