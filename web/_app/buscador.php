<?php
/** Motor de busqueda de Good (FULLTEXT + empuje por titulo + fragmentos resaltados). */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';

const GOOD_POR_PAGINA = 10;
const GOOD_TIPOS = ['todo' => 'Todo', 'pagina' => 'Páginas', 'anime' => 'Anime', 'musica' => 'Música'];

/** Palabras de la consulta (sin operadores, en minusculas, max 10). */
function good_terminos(string $q): array
{
    $q = mb_strtolower($q);
    $q = preg_replace('/[^\p{L}\p{N}\s\'-]+/u', ' ', $q) ?? '';
    $t = array_values(array_unique(array_filter(preg_split('/\s+/u', trim($q)) ?: [], fn($w) => mb_strlen($w) >= 1)));
    return array_slice($t, 0, 10);
}

/** Filtro de visibilidad segun la puerta: por internet solo sitios publicos. */
function good_filtro_visible(): string
{
    return 's.activa=1' . (alcance() === 'publico' ? ' AND s.publica=1' : '');
}

/**
 * Busca. Devuelve ['total'=>int, 'resultados'=>[...], 'por_tipo'=>[tipo=>n]].
 */
function good_buscar(string $q, string $tipo = 'todo', int $pagina = 1): array
{
    $terms = good_terminos($q);
    if (!$terms) {
        return ['total' => 0, 'resultados' => [], 'por_tipo' => []];
    }
    $largos = array_filter($terms, fn($w) => mb_strlen($w) >= 3);
    $bool = implode(' ', array_map(fn($w) => preg_replace('/[\'-]/', ' ', $w) . '*', $largos));

    $cond = [];
    $params = [];
    $relSql = '0';
    if ($bool !== '') {
        $relSql = 'MATCH(p.titulo, p.descripcion, p.contenido) AGAINST (? IN BOOLEAN MODE)';
        $cond[] = 'MATCH(p.titulo, p.descripcion, p.contenido) AGAINST (? IN BOOLEAN MODE)';
    }
    foreach ($terms as $w) {
        $cond[] = 'p.titulo LIKE ?';
        $cond[] = 'p.descripcion LIKE ?';
    }
    $sql = "SELECT p.id, p.sitio, p.tipo, p.url, p.titulo, p.descripcion, s.nombre AS sitio_nombre, s.icono, s.color, s.publica,
                   $relSql AS rel
            FROM good_paginas p JOIN sitios s ON s.slug = p.sitio
            WHERE " . good_filtro_visible() . ' AND (' . implode(' OR ', $cond) . ')
            LIMIT 400';
    if ($bool !== '') {
        $params[] = $bool;
        $params[] = $bool;
    }
    foreach ($terms as $w) {
        $like = '%' . addcslashes($w, '%_\\') . '%';
        $params[] = $like;
        $params[] = $like;
    }
    $cand = filas($sql, $params);

    // puntaje: relevancia FULLTEXT + coincidencias en titulo/descripcion + frase exacta
    $frase = sin_acentos(mb_strtolower(trim($q)));
    $tn = array_map(fn($w) => sin_acentos($w), $terms);
    foreach ($cand as &$c) {
        $tit = sin_acentos(mb_strtolower($c['titulo']));
        $des = sin_acentos(mb_strtolower($c['descripcion']));
        $s = (float)$c['rel'];
        $todos_en_titulo = true;
        foreach ($tn as $w) {
            $en_t = str_contains($tit, $w);
            $todos_en_titulo = $todos_en_titulo && $en_t;
            if ($en_t) {
                $s += 6 + (preg_match('/(^|[^a-z0-9])' . preg_quote($w, '/') . '/u', $tit) ? 4 : 0);
            }
            if (str_contains($des, $w)) {
                $s += 2;
            }
        }
        if ($todos_en_titulo) {
            $s += 8;
        }
        if (mb_strlen($frase) > 3 && str_contains($tit, $frase)) {
            $s += 12;
        }
        if (str_ends_with($c['url'], '/' . $c['sitio'] . '/')) {
            $s += 1; // portada del sitio, apenas por arriba
        }
        $c['puntaje'] = $s;
    }
    unset($c);
    usort($cand, fn($a, $b) => $b['puntaje'] <=> $a['puntaje']);

    $por_tipo = array_count_values(array_column($cand, 'tipo'));
    if ($tipo !== 'todo' && isset(GOOD_TIPOS[$tipo])) {
        $cand = array_values(array_filter($cand, fn($c) => $c['tipo'] === $tipo));
    }
    $total = count($cand);
    $pagina = max(1, $pagina);
    $sel = array_slice($cand, ($pagina - 1) * GOOD_POR_PAGINA, GOOD_POR_PAGINA);

    // fragmentos solo para los de esta pagina (no se resaltan palabras cortas como "de", "la")
    $terms = array_values(array_filter($terms, fn($w) => mb_strlen($w) >= 3)) ?: $terms;
    if ($sel) {
        $ids = array_column($sel, 'id');
        $cont = array_column(filas('SELECT id, contenido FROM good_paginas WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids), 'contenido', 'id');
        foreach ($sel as &$r) {
            $r['fragmento'] = good_fragmento($cont[$r['id']] ?? '', $r['descripcion'], $terms);
            $r['titulo_html'] = good_resaltar($r['titulo'], $terms);
        }
        unset($r);
    }
    return ['total' => $total, 'resultados' => $sel, 'por_tipo' => $por_tipo];
}

/** Escapa el texto y envuelve en <mark> las palabras buscadas (sin importar tildes). */
function good_resaltar(string $texto, array $terms): string
{
    $norm = sin_acentos(mb_strtolower($texto));
    $marcas = array_fill(0, mb_strlen($texto), false);
    foreach ($terms as $w) {
        $w = sin_acentos($w);
        $lw = mb_strlen($w);
        if ($lw < 2) {
            continue;
        }
        $off = 0;
        while (($p = mb_strpos($norm, $w, $off)) !== false) {
            for ($i = $p; $i < $p + $lw; $i++) {
                $marcas[$i] = true;
            }
            $off = $p + $lw;
        }
    }
    $out = '';
    $abierto = false;
    $n = mb_strlen($texto);
    for ($i = 0; $i < $n; $i++) {
        if ($marcas[$i] && !$abierto) {
            $out .= '<mark>';
            $abierto = true;
        } elseif (!$marcas[$i] && $abierto) {
            $out .= '</mark>';
            $abierto = false;
        }
        $out .= h(mb_substr($texto, $i, 1));
    }
    return $out . ($abierto ? '</mark>' : '');
}

/** Toma ~220 caracteres alrededor de la primera coincidencia. */
function good_fragmento(string $contenido, string $desc, array $terms): string
{
    $contenido = trim(preg_replace('/\s+/u', ' ', $contenido) ?? '');
    $norm = sin_acentos(mb_strtolower($contenido));
    $pos = null;
    foreach ($terms as $w) {
        if (mb_strlen($w) < 2) {
            continue;
        }
        $p = mb_strpos($norm, sin_acentos($w));
        if ($p !== false && ($pos === null || $p < $pos)) {
            $pos = $p;
        }
    }
    // si la descripcion ya tiene la palabra, es mejor resumen
    $dn = sin_acentos(mb_strtolower($desc));
    foreach ($terms as $w) {
        if ($desc !== '' && mb_strlen($w) >= 2 && str_contains($dn, sin_acentos($w))) {
            return good_resaltar(mb_strimwidth($desc, 0, 260, '…'), $terms);
        }
    }
    if ($pos === null) {
        return good_resaltar(mb_strimwidth($desc !== '' ? $desc : $contenido, 0, 240, '…'), $terms);
    }
    $ini = max(0, $pos - 80);
    if ($ini > 0) {
        $esp = mb_strpos($contenido, ' ', $ini);
        $ini = $esp !== false && $esp < $pos ? $esp + 1 : $ini;
    }
    $frag = mb_substr($contenido, $ini, 230);
    $fin = mb_strrpos($frag, ' ');
    if ($fin !== false && $fin > 150) {
        $frag = mb_substr($frag, 0, $fin);
    }
    return ($ini > 0 ? '… ' : '') . good_resaltar($frag, $terms) . ' …';
}

/** Sugerencias de titulos para el autocompletado. */
function good_sugerir(string $q): array
{
    $q = trim($q);
    if (mb_strlen($q) < 2) {
        return [];
    }
    $like = addcslashes($q, '%_\\');
    return array_column(filas(
        'SELECT DISTINCT p.titulo FROM good_paginas p JOIN sitios s ON s.slug=p.sitio
         WHERE ' . good_filtro_visible() . ' AND (p.titulo LIKE ? OR p.titulo LIKE ?)
         ORDER BY (p.titulo LIKE ?) DESC, CHAR_LENGTH(p.titulo) LIMIT 8',
        ["$like%", "% $like%", "$like%"]
    ), 'titulo');
}

function good_azar(): ?string
{
    return valor('SELECT p.url FROM good_paginas p JOIN sitios s ON s.slug=p.sitio WHERE ' . good_filtro_visible() . ' ORDER BY RAND() LIMIT 1');
}
