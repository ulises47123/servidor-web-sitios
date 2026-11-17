<?php
/**
 * Registro de sitios alojados + visibilidad.
 * La visibilidad la aplica nginx con archivos marcador:
 *   _datos/acceso/local/<slug>    -> el sitio se ve por la LAN
 *   _datos/acceso/publico/<slug>  -> el sitio sale por el tunel
 * Sin marcador, nginx responde 404 aunque la carpeta exista.
 */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';

const SITIOS_SISTEMA = ['tsline', 'aninube'];   // tienen PHP propio; no se borran desde el gestor
const SLUG_RE = '/^[a-z0-9][a-z0-9_-]{0,47}$/';
const COLORES = ['blue', 'green', 'orange', 'purple', 'red', 'teal'];

function slug_valido(string $s): bool
{
    return (bool)preg_match(SLUG_RE, $s);
}

function sitio_dir(string $slug): string
{
    if (!slug_valido($slug)) {
        throw new InvalidArgumentException('Identificador de sitio inválido');
    }
    return SITIOS_DIR . '/' . $slug;
}

function sitio_tiene_index(string $dir): bool
{
    return is_file("$dir/index.html") || is_file("$dir/index.htm") || is_file("$dir/index.php");
}

function sitios_listar(): array
{
    return filas('SELECT * FROM sitios ORDER BY sistema DESC, nombre');
}

function sitio_obtener(string $slug): ?array
{
    return fila('SELECT * FROM sitios WHERE slug=?', [$slug]);
}

/** Sitios visibles segun desde donde se mira (publico solo ve los publicos). */
function sitios_visibles(string $alcance): array
{
    $sql = 'SELECT * FROM sitios WHERE activa=1' . ($alcance === 'publico' ? ' AND publica=1' : '') . ' ORDER BY nombre';
    return filas($sql);
}

/** Metadatos opcionales del sitio (good.json). */
function sitio_good_json(string $dir): array
{
    $f = "$dir/good.json";
    if (!is_file($f) || filesize($f) > 64 * 1024) {
        return [];
    }
    $d = json_decode((string)file_get_contents($f), true);
    return is_array($d) ? $d : [];
}

/** Titulo y descripcion desde index.html, para registrar carpetas nuevas. */
function sitio_meta_desde_index(string $dir): array
{
    foreach (['index.html', 'index.htm'] as $i) {
        if (is_file("$dir/$i")) {
            require_once __DIR__ . '/indexador.php';
            $e = extraer_html((string)file_get_contents("$dir/$i", false, null, 0, 512 * 1024));
            return ['nombre' => $e['titulo'], 'descripcion' => $e['descripcion']];
        }
    }
    return [];
}

/** Rehace todos los marcadores de acceso a partir de la base. */
function sitios_sincronizar_acceso(): void
{
    foreach (['local', 'publico'] as $d) {
        asegurar_dir(ACCESO_DIR . "/$d");
    }
    $quiero = ['local' => [], 'publico' => []];
    foreach (sitios_listar() as $s) {
        if ((int)$s['activa'] === 1 && is_dir(SITIOS_DIR . '/' . $s['slug'])) {
            $quiero['local'][$s['slug']] = true;
            if ((int)$s['publica'] === 1) {
                $quiero['publico'][$s['slug']] = true;
            }
        }
    }
    foreach ($quiero as $d => $lista) {
        $base = ACCESO_DIR . "/$d";
        foreach (scandir($base) ?: [] as $f) {
            if ($f[0] !== '.' && !isset($lista[$f])) {
                @unlink("$base/$f");
            }
        }
        foreach (array_keys($lista) as $slug) {
            if (!is_file("$base/$slug")) {
                file_put_contents("$base/$slug", '');
            }
        }
    }
}

/**
 * Busca carpetas nuevas en sitios/ que tengan index y no esten registradas.
 * Se registran PRIVADAS (publicarlas es una decision explicita del admin).
 * Devuelve ['nuevos'=>[slugs], 'ignorados'=>[nombre=>motivo]].
 */
