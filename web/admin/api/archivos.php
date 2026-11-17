<?php
/** API: gestor de archivos de un sitio (encerrado en sitios/<slug>/). */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/admin_auth.php';
require_once __DIR__ . '/../../_app/archivos.php';

function slug_existente(): string
{
    $slug = (string)($_GET['sitio'] ?? ent_str('sitio', '', 48));
    if (!slug_valido($slug) || !sitio_obtener($slug)) {
        throw new InvalidArgumentException('Sitio inválido');
    }
    return $slug;
}

admin_despachar([
    'listar' => function (): array {
        $slug = slug_existente();
        $rel = ent_str('ruta', '', 500);
        return ['ruta' => trim($rel, '/'), 'items' => arch_listar($slug, $rel)];
    },

    'leer' => function (): array {
        return ['contenido' => arch_leer(slug_existente(), ent_str('ruta', '', 500))];
    },

    'guardar' => function (string $yo): array {
        $slug = slug_existente();
        $rel = ent_str('ruta', '', 500);
        $contenido = entrada()['contenido'] ?? null;
        if (!is_string($contenido)) {
            throw new InvalidArgumentException('Falta el contenido');
        }
        arch_guardar($slug, $rel, $contenido);
        registrar('archivo_guardado', "$slug/$rel", $yo);
        return [];
    },

    'carpeta' => function (string $yo): array {
        $slug = slug_existente();
        $rel = ent_str('ruta', '', 500);
        arch_crear_carpeta($slug, $rel);
        registrar('carpeta_creada', "$slug/$rel", $yo);
        return [];
    },

    'subir' => function (string $yo): array {
        $slug = slug_existente();
        $dir = (string)($_POST['ruta'] ?? '');
        $rutas = json_decode((string)($_POST['rutas'] ?? '[]'), true);
        $r = arch_subir($slug, $dir, $_FILES['archivos'] ?? [], is_array($rutas) ? $rutas : []);
        if ($r['subidos']) {
            registrar('archivos_subidos', "$slug/$dir: " . count($r['subidos']) . ' archivo(s)', $yo);
        }
        return $r;
    },

    'borrar' => function (string $yo): array {
        $slug = slug_existente();
        $rel = ent_str('ruta', '', 500);
        arch_borrar($slug, $rel);
        registrar('archivo_borrado', "$slug/$rel", $yo);
        return [];
    },

    'renombrar' => function (string $yo): array {
        $slug = slug_existente();
        $rel = ent_str('ruta', '', 500);
        $nuevo = ent_str('nuevo', '', 120);
        arch_renombrar($slug, $rel, $nuevo);
        registrar('archivo_renombrado', "$slug/$rel -> $nuevo", $yo);
        return [];
    },
]);
