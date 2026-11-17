<?php
/** API: sitios alojados, visibilidad e indice de Good. */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/admin_auth.php';
require_once __DIR__ . '/../../_app/indexador.php';

function sitio_para_panel(array $s): array
{
    $dir = SITIOS_DIR . '/' . $s['slug'];
    return $s + [
        'existe'   => is_dir($dir),
        'tiene_index' => is_dir($dir) && sitio_tiene_index($dir),
        'paginas'  => (int)valor('SELECT COUNT(*) FROM good_paginas WHERE sitio=?', [$s['slug']]),
        'url'      => '/sitios/' . $s['slug'] . '/',
        'hex'      => color_hex($s['color']),
    ];
}

admin_despachar([
    'listar' => fn(): array => [
        'sitios' => array_map('sitio_para_panel', sitios_listar()),
        'colores' => COLORES,
    ],

    'crear' => function (string $yo): array {
        $slug = sitio_crear(entrada(), $yo);
        return ['slug' => $slug];
    },

    'actualizar' => function (string $yo): array {
        $slug = ent_str('slug', '', 48);
        $d = entrada();
        unset($d['slug']);
        sitio_actualizar($slug, $d, $yo);
        // si cambia la visibilidad o el nombre, el indice queda igual pero los filtros cambian solos
        return ['sitio' => sitio_para_panel(sitio_obtener($slug))];
    },

    'borrar' => function (string $yo): array {
        $slug = ent_str('slug', '', 48);
        if (ent_str('confirmar', '', 48) !== $slug) {
            throw new InvalidArgumentException('Para borrar, escribí exactamente el identificador del sitio.');
        }
        sitio_borrar($slug, $yo);
        return [];
    },

    'detectar' => function (string $yo): array {
        return sitios_detectar($yo);
    },

    'reindexar' => function (string $yo): array {
        $slug = ent_str('slug', '', 48);
        if (!sitio_obtener($slug)) {
            throw new InvalidArgumentException('No existe el sitio');
        }
        $n = indexar_sitio($slug);
        registrar('good_reindexar', "$slug ($n)", $yo);
        return ['entradas' => $n];
    },

    'reindexar_todo' => function (string $yo): array {
        $r = indexar_todo();
        registrar('good_reindexar', 'todo (' . array_sum($r['sitios']) . ')', $yo);
        return $r;
    },

    'good_estado' => function (): array {
        return [
            'total' => (int)valor('SELECT COUNT(*) FROM good_paginas'),
            'por_tipo' => filas('SELECT tipo, COUNT(*) n FROM good_paginas GROUP BY tipo'),
            'por_sitio' => filas('SELECT s.slug, s.nombre, s.icono, s.publica, s.activa, s.indexado_en, COUNT(p.id) n
                                  FROM sitios s LEFT JOIN good_paginas p ON p.sitio=s.slug GROUP BY s.slug ORDER BY s.nombre'),
            'ultimas' => filas('SELECT sitio, tipo, url, titulo, actualizado FROM good_paginas ORDER BY actualizado DESC, id DESC LIMIT 15'),
        ];
    },
]);