function sitios_detectar(string $usuario = 'sistema'): array
{
    $nuevos = [];
    $ignorados = [];
    $registrados = array_column(sitios_listar(), 'slug', 'slug');
    foreach (scandir(SITIOS_DIR) ?: [] as $nombre) {
        if ($nombre === '.' || $nombre === '..' || !is_dir(SITIOS_DIR . "/$nombre")) {
            continue;
        }
        if (isset($registrados[$nombre])) {
            continue;
        }
        $dir = SITIOS_DIR . "/$nombre";
        if (!slug_valido($nombre)) {
            $ignorados[$nombre] = 'El nombre de la carpeta solo puede tener minúsculas, números, - y _ (sugerido: ' . hacer_slug($nombre) . ')';
            continue;
        }
        if (!sitio_tiene_index($dir)) {
            $ignorados[$nombre] = 'No tiene index.html ni index.php';
            continue;
        }
        $g = sitio_good_json($dir) + sitio_meta_desde_index($dir);
        q(
            'INSERT INTO sitios (slug, nombre, descripcion, categoria, icono, color, publica, activa) VALUES (?,?,?,?,?,?,0,1)',
            [
                $nombre,
                mb_substr(trim((string)($g['nombre'] ?? '')) ?: ucfirst($nombre), 0, 80),
                mb_substr(trim((string)($g['descripcion'] ?? '')), 0, 255),
                mb_substr(trim((string)($g['categoria'] ?? '')) ?: 'General', 0, 60),
                mb_substr(trim((string)($g['icono'] ?? '')) ?: '🌐', 0, 16),
                in_array($g['color'] ?? '', COLORES, true) ? $g['color'] : 'blue',
            ]
        );
        registrar('sitio_detectado', $nombre, $usuario);
        $nuevos[] = $nombre;
    }
    if ($nuevos) {
        sitios_sincronizar_acceso();
        require_once __DIR__ . '/indexador.php';
        foreach ($nuevos as $s) {
            indexar_sitio($s);
        }
    }
    return ['nuevos' => $nuevos, 'ignorados' => $ignorados];
}

/** Crea un sitio nuevo con una plantilla minima. */
function sitio_crear(array $d, string $usuario): string
{
    $slug = hacer_slug($d['slug'] ?? '' ?: ($d['nombre'] ?? ''));
    if (!slug_valido($slug)) {
        throw new InvalidArgumentException('Nombre de carpeta inválido');
    }
    if (sitio_obtener($slug)) {
        throw new InvalidArgumentException('Ya existe un sitio con ese identificador');
    }
    $dir = sitio_dir($slug);
    if (file_exists($dir)) {
        throw new InvalidArgumentException('Ya existe una carpeta con ese nombre. Usá "Detectar carpetas nuevas".');
    }
    $nombre = mb_substr(trim((string)($d['nombre'] ?? '')), 0, 80);
    if ($nombre === '') {
        throw new InvalidArgumentException('Falta el nombre');
    }
    $desc = mb_substr(trim((string)($d['descripcion'] ?? '')), 0, 255);
    asegurar_dir($dir);
    $hn = h($nombre);
    $hd = h($desc ?: 'Página alojada en el servidor.');
    file_put_contents("$dir/index.html", <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$hn</title>
  <meta name="description" content="$hd">
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 720px; margin: 0 auto; padding: 48px 16px; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>$hn</h1>
  <p>$hd</p>
  <p>Editá este archivo desde el panel (Sitios → Archivos).</p>
</body>
</html>

HTML);
    q(
        'INSERT INTO sitios (slug, nombre, descripcion, categoria, icono, color, publica, activa) VALUES (?,?,?,?,?,?,?,1)',
        [
            $slug, $nombre, $desc,
            mb_substr(trim((string)($d['categoria'] ?? '')) ?: 'General', 0, 60),
            mb_substr(trim((string)($d['icono'] ?? '')) ?: '🌐', 0, 16),
            in_array($d['color'] ?? '', COLORES, true) ? $d['color'] : 'blue',
            !empty($d['publica']) ? 1 : 0,
        ]
    );
    sitios_sincronizar_acceso();
    require_once __DIR__ . '/indexador.php';
    indexar_sitio($slug);
    registrar('sitio_creado', $slug, $usuario);
    return $slug;
}

