<?php
/**
 * Indexador de Good.
 * - Paginas: recorre los .html de cada sitio activo (titulo, description, h1-h3, texto).
 * - AniNube: cada serie es un resultado (tipo anime).
 * - TS_LINE: cada cancion es un resultado (tipo musica).
 * Sin dependencias (no requiere la extension dom).
 */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';
require_once __DIR__ . '/sitios.php';

const IDX_MAX_ARCHIVOS = 3000;
const IDX_MAX_PROF     = 6;
const IDX_MAX_BYTES    = 2 * 1024 * 1024;
const IDX_MAX_TEXTO    = 60000;

/** Extrae titulo, descripcion y texto visible de un HTML. */
function extraer_html(string $html): array
{
    $titulo = '';
    if (preg_match('~<title[^>]*>(.*?)</title>~is', $html, $m)) {
        $titulo = limpiar_texto($m[1]);
    }
    $desc = '';
    if (preg_match_all('~<meta\b[^>]*>~i', $html, $metas)) {
        foreach ($metas[0] as $tag) {
            if (preg_match('~\bname\s*=\s*["\']?description["\']?~i', $tag)
                && preg_match('~\bcontent\s*=\s*("([^"]*)"|\'([^\']*)\')~i', $tag, $c)) {
                $desc = limpiar_texto(($c[2] ?? '') !== '' ? $c[2] : ($c[3] ?? ''));
                break;
            }
        }
    }
    $cuerpo = preg_match('~<body\b[^>]*>(.*)</body>~is', $html, $b) ? $b[1] : $html;
    // fuera lo que no es texto visible
    $cuerpo = preg_replace('~<(script|style|noscript|svg|template|iframe|canvas)\b.*?</\1>~is', ' ', $cuerpo) ?? '';
    $cuerpo = preg_replace('~<!--.*?-->~s', ' ', $cuerpo) ?? '';
    $titulos = [];
    if (preg_match_all('~<h([1-3])\b[^>]*>(.*?)</h\1>~is', $cuerpo, $hs)) {
        foreach ($hs[2] as $t) {
            $t = limpiar_texto($t);
            if ($t !== '') {
                $titulos[] = $t;
            }
        }
    }
    // separar bloques para que no se peguen palabras
    $cuerpo = preg_replace('~<(br|/p|/div|/li|/h\d|/tr|/td|/th|/section|/article|/header|/footer|/dd|/dt)\b[^>]*>~i', "\n", $cuerpo) ?? '';
    $texto = limpiar_texto(strip_tags($cuerpo));
    if ($titulo === '' && $titulos) {
        $titulo = $titulos[0];
    }
    if ($desc === '') {
        $desc = mb_substr($texto, 0, 200);
    }
    $contenido = implode(' · ', array_unique($titulos)) . "\n" . $texto;
    return [
        'titulo'      => mb_substr($titulo, 0, 255),
        'descripcion' => mb_substr($desc, 0, 512),
        'contenido'   => mb_substr($contenido, 0, IDX_MAX_TEXTO),
    ];
}

function limpiar_texto(string $s): string
{
    $s = html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
    return trim($s);
}

