<?php
/** Sesiones, CSRF y bloqueo de fuerza bruta (compartido por panel y cuentas). */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';

/** Abre una sesion con cookie endurecida. */
function sesion_abrir(string $nombre, string $ruta, string $samesite, int $vida): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        if (session_name() === $nombre) {
            return;
        }
        session_write_close();
    }
    $https = (($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)max($vida, 1440));
    session_name($nombre);
    session_set_cookie_params([
        'lifetime' => $vida,
        'path'     => $ruta,
        'secure'   => $https,
        'httponly' => true,
        'samesite' => $samesite,
    ]);
    session_start();
}

/* -------------------------------------------------------------------- CSRF */

function csrf_token(): string
{
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Valida el token (cabecera X-CSRF o campo _csrf). */
function csrf_valido(): bool
{
    $t = $_SERVER['HTTP_X_CSRF'] ?? ($_POST['_csrf'] ?? '');
    return is_string($t) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t);
}

/* ---------------------------------------------------- bloqueo fuerza bruta */

const BLOQUEO_VENTANA_MIN = 15;

/** true si esta IP o este usuario superaron el limite de fallos en la ventana. */
function login_bloqueado(string $ambito, string $usuario, int $max): bool
{
    $desde = date('Y-m-d H:i:s', time() - BLOQUEO_VENTANA_MIN * 60);
    $por_ip = (int)valor('SELECT COUNT(*) FROM login_intentos WHERE ambito=? AND ip=? AND fecha>=?', [$ambito, ip_cliente(), $desde]);
    if ($por_ip >= $max) {
        return true;
    }
    if ($usuario !== '') {
        $por_u = (int)valor('SELECT COUNT(*) FROM login_intentos WHERE ambito=? AND usuario=? AND fecha>=?', [$ambito, $usuario, $desde]);
        if ($por_u >= $max) {
            return true;
        }
    }
    return false;
}

function login_fallo(string $ambito, string $usuario): void
{
    q('INSERT INTO login_intentos (ambito, ip, usuario) VALUES (?, ?, ?)', [$ambito, ip_cliente(), mb_substr($usuario, 0, 64)]);
    // limpieza ocasional
    if (random_int(1, 50) === 1) {
        q('DELETE FROM login_intentos WHERE fecha < ?', [date('Y-m-d H:i:s', time() - 86400)]);
    }
}

function login_limpiar(string $ambito, string $usuario): void
{
    q('DELETE FROM login_intentos WHERE ambito=? AND (ip=? OR usuario=?)', [$ambito, ip_cliente(), $usuario]);
}

/** Hash valido de relleno: se verifica igual cuando el usuario no existe (mismo tiempo de respuesta). */
function hash_relleno(): string
{
    static $h = null;
    return $h ??= password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
}

/** Huella del navegador para atar la sesion (dificulta reusar una cookie robada). */
function huella_cliente(): string
{
    return hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
}

/** Reglas de contrasena (minimo razonable). Devuelve error o ''. */
function validar_pass(string $p, int $min = 8): string
{
    if (mb_strlen($p) < $min) {
        return "La contraseña debe tener al menos $min caracteres.";
    }
    if (mb_strlen($p) > 200) {
        return 'La contraseña es demasiado larga.';
    }
    return '';
}

function validar_usuario(string $u): string
{
    return preg_match('/^[A-Za-z0-9_.-]{3,32}$/', $u) ? '' : 'Usuario inválido: de 3 a 32 caracteres (letras, números, _ . -).';
}

/** Cabeceras de seguridad comunes para paginas HTML. */
function cabeceras_seguras(bool $estricta = false): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: ' . ($estricta ? 'DENY' : 'SAMEORIGIN'));
}
