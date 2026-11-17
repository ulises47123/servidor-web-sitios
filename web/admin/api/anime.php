<?php
/** API: catalogo de anime (AniNube). Series, imagenes y episodios (subida por partes). */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/admin_auth.php';
require_once __DIR__ . '/../../_app/anime.php';
require_once __DIR__ . '/../../_app/subidas.php';
require_once __DIR__ . '/../../_app/indexador.php';

function reindexar_anime(): void
{
    if (sitio_obtener('aninube')) {
        indexar_anime();
    }
}

function serie_existe(int $id): array
{
    $s = fila('SELECT * FROM anime_series WHERE id=?', [$id]);
    if (!$s) {
        throw new InvalidArgumentException('No existe la serie');
    }
    return $s;
}

function datos_serie(): array
{
    $titulo = ent_str('titulo', '', 200);
    if ($titulo === '') {
        throw new InvalidArgumentException('Falta el título');
    }
    $estado = ent_str('estado', 'emision', 16);
    if (!isset(ESTADOS_ANIME[$estado])) {
        $estado = 'emision';
    }
    $anio = ent_int('anio');
    return [
        $titulo,
        ent_str('titulo_alt', '', 200),
        ent_str('sinopsis', '', 5000),
        ($anio >= 1950 && $anio <= 2100) ? $anio : null,
        $estado,
        ent_bool('destacada') ? 1 : 0,
    ];
}

