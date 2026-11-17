<?php
/**
 * Nucleo compartido: configuracion, base de datos y utilidades.
 * Lo incluyen Good, el panel admin y los sitios con PHP. Nunca se sirve por HTTP
 * (nginx solo expone /good/, /sitios/<slug>/ y el panel en su puerto).
 */
declare(strict_types=1);

const WEB_RAIZ  = __DIR__ . '/..';
const APP_DIR   = __DIR__;
const DATOS_DIR = WEB_RAIZ . '/_datos';
const MEDIA_DIR = DATOS_DIR . '/media';
const SITIOS_DIR = WEB_RAIZ . '/sitios';
const ACCESO_DIR = DATOS_DIR . '/acceso';   // marcadores que lee nginx: acceso/{publico,local}/<slug>

mb_internal_encoding('UTF-8');
date_default_timezone_set('America/Argentina/Buenos_Aires');

/* ------------------------------------------------------------------ config */

/** Configuracion: _datos/config.local.php (devuelve un array). Nunca va al repo ni a la copia publica. */
function cfg(string $clave, mixed $def = null): mixed
{
    static $c = null;
    if ($c === null) {
        // WEB_CONFIG permite tener la config fuera del proyecto (PC de pruebas)
        $f = getenv('WEB_CONFIG') ?: DATOS_DIR . '/config.local.php';
        $c = is_file($f) ? (require $f) : [];
        if (!is_array($c)) {
            $c = [];
        }
    }
    $v = $c;
    foreach (explode('.', $clave) as $k) {
        if (!is_array($v) || !array_key_exists($k, $v)) {
            return $def;
        }
        $v = $v[$k];
    }
    return $v;
}

/**
 * Desde donde llega el pedido, segun nginx (fastcgi_param WEB_ALCANCE):
 *  publico = tunel de Cloudflare, local = LAN/Tailscale, admin = panel, cli = consola.
 * Si falta, se asume lo mas restrictivo (publico).
 */
function alcance(): string
{
    if (PHP_SAPI === 'cli') {
        return 'cli';
    }
    $a = $_SERVER['WEB_ALCANCE'] ?? '';
    return in_array($a, ['publico', 'local', 'admin'], true) ? $a : 'publico';
}

/* ---------------------------------------------------------------------- db */

function db(): mysqli
{
    static $c = null;
    if ($c instanceof mysqli) {
        return $c;
    }
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $d = cfg('db', []);
    $c = new mysqli(
        $d['host'] ?? 'localhost',
        $d['user'] ?? '',
        $d['pass'] ?? '',
        $d['name'] ?? 'servidor',
        (int)($d['port'] ?? 3306),
        $d['socket'] ?? null
    );
    $c->set_charset('utf8mb4');
    $c->query("SET time_zone = '" . date('P') . "'");
    return $c;
}

/** Ejecuta una consulta preparada. Tipos se infieren (i/d/s). */
function q(string $sql, array $params = []): mysqli_stmt
{
    $st = db()->prepare($sql);
    if ($params) {
        $tipos = '';
        foreach ($params as $p) {
            $tipos .= is_int($p) || is_bool($p) ? 'i' : (is_float($p) ? 'd' : 's');
        }
        $vals = array_map(fn($p) => is_bool($p) ? (int)$p : $p, array_values($params));
        $st->bind_param($tipos, ...$vals);
    }
    $st->execute();
    return $st;
}

function filas(string $sql, array $params = []): array
{
    $r = q($sql, $params)->get_result();
    return $r ? $r->fetch_all(MYSQLI_ASSOC) : [];
}

function fila(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->get_result();
    $f = $r ? $r->fetch_assoc() : null;
    return $f ?: null;
}

function valor(string $sql, array $params = []): mixed
{
    $f = fila($sql, $params);
    return $f ? reset($f) : null;
}

/** INSERT/UPDATE/DELETE: devuelve filas afectadas. */
function ejecutar(string $sql, array $params = []): int
{
    return q($sql, $params)->affected_rows;
}

function ultimo_id(): int
{
    return (int)db()->insert_id;
}

/* ------------------------------------------------------------------- red */

/** IP real del cliente. Por el tunel llega como 127.0.0.1: ahi se usa CF-Connecting-IP. */
function ip_cliente(): string
{
    if (PHP_SAPI === 'cli') {
        return 'cli';
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (alcance() === 'publico' && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $cf = trim((string)$_SERVER['HTTP_CF_CONNECTING_IP']);
        if (filter_var($cf, FILTER_VALIDATE_IP)) {
            $ip = $cf;
        }
    }
    return substr($ip, 0, 45);
}

/* --------------------------------------------------------------- salidas */

function h(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function json_salida(mixed $x, int $codigo = 200): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $msg, int $codigo = 400): never
{
    json_salida(['ok' => false, 'error' => $msg], $codigo);
}

/** Cuerpo JSON del pedido (o $_POST si vino como formulario). */
function entrada(): array
{
    static $e = null;
    if ($e !== null) {
        return $e;
    }
    $tipo = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($tipo, 'application/json')) {
        $d = json_decode((string)file_get_contents('php://input'), true);
        $e = is_array($d) ? $d : [];
    } else {
        $e = $_POST;
    }
    return $e;
}

function ent_str(string $k, string $def = '', int $max = 1000): string
{
    $v = entrada()[$k] ?? $def;
    if (!is_scalar($v)) {
        return $def;
    }
    return mb_substr(trim((string)$v), 0, $max);
}

function ent_int(string $k, int $def = 0): int
{
    $v = entrada()[$k] ?? $def;
    return is_numeric($v) ? (int)$v : $def;
}