/** Edita metadatos / visibilidad. */
function sitio_actualizar(string $slug, array $d, string $usuario): void
{
    $s = sitio_obtener($slug);
    if (!$s) {
        throw new InvalidArgumentException('No existe el sitio');
    }
    $nombre = mb_substr(trim((string)($d['nombre'] ?? $s['nombre'])), 0, 80);
    if ($nombre === '') {
        throw new InvalidArgumentException('Falta el nombre');
    }
    q(
        'UPDATE sitios SET nombre=?, descripcion=?, categoria=?, icono=?, color=?, publica=?, activa=? WHERE slug=?',
        [
            $nombre,
            mb_substr(trim((string)($d['descripcion'] ?? $s['descripcion'])), 0, 255),
            mb_substr(trim((string)($d['categoria'] ?? $s['categoria'])) ?: 'General', 0, 60),
            mb_substr(trim((string)($d['icono'] ?? $s['icono'])) ?: '🌐', 0, 16),
            in_array($d['color'] ?? '', COLORES, true) ? $d['color'] : $s['color'],
            array_key_exists('publica', $d) ? (int)(bool)$d['publica'] : (int)$s['publica'],
            array_key_exists('activa', $d) ? (int)(bool)$d['activa'] : (int)$s['activa'],
            $slug,
        ]
    );
    sitios_sincronizar_acceso();
    $n = sitio_obtener($slug);
    $cambios = [];
    foreach (['nombre', 'publica', 'activa', 'categoria', 'icono', 'color', 'descripcion'] as $k) {
        if ((string)$s[$k] !== (string)$n[$k]) {
            $cambios[] = $k === 'descripcion' ? 'descripcion' : "$k=" . $n[$k];
        }
    }
    registrar('sitio_editado', $slug . ($cambios ? ': ' . implode(', ', $cambios) : ''), $usuario);
}

/** Borra un sitio: la carpeta va a _datos/papelera (recuperable a mano). */
function sitio_borrar(string $slug, string $usuario): void
{
    $s = sitio_obtener($slug);
    if (!$s) {
        throw new InvalidArgumentException('No existe el sitio');
    }
    if ((int)$s['sistema'] === 1 || in_array($slug, SITIOS_SISTEMA, true)) {
        throw new InvalidArgumentException('Este sitio es del sistema; se puede desactivar pero no borrar.');
    }
    $dir = sitio_dir($slug);
    if (is_dir($dir)) {
        $pap = DATOS_DIR . '/papelera';
        asegurar_dir($pap);
        $destino = $pap . '/' . $slug . '-' . date('Ymd-His');
        if (!@rename($dir, $destino)) {
            throw new RuntimeException('No se pudo mover la carpeta a la papelera (permisos).');
        }
    }
    q('DELETE FROM good_paginas WHERE sitio=?', [$slug]);
    q('DELETE FROM sitios WHERE slug=?', [$slug]);
    sitios_sincronizar_acceso();
    registrar('sitio_borrado', $slug . ' (a la papelera)', $usuario);
}

/** Color hex para cada nombre de color. */
function color_hex(string $c): string
{
    return ['blue' => '#4f8cff', 'green' => '#22c55e', 'orange' => '#f59e0b', 'purple' => '#8b5cf6',
        'red' => '#ef4444', 'teal' => '#14b8a6'][$c] ?? '#4f8cff';
}