function idx_guardar(string $sitio, string $tipo, string $url, string $titulo, string $desc, string $contenido): void
{
    q(
        'INSERT INTO good_paginas (sitio, tipo, url, titulo, descripcion, contenido, actualizado)
         VALUES (?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE sitio=VALUES(sitio), tipo=VALUES(tipo), titulo=VALUES(titulo),
           descripcion=VALUES(descripcion), contenido=VALUES(contenido), actualizado=NOW()',
        [$sitio, $tipo, mb_substr($url, 0, 512), mb_substr($titulo, 0, 255), mb_substr($desc, 0, 512), $contenido]
    );
}

/** Recorre una carpeta y devuelve rutas relativas de .html. */
function idx_listar_html(string $base, string $rel = '', int $prof = 0, int &$cuenta = 0): array
{
    $out = [];
    if ($prof > IDX_MAX_PROF) {
        return $out;
    }
    $dir = $rel === '' ? $base : "$base/$rel";
    foreach (scandir($dir) ?: [] as $f) {
        if ($f === '' || $f[0] === '.' || $f[0] === '_' || $f === 'node_modules') {
            continue;
        }
        if (++$cuenta > IDX_MAX_ARCHIVOS) {
            break;
        }
        $r = $rel === '' ? $f : "$rel/$f";
        $abs = "$base/$r";
        if (is_link($abs)) {
            continue;
        }
        if (is_dir($abs)) {
            array_push($out, ...idx_listar_html($base, $r, $prof + 1, $cuenta));
        } elseif (preg_match('/\.html?$/i', $f) && filesize($abs) <= IDX_MAX_BYTES) {
            $out[] = $r;
        }
    }
    return $out;
}

function idx_url(string $slug, string $rel): string
{
    $rel = preg_replace('~(^|/)index\.html?$~i', '$1', $rel) ?? $rel;
    $partes = array_map('rawurlencode', array_filter(explode('/', $rel), 'strlen'));
    $url = "/sitios/$slug/" . implode('/', $partes);
    if ($rel === '' || str_ends_with($rel, '/')) {
        $url = rtrim($url, '/') . '/';
    }
    return $url;
}

/** Reindexa un sitio completo. Devuelve cantidad de entradas. */
function indexar_sitio(string $slug): int
{
    $s = sitio_obtener($slug);
    if (!$s) {
        return 0;
    }
    $dir = sitio_dir($slug);
    q('DELETE FROM good_paginas WHERE sitio=?', [$slug]);
    if (!is_dir($dir)) {
        return 0;
    }
    $n = 0;
    $tiene_raiz = false;
    foreach (idx_listar_html($dir) as $rel) {
        $e = extraer_html((string)file_get_contents("$dir/$rel"));
        $url = idx_url($slug, $rel);
        if ($url === "/sitios/$slug/") {
            $tiene_raiz = true;
        }
        idx_guardar($slug, 'pagina', $url, $e['titulo'] ?: $s['nombre'], $e['descripcion'], $e['contenido']);
        $n++;
    }
    // sitios dinamicos (index.php): una entrada para la portada con los datos del registro
    if (!$tiene_raiz) {
        $g = sitio_good_json($dir);
        $extra = is_array($g['palabras'] ?? null) ? implode(' ', $g['palabras']) : '';
        idx_guardar($slug, 'pagina', "/sitios/$slug/", $s['nombre'], $s['descripcion'],
            $s['nombre'] . ' ' . $s['categoria'] . ' ' . $s['descripcion'] . ' ' . $extra);
        $n++;
    }
    if ($slug === 'aninube') {
        $n += indexar_anime();
    } elseif ($slug === 'tsline') {
        $n += indexar_musica();
    }
    q('UPDATE sitios SET indexado_en=NOW() WHERE slug=?', [$slug]);
    return $n;
}

function indexar_anime(): int
{
    q("DELETE FROM good_paginas WHERE sitio='aninube' AND tipo='anime'");
    $n = 0;
    foreach (filas('SELECT * FROM anime_series') as $a) {
        $gen = array_column(filas('SELECT genero FROM anime_generos WHERE serie_id=?', [(int)$a['id']]), 'genero');
        $eps = array_column(filas('SELECT titulo FROM anime_episodios WHERE serie_id=? ORDER BY temporada, numero', [(int)$a['id']]), 'titulo');
        $desc = mb_substr(limpiar_texto($a['sinopsis']), 0, 300);
        $info = trim(($a['anio'] ? $a['anio'] . ' · ' : '') . implode(', ', $gen));
        idx_guardar('aninube', 'anime', '/sitios/aninube/#/serie/' . $a['id'], $a['titulo'],
            $info !== '' ? "$info — $desc" : $desc,
            $a['titulo'] . ' ' . $a['titulo_alt'] . ' anime ' . implode(' ', $gen) . ' ' . $a['sinopsis'] . ' ' . implode(' ', $eps));
        $n++;
    }
    return $n;
}

function indexar_musica(): int
{
    q("DELETE FROM good_paginas WHERE sitio='tsline' AND tipo='musica'");
    $n = 0;
    foreach (filas('SELECT * FROM musica_pistas') as $p) {
        $titulo = $p['titulo'] . ($p['artista'] !== '' ? ' – ' . $p['artista'] : '');
        $desc = 'Canción' . ($p['artista'] !== '' ? ' de ' . $p['artista'] : '')
            . ($p['album'] !== '' ? ' · ' . $p['album'] : '') . ' · ' . $p['genero'];
        idx_guardar('tsline', 'musica', '/sitios/tsline/#/pista/' . $p['id'], $titulo, $desc,
            $p['titulo'] . ' ' . $p['artista'] . ' ' . $p['album'] . ' ' . $p['genero'] . ' música canción');
        $n++;
    }
    return $n;
}

/** Detecta carpetas nuevas y reindexa todo. */
function indexar_todo(): array
{
    $det = sitios_detectar();
    $res = [];
    foreach (sitios_listar() as $s) {
        $res[$s['slug']] = (int)$s['activa'] === 1 ? indexar_sitio($s['slug']) : 0;
        if ((int)$s['activa'] !== 1) {
            q('DELETE FROM good_paginas WHERE sitio=?', [$s['slug']]);
        }
    }
    // entradas de sitios que ya no existen
    q('DELETE FROM good_paginas WHERE sitio NOT IN (SELECT slug FROM sitios)');
    return ['sitios' => $res, 'detectados' => $det];
}
