<?php
/** Dominio de anime (AniNube): todo local, cargado desde el panel. */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';

const ANIME_DIR = MEDIA_DIR . '/anime';
const GENEROS_ANIME = ['Acción', 'Aventura', 'Comedia', 'Drama', 'Fantasía', 'Ciencia ficción', 'Romance', 'Misterio',
    'Terror', 'Deportes', 'Recuentos de la vida', 'Sobrenatural', 'Mecha', 'Música', 'Psicológico', 'Escolar', 'Isekai', 'Shōnen', 'Seinen', 'Shōjo'];
const ESTADOS_ANIME = ['emision' => 'En emisión', 'finalizado' => 'Finalizado', 'proximamente' => 'Próximamente'];

function anime_generos_de(int $id): array
{
    return array_column(filas('SELECT genero FROM anime_generos WHERE serie_id=? ORDER BY genero', [$id]), 'genero');
}

function anime_serie_publica(array $s, bool $con_generos = true): array
{
    $id = (int)$s['id'];
    return [
        'id'        => $id,
        'titulo'    => $s['titulo'],
        'titulo_alt' => $s['titulo_alt'],
        'sinopsis'  => $s['sinopsis'],
        'anio'      => $s['anio'] !== null ? (int)$s['anio'] : null,
        'estado'    => $s['estado'],
        'estado_txt' => ESTADOS_ANIME[$s['estado']] ?? $s['estado'],
        'destacada' => (int)$s['destacada'] === 1,
        'portada'   => $s['portada'] !== '' ? "media.php?t=portada&id=$id&v=" . rawurlencode(substr(md5($s['portada'] . $s['actualizado']), 0, 8)) : '',
        'banner'    => $s['banner'] !== '' ? "media.php?t=banner&id=$id&v=" . rawurlencode(substr(md5($s['banner'] . $s['actualizado']), 0, 8)) : '',
        'generos'   => $con_generos ? anime_generos_de($id) : [],
        'episodios' => isset($s['n_eps']) ? (int)$s['n_eps'] : null,
    ];
}

function anime_episodio_publico(array $e): array
{
    $id = (int)$e['id'];
    return [
        'id'        => $id,
        'serie_id'  => (int)$e['serie_id'],
        'temporada' => (int)$e['temporada'],
        'numero'    => (int)$e['numero'],
        'titulo'    => $e['titulo'],
        'duracion'  => (int)$e['duracion'],
        'miniatura' => $e['miniatura'] !== '' ? "media.php?t=miniatura&id=$id" : '',
        'video'     => "media.php?t=video&id=$id",
        'mime'      => $e['mime'],
    ];
}

function anime_guardar_generos(int $id, array $generos): void
{
    q('DELETE FROM anime_generos WHERE serie_id=?', [$id]);
    foreach (array_unique($generos) as $g) {
        if (in_array($g, GENEROS_ANIME, true)) {
            q('INSERT INTO anime_generos (serie_id, genero) VALUES (?,?)', [$id, $g]);
        }
    }
}

function anime_borrar_serie(int $id): ?array
{
    $s = fila('SELECT * FROM anime_series WHERE id=?', [$id]);
    if (!$s) {
        return null;
    }
    foreach (filas('SELECT id FROM anime_episodios WHERE serie_id=?', [$id]) as $e) {
        anime_borrar_episodio((int)$e['id']);
    }
    foreach (['portadas' => $s['portada'], 'banners' => $s['banner']] as $sub => $f) {
        if ($f !== '') {
            @unlink(ANIME_DIR . "/$sub/$f");
        }
    }
    q('DELETE FROM anime_series WHERE id=?', [$id]);
    return $s;
}

function anime_borrar_episodio(int $id): ?array
{
    $e = fila('SELECT * FROM anime_episodios WHERE id=?', [$id]);
    if (!$e) {
        return null;
    }
    if ($e['archivo'] !== '') {
        @unlink(ANIME_DIR . '/episodios/' . $e['archivo']);
    }
    if ($e['miniatura'] !== '') {
        @unlink(ANIME_DIR . '/miniaturas/' . $e['miniatura']);
    }
    q('DELETE FROM anime_episodios WHERE id=?', [$id]);
    return $e;
}