function ent_bool(string $k, bool $def = false): bool
{
    $v = entrada()[$k] ?? $def;
    return filter_var($v, FILTER_VALIDATE_BOOLEAN);
}

/* ------------------------------------------------------------- utilidades */

/** Slug seguro: minusculas, a-z 0-9 _ - (sin acentos). */
function hacer_slug(string $s, int $max = 48): string
{
    $s = mb_strtolower(trim($s));
    $s = sin_acentos($s);
    $s = preg_replace('/[^a-z0-9_-]+/', '-', $s) ?? '';
    $s = trim(preg_replace('/-+/', '-', $s) ?? '', '-');
    return substr($s, 0, $max);
}

/** Quita acentos manteniendo la misma cantidad de caracteres (sirve para buscar posiciones). */
function sin_acentos(string $s): string
{
    static $map = [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a', 'Á' => 'A', 'À' => 'A', 'Ä' => 'A', 'Â' => 'A', 'Ã' => 'A',
        'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e', 'É' => 'E', 'È' => 'E', 'Ë' => 'E', 'Ê' => 'E',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i', 'Í' => 'I', 'Ì' => 'I', 'Ï' => 'I', 'Î' => 'I',
        'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o', 'Ó' => 'O', 'Ò' => 'O', 'Ö' => 'O', 'Ô' => 'O', 'Õ' => 'O',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u', 'Ú' => 'U', 'Ù' => 'U', 'Ü' => 'U', 'Û' => 'U',
        'ñ' => 'n', 'Ñ' => 'N', 'ç' => 'c', 'Ç' => 'C',
    ];
    return strtr($s, $map);
}

/** Registro de auditoria (nunca rompe la operacion si falla). */
function registrar(string $evento, string $detalle = '', string $usuario = ''): void
{
    try {
        q(
            'INSERT INTO registro (evento, usuario, ip, detalle) VALUES (?, ?, ?, ?)',
            [mb_substr($evento, 0, 80), mb_substr($usuario, 0, 64), ip_cliente(), mb_substr($detalle, 0, 255)]
        );
    } catch (Throwable) {
        // sin registro, pero la accion sigue
    }
}

/** Crea una carpeta si no existe. */
function asegurar_dir(string $d): void
{
    if (!is_dir($d) && !@mkdir($d, 0775, true) && !is_dir($d)) {
        throw new RuntimeException('No se pudo crear la carpeta ' . basename($d));
    }
}

/** Borra una carpeta con todo su contenido (sin seguir enlaces). */
function borrar_arbol(string $d): bool
{
    if (is_link($d) || is_file($d)) {
        return @unlink($d);
    }
    if (!is_dir($d)) {
        return true;
    }
    foreach (scandir($d) ?: [] as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        borrar_arbol($d . '/' . $f);
    }
    return @rmdir($d);
}

/** Tamano legible. */
function bytes_legibles(int|float $b): string
{
    $u = ['B', 'KB', 'MB', 'GB', 'TB'];
    $i = 0;
    while ($b >= 1024 && $i < count($u) - 1) {
        $b /= 1024;
        $i++;
    }
    return round($b, $i ? 1 : 0) . ' ' . $u[$i];
}

/**
 * Entrega un archivo multimedia protegido. En nginx usa X-Accel-Redirect
 * (soporta saltos/Range y no ocupa PHP); `ruta_rel` es relativa a _datos/media/.
 */
function servir_media(string $ruta_rel, string $mime): never
{
    $ruta_rel = ltrim(str_replace('\\', '/', $ruta_rel), '/');
    if ($ruta_rel === '' || str_contains($ruta_rel, '..')) {
        http_response_code(404);
        exit;
    }
    $abs = MEDIA_DIR . '/' . $ruta_rel;
    if (!is_file($abs)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=86400');
    header('X-Content-Type-Options: nosniff');
    $partes = array_map('rawurlencode', explode('/', $ruta_rel));
    header('X-Accel-Redirect: /_media/' . implode('/', $partes));
    exit;
}

/** Tipos MIME permitidos para multimedia (extension => mime). */
const MIME_AUDIO = ['mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4', 'aac' => 'audio/aac', 'ogg' => 'audio/ogg',
    'opus' => 'audio/ogg', 'wav' => 'audio/wav', 'flac' => 'audio/flac', 'webm' => 'audio/webm'];
const MIME_VIDEO = ['mp4' => 'video/mp4', 'm4v' => 'video/mp4', 'webm' => 'video/webm', 'ogv' => 'video/ogg'];
const MIME_IMAGEN = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];

/** Valida que un archivo de imagen sea realmente imagen (por firma), devuelve extension o null. */
function tipo_imagen_real(string $ruta): ?string
{
    $h = @file_get_contents($ruta, false, null, 0, 16);
    if ($h === false || strlen($h) < 12) {
        return null;
    }
    return match (true) {
        str_starts_with($h, "\xFF\xD8\xFF") => 'jpg',
        str_starts_with($h, "\x89PNG\r\n\x1A\n") => 'png',
        str_starts_with($h, 'GIF8') => 'gif',
        str_starts_with($h, 'RIFF') && substr($h, 8, 4) === 'WEBP' => 'webp',
        default => null,
    };
}

/** Respuesta de error generica para paginas HTML. */
function pagina_error(int $codigo, string $titulo, string $texto = ''): never
{
    http_response_code($codigo);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . h($titulo) . '</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;padding:16px;text-align:center">'
        . '<div><h1 style="margin-bottom:8px">' . h($titulo) . '</h1><p>' . h($texto) . '</p></div></body></html>';
    exit;
}
