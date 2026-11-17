<?php
/**
 * Gestor de archivos de un sitio (lo usa el panel).
 * Todo queda encerrado en sitios/<slug>/: rutas relativas validadas segmento por
 * segmento + realpath. No se permite subir ni crear codigo de servidor.
 */
declare(strict_types=1);

require_once __DIR__ . '/sitios.php';

const ARCH_PERMITIDAS = ['html', 'htm', 'css', 'js', 'mjs', 'json', 'txt', 'md', 'xml', 'svg', 'csv', 'vtt', 'lrc',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp',
    'mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'mp4', 'webm', 'ogv',
    'woff', 'woff2', 'ttf', 'otf', 'pdf', 'zip'];
const ARCH_EDITABLES = ['html', 'htm', 'css', 'js', 'mjs', 'json', 'txt', 'md', 'xml', 'svg', 'csv', 'vtt', 'lrc'];
const ARCH_MAX_EDITABLE = 2 * 1024 * 1024;

/** Valida una ruta relativa y devuelve la ruta absoluta dentro del sitio. */
function arch_ruta(string $slug, string $rel, bool $debe_existir = true): string
{
    $base = realpath(sitio_dir($slug));
    if ($base === false) {
        throw new InvalidArgumentException('El sitio no tiene carpeta');
    }
    $rel = str_replace('\\', '/', $rel);
    $rel = trim($rel, '/');
    if (str_contains($rel, "\0")) {
        throw new InvalidArgumentException('Ruta inválida');
    }
    $partes = $rel === '' ? [] : explode('/', $rel);
    foreach ($partes as $p) {
        if ($p === '' || $p === '.' || $p === '..' || $p[0] === '.' || mb_strlen($p) > 120
            || preg_match('/[<>:"|?*\x00-\x1F]/', $p)) {
            throw new InvalidArgumentException('Nombre no permitido: ' . $p);
        }
    }
    $abs = $base . ($partes ? '/' . implode('/', $partes) : '');
    // el padre real tiene que seguir dentro del sitio (sin enlaces que escapen)
    $padre = realpath($partes ? dirname($abs) : $abs);
    if ($padre === false || ($padre !== $base && !str_starts_with($padre . DIRECTORY_SEPARATOR, $base . DIRECTORY_SEPARATOR))) {
        throw new InvalidArgumentException('Ruta fuera del sitio');
    }
    if ($debe_existir && !file_exists($abs)) {
        throw new InvalidArgumentException('No existe: ' . ($rel ?: '/'));
    }
    if (file_exists($abs) && is_link($abs)) {
        throw new InvalidArgumentException('No se gestionan enlaces simbólicos');
    }
    return $abs;
}

function arch_ext(string $nombre): string
{
    return strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
}

function arch_permitido(string $nombre): bool
{
    // .php, .phtml, .phar, .htaccess, .user.ini, etc. quedan afuera por no estar en la lista
    return in_array(arch_ext($nombre), ARCH_PERMITIDAS, true) && !preg_match('/\.(php\d?|phtml|phar|pht|cgi|pl|py|sh)(\.|$)/i', $nombre);
}

function arch_listar(string $slug, string $rel): array
{
    $abs = arch_ruta($slug, $rel);
    if (!is_dir($abs)) {
        throw new InvalidArgumentException('No es una carpeta');
    }
    $items = [];
    foreach (scandir($abs) ?: [] as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        $p = "$abs/$f";
        $dir = is_dir($p);
        $items[] = [
            'nombre'   => $f,
            'carpeta'  => $dir,
            'tamano'   => $dir ? 0 : (int)filesize($p),
            'mod'      => date('Y-m-d H:i', (int)filemtime($p)),
            'editable' => !$dir && in_array(arch_ext($f), ARCH_EDITABLES, true),
            'oculto'   => $f[0] === '.',
        ];
    }
    usort($items, fn($a, $b) => [$b['carpeta'], strtolower($a['nombre'])] <=> [$a['carpeta'], strtolower($b['nombre'])]);
    return $items;
}

function arch_leer(string $slug, string $rel): string
{
    $abs = arch_ruta($slug, $rel);
    if (!is_file($abs) || !in_array(arch_ext($abs), ARCH_EDITABLES, true)) {
        throw new InvalidArgumentException('Ese archivo no se puede editar acá');
    }
    if (filesize($abs) > ARCH_MAX_EDITABLE) {
        throw new InvalidArgumentException('El archivo es demasiado grande para el editor');
    }
    return (string)file_get_contents($abs);
}