admin_despachar([
    'listar' => fn(): array => [
        'series' => filas('SELECT s.*, (SELECT COUNT(*) FROM anime_episodios e WHERE e.serie_id=s.id) AS n_eps,
                                  (SELECT GROUP_CONCAT(genero ORDER BY genero SEPARATOR ", ") FROM anime_generos g WHERE g.serie_id=s.id) AS generos
                           FROM anime_series s ORDER BY s.titulo'),
        'generos' => GENEROS_ANIME,
        'estados' => ESTADOS_ANIME,
    ],

    'serie' => function (): array {
        $s = serie_existe(ent_int('id'));
        $s['generos'] = anime_generos_de((int)$s['id']);
        $eps = filas('SELECT * FROM anime_episodios WHERE serie_id=? ORDER BY temporada, numero', [(int)$s['id']]);
        foreach ($eps as &$e) {
            $e['tamano'] = bytes_legibles((int)$e['bytes']);
        }
        return ['serie' => $s, 'episodios' => $eps];
    },

    'crear' => function (string $yo): array {
        q('INSERT INTO anime_series (titulo, titulo_alt, sinopsis, anio, estado, destacada) VALUES (?,?,?,?,?,?)', datos_serie());
        $id = ultimo_id();
        anime_guardar_generos($id, (array)(entrada()['generos'] ?? []));
        registrar('anime_serie_creada', "#$id " . ent_str('titulo', '', 120), $yo);
        reindexar_anime();
        return ['id' => $id];
    },

    'editar' => function (string $yo): array {
        $id = ent_int('id');
        serie_existe($id);
        q('UPDATE anime_series SET titulo=?, titulo_alt=?, sinopsis=?, anio=?, estado=?, destacada=? WHERE id=?', [...datos_serie(), $id]);
        anime_guardar_generos($id, (array)(entrada()['generos'] ?? []));
        registrar('anime_serie_editada', "#$id " . ent_str('titulo', '', 120), $yo);
        reindexar_anime();
        return [];
    },

    'imagen' => function (string $yo): array {
        $id = (int)($_POST['id'] ?? 0);
        $tipo = (string)($_POST['tipo'] ?? '');
        if (!in_array($tipo, ['portada', 'banner'], true)) {
            throw new InvalidArgumentException('Tipo de imagen inválido');
        }
        serie_existe($id);
        $nombre = guardar_imagen_subida($_FILES['imagen'] ?? [], ANIME_DIR . '/' . $tipo . 's', (string)$id);
        q("UPDATE anime_series SET $tipo=? WHERE id=?", [$nombre, $id]);
        registrar('anime_' . $tipo, "#$id", $yo);
        return [];
    },

    'borrar' => function (string $yo): array {
        $id = ent_int('id');
        $s = serie_existe($id);
        if (ent_str('confirmar', '', 200) !== $s['titulo']) {
            throw new InvalidArgumentException('Para borrar, escribí exactamente el título de la serie.');
        }
        anime_borrar_serie($id);
        registrar('anime_serie_borrada', "#$id " . $s['titulo'], $yo);
        reindexar_anime();
        return [];
    },

    // ---- episodios ----
    'subida_iniciar' => function (): array {
        serie_existe(ent_int('serie_id'));
        return ['id' => subida_iniciar('episodio', ent_str('nombre', '', 200), ent_int('tamano'), [])];
    },
    'subida_parte' => fn(): array => [
        'recibido' => subida_parte((string)($_POST['id'] ?? ''), (int)($_POST['offset'] ?? -1), $_FILES['parte'] ?? []),
    ],
    'subida_cancelar' => function (): array {
        subida_cancelar(ent_str('id', '', 32));
        return [];
    },
    'subida_finalizar' => function (string $yo): array {
        $serie = ent_int('serie_id');
        serie_existe($serie);
        $temp = max(1, ent_int('temporada', 1));
        $num = ent_int('numero');
        if ($num < 1) {
            throw new InvalidArgumentException('Número de episodio inválido');
        }
        if (valor('SELECT id FROM anime_episodios WHERE serie_id=? AND temporada=? AND numero=?', [$serie, $temp, $num])) {
            throw new InvalidArgumentException("Ya existe el episodio $num de la temporada $temp");
        }
        [$tmp, $info] = subida_finalizar(ent_str('id', '', 32));
        asegurar_dir(ANIME_DIR . '/episodios');
        q('INSERT INTO anime_episodios (serie_id, temporada, numero, titulo, archivo, mime, duracion, bytes) VALUES (?,?,?,?,?,?,?,?)',
            [$serie, $temp, $num, ent_str('titulo', '', 200), '', $info['mime'], max(0, ent_int('duracion')), (int)$info['tamano']]);
        $eid = ultimo_id();
        $archivo = "$eid." . $info['ext'];
        if (!rename($tmp, ANIME_DIR . "/episodios/$archivo")) {
            q('DELETE FROM anime_episodios WHERE id=?', [$eid]);
            throw new RuntimeException('No se pudo guardar el video');
        }
        q('UPDATE anime_episodios SET archivo=? WHERE id=?', [$archivo, $eid]);
        // miniatura capturada en el navegador (opcional)
        $mini = (string)(entrada()['miniatura'] ?? '');
        if (preg_match('~^data:image/(jpeg|png|webp);base64,(.+)$~', $mini, $m)) {
            $bytes = (string)base64_decode($m[2], true);
            $t = tempnam(sys_get_temp_dir(), 'min');
            file_put_contents($t, $bytes);
            if (($ext = tipo_imagen_real($t)) && strlen($bytes) < 2 * 1024 * 1024) {
                asegurar_dir(ANIME_DIR . '/miniaturas');
                rename($t, ANIME_DIR . "/miniaturas/$eid.$ext");
                q('UPDATE anime_episodios SET miniatura=? WHERE id=?', ["$eid.$ext", $eid]);
            } else {
                @unlink($t);
            }
        }
        q('UPDATE anime_series SET actualizado=NOW() WHERE id=?', [$serie]);
        registrar('anime_episodio_subido', "serie #$serie T$temp E$num", $yo);
        reindexar_anime();
        return ['id' => $eid];
    },

    'episodio_editar' => function (string $yo): array {
        $id = ent_int('id');
        $e = fila('SELECT * FROM anime_episodios WHERE id=?', [$id]);
        if (!$e) {
            throw new InvalidArgumentException('No existe el episodio');
        }
        $temp = max(1, ent_int('temporada', (int)$e['temporada']));
        $num = max(1, ent_int('numero', (int)$e['numero']));
        if (valor('SELECT id FROM anime_episodios WHERE serie_id=? AND temporada=? AND numero=? AND id<>?', [(int)$e['serie_id'], $temp, $num, $id])) {
            throw new InvalidArgumentException("Ya existe el episodio $num de la temporada $temp");
        }
        q('UPDATE anime_episodios SET temporada=?, numero=?, titulo=? WHERE id=?', [$temp, $num, ent_str('titulo', '', 200), $id]);
        registrar('anime_episodio_editado', "#$id", $yo);
        reindexar_anime();
        return [];
    },

    'episodio_borrar' => function (string $yo): array {
        $e = anime_borrar_episodio(ent_int('id'));
        if (!$e) {
            throw new InvalidArgumentException('No existe el episodio');
        }
        registrar('anime_episodio_borrado', 'serie #' . $e['serie_id'] . ' T' . $e['temporada'] . ' E' . $e['numero'], $yo);
        reindexar_anime();
        return [];
    },
]);
