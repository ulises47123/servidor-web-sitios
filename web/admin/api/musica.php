<?php
/** API: biblioteca de musica (TS_LINE). Alta por partes, edicion, portada, letra, baja. */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/admin_auth.php';
require_once __DIR__ . '/../../_app/musica.php';
require_once __DIR__ . '/../../_app/subidas.php';
require_once __DIR__ . '/../../_app/indexador.php';

function reindexar_musica(): void
{
    if (sitio_obtener('tsline')) {
        indexar_musica();
    }
}

admin_despachar([
    'listar' => fn(): array => [
        'pistas' => array_map(fn($p) => $p + ['tamano' => bytes_legibles((int)$p['bytes'])],
            filas('SELECT id, titulo, artista, album, genero, duracion, portada, letra, bytes, reproducciones, subido, mime FROM musica_pistas ORDER BY subido DESC, id DESC')),
        'generos' => GENEROS_MUSICA,
    ],

    // ---- subida por partes ----
    'subida_iniciar' => fn(): array => [
        'id' => subida_iniciar('musica', ent_str('nombre', '', 200), ent_int('tamano'), []),
    ],
    'subida_parte' => fn(): array => [
        'recibido' => subida_parte((string)($_POST['id'] ?? ''), (int)($_POST['offset'] ?? -1), $_FILES['parte'] ?? []),
    ],
    'subida_cancelar' => function (): array {
        subida_cancelar(ent_str('id', '', 32));
        return [];
    },
    'subida_finalizar' => function (string $yo): array {
        [$tmp, $info] = subida_finalizar(ent_str('id', '', 32));
        $id = musica_alta($tmp, $info['ext'], [
            'titulo'   => ent_str('titulo', '', 200) ?: pathinfo($info['nombre'], PATHINFO_FILENAME),
            'artista'  => ent_str('artista', '', 160),
            'album'    => ent_str('album', '', 160),
            'genero'   => ent_str('genero', 'Otros', 60),
            'duracion' => ent_int('duracion'),
        ]);
        $cover = (string)(entrada()['portada'] ?? '');
        if (preg_match('~^data:image/[a-z+.-]+;base64,(.+)$~i', $cover, $m)) {
            musica_portada_bytes($id, (string)base64_decode($m[1], true));
        }
        registrar('musica_subida', "#$id " . ent_str('titulo', '', 120), $yo);
        reindexar_musica();
        return ['id' => $id];
    },

    'editar' => function (string $yo): array {
        $id = ent_int('id');
        $titulo = ent_str('titulo', '', 200);
        if ($titulo === '') {
            throw new InvalidArgumentException('El título no puede quedar vacío');
        }
        $genero = ent_str('genero', 'Otros', 60);
        if (!in_array($genero, GENEROS_MUSICA, true)) {
            $genero = 'Otros';
        }
        if (!ejecutar('UPDATE musica_pistas SET titulo=?, artista=?, album=?, genero=? WHERE id=?',
            [$titulo, ent_str('artista', '', 160), ent_str('album', '', 160), $genero, $id])
            && !valor('SELECT id FROM musica_pistas WHERE id=?', [$id])) {
            throw new InvalidArgumentException('No existe la canción');
        }
        registrar('musica_editada', "#$id $titulo", $yo);
        reindexar_musica();
        return [];
    },

    'portada' => function (string $yo): array {
        $id = (int)($_POST['id'] ?? 0);
        if (!valor('SELECT id FROM musica_pistas WHERE id=?', [$id])) {
            throw new InvalidArgumentException('No existe la canción');
        }
        $nombre = guardar_imagen_subida($_FILES['imagen'] ?? [], MUSICA_DIR . '/portadas', (string)$id);
        q('UPDATE musica_pistas SET portada=? WHERE id=?', [$nombre, $id]);
        registrar('musica_portada', "#$id", $yo);
        return [];
    },

    'letra' => function (string $yo): array {
        $id = (int)($_POST['id'] ?? 0);
        if (!valor('SELECT id FROM musica_pistas WHERE id=?', [$id])) {
            throw new InvalidArgumentException('No existe la canción');
        }
        $f = $_FILES['letra'] ?? [];
        if (($f['error'] ?? 1) !== UPLOAD_ERR_OK || (int)$f['size'] > 256 * 1024) {
            throw new InvalidArgumentException('Archivo de letra inválido (máx. 256 KB)');
        }
        $txt = (string)file_get_contents($f['tmp_name']);
        if (!mb_check_encoding($txt, 'UTF-8')) {
            $txt = mb_convert_encoding($txt, 'UTF-8', 'ISO-8859-1');
        }
        if (!preg_match('/\[\d{1,2}:\d{2}/', $txt)) {
            throw new InvalidArgumentException('No parece un .lrc (faltan marcas de tiempo [mm:ss])');
        }
        asegurar_dir(MUSICA_DIR . '/letras');
        file_put_contents(MUSICA_DIR . "/letras/$id.lrc", $txt);
        q('UPDATE musica_pistas SET letra=? WHERE id=?', ["$id.lrc", $id]);
        registrar('musica_letra', "#$id", $yo);
        return [];
    },

    'quitar_letra' => function (string $yo): array {
        $id = ent_int('id');
        @unlink(MUSICA_DIR . "/letras/$id.lrc");
        q("UPDATE musica_pistas SET letra='' WHERE id=?", [$id]);
        registrar('musica_letra_quitada', "#$id", $yo);
        return [];
    },

    'borrar' => function (string $yo): array {
        $p = musica_borrar(ent_int('id'));
        if (!$p) {
            throw new InvalidArgumentException('No existe la canción');
        }
        registrar('musica_borrada', '#' . $p['id'] . ' ' . $p['titulo'], $yo);
        reindexar_musica();
        return [];
    },
]);