function arch_guardar(string $slug, string $rel, string $contenido): void
{
    $abs = arch_ruta($slug, $rel, false);
    if (!in_array(arch_ext($abs), ARCH_EDITABLES, true) || !arch_permitido(basename($abs))) {
        throw new InvalidArgumentException('Tipo de archivo no editable');
    }
    if (strlen($contenido) > ARCH_MAX_EDITABLE) {
        throw new InvalidArgumentException('Contenido demasiado grande');
    }
    if (file_put_contents($abs, $contenido, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo guardar (permisos)');
    }
}

function arch_crear_carpeta(string $slug, string $rel): void
{
    $abs = arch_ruta($slug, $rel, false);
    if (file_exists($abs)) {
        throw new InvalidArgumentException('Ya existe');
    }
    asegurar_dir($abs);
}

/** Sube los archivos de $_FILES['archivos'] (con rutas relativas opcionales para carpetas). */
function arch_subir(string $slug, string $rel_dir, array $files, array $rutas): array
{
    arch_ruta($slug, $rel_dir); // la carpeta destino tiene que existir
    $ok = [];
    $rechazados = [];
    $n = is_array($files['name'] ?? null) ? count($files['name']) : 0;
    for ($i = 0; $i < $n; $i++) {
        $nombre = (string)$files['name'][$i];
        $relativa = trim(str_replace('\\', '/', (string)($rutas[$i] ?? $nombre)), '/');
        if ($relativa === '') {
            $relativa = $nombre;
        }
        try {
            if (($files['error'][$i] ?? 1) !== UPLOAD_ERR_OK) {
                throw new RuntimeException('error de subida ' . ($files['error'][$i] ?? '?'));
            }
            if (!arch_permitido(basename($relativa))) {
                throw new InvalidArgumentException('tipo no permitido');
            }
            $destino_rel = trim($rel_dir . '/' . $relativa, '/');
            // crear subcarpetas (subida de carpeta completa)
            $sub = dirname($destino_rel);
            if ($sub !== '.' && $sub !== '') {
                $acum = '';
                foreach (explode('/', $sub) as $seg) {
                    $acum = trim("$acum/$seg", '/');
                    $a = arch_ruta($slug, $acum, false);
                    if (!is_dir($a)) {
                        asegurar_dir($a);
                    }
                }
            }
            $abs = arch_ruta($slug, $destino_rel, false);
            if (is_dir($abs)) {
                throw new InvalidArgumentException('ya existe una carpeta con ese nombre');
            }
            if (!move_uploaded_file($files['tmp_name'][$i], $abs)) {
                throw new RuntimeException('no se pudo guardar');
            }
            @chmod($abs, 0664);
            $ok[] = $destino_rel;
        } catch (Throwable $e) {
            $rechazados[] = ['archivo' => $relativa, 'motivo' => $e->getMessage()];
        }
    }
    return ['subidos' => $ok, 'rechazados' => $rechazados];
}

function arch_borrar(string $slug, string $rel): void
{
    if (trim($rel, '/') === '') {
        throw new InvalidArgumentException('Para borrar el sitio entero usá "Eliminar sitio"');
    }
    $abs = arch_ruta($slug, $rel);
    if (!borrar_arbol($abs)) {
        throw new RuntimeException('No se pudo borrar (permisos)');
    }
}

function arch_renombrar(string $slug, string $rel, string $nuevo): void
{
    $abs = arch_ruta($slug, $rel);
    if (trim($rel, '/') === '') {
        throw new InvalidArgumentException('No se puede renombrar la raíz');
    }
    $nuevo = trim($nuevo);
    if ($nuevo === '' || str_contains($nuevo, '/') || str_contains($nuevo, '\\')) {
        throw new InvalidArgumentException('Nombre inválido');
    }
    if (!is_dir($abs) && !arch_permitido($nuevo)) {
        throw new InvalidArgumentException('Extensión no permitida');
    }
    $padre = dirname(trim($rel, '/'));
    $destino = arch_ruta($slug, ($padre === '.' ? '' : $padre . '/') . $nuevo, false);
    if (file_exists($destino)) {
        throw new InvalidArgumentException('Ya existe un archivo con ese nombre');
    }
    if (!@rename($abs, $destino)) {
        throw new RuntimeException('No se pudo renombrar');
    }
}
