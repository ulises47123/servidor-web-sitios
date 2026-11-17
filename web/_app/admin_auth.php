<?php
/**
 * Autenticacion del panel admin (puerto privado).
 * - Solo funciona si nginx marco el pedido como alcance "admin".
 * - Sesion: SameSite=Strict, 20 min de inactividad, 8 h maximo, atada al navegador.
 * - 5 fallos en 15 min (por IP o por usuario) bloquean el login.
 */
declare(strict_types=1);

require_once __DIR__ . '/seguridad.php';

const ADMIN_INACTIVIDAD = 20 * 60;
const ADMIN_MAXIMO      = 8 * 3600;
const ADMIN_MAX_FALLOS  = 5;

function admin_sesion(): void
{
    if (alcance() !== 'admin' && alcance() !== 'cli') {
        // El panel no existe fuera de su puerto, aunque alguien copie archivos.
        http_response_code(404);
        exit;
    }
    sesion_abrir('ADMINSESS', '/', 'Strict', 0);
}

/** Usuario admin logueado o null (aplica los vencimientos). */
function admin_actual(): ?string
{
    admin_sesion();
    $s = $_SESSION['admin'] ?? null;
    if (!is_array($s)) {
        return null;
    }
    $ahora = time();
    if ($ahora - ($s['ultimo'] ?? 0) > ADMIN_INACTIVIDAD
        || $ahora - ($s['inicio'] ?? 0) > ADMIN_MAXIMO
        || !hash_equals($s['huella'] ?? '', huella_cliente())) {
        admin_cerrar('vencida');
        return null;
    }
    // la cuenta puede haberse desactivado o borrado mientras tanto
    $activo = valor('SELECT activo FROM admin_usuarios WHERE usuario=?', [$s['usuario']]);
    if ((int)$activo !== 1) {
        admin_cerrar('cuenta desactivada');
        return null;
    }
    $_SESSION['admin']['ultimo'] = $ahora;
    return $s['usuario'];
}

/** Intenta iniciar sesion. Devuelve '' si salio bien o el mensaje de error. */
function admin_login(string $usuario, string $pass): string
{
    admin_sesion();
    $usuario = trim($usuario);
    if (login_bloqueado('admin', $usuario, ADMIN_MAX_FALLOS)) {
        registrar('admin_login_bloqueado', $usuario, $usuario);
        return 'Demasiados intentos fallidos. Esperá ' . BLOQUEO_VENTANA_MIN . ' minutos.';
    }
    $f = $usuario === '' ? null : fila('SELECT usuario, pass_hash, activo FROM admin_usuarios WHERE usuario=?', [$usuario]);
    // password_verify siempre se ejecuta para no revelar por tiempo si el usuario existe
    $hash = $f['pass_hash'] ?? hash_relleno();
    $ok = password_verify($pass, $hash) && $f && (int)$f['activo'] === 1;
    if (!$ok) {
        login_fallo('admin', $usuario);
        registrar('admin_login_fallido', $usuario, $usuario);
        return 'Usuario o contraseña incorrectos.';
    }
    if (password_needs_rehash($f['pass_hash'], PASSWORD_DEFAULT)) {
        q('UPDATE admin_usuarios SET pass_hash=? WHERE usuario=?', [password_hash($pass, PASSWORD_DEFAULT), $f['usuario']]);
    }
    login_limpiar('admin', $f['usuario']);
    session_regenerate_id(true);
    $_SESSION = [];
    $_SESSION['admin'] = [
        'usuario' => $f['usuario'],
        'inicio'  => time(),
        'ultimo'  => time(),
        'huella'  => huella_cliente(),
    ];
    csrf_token();
    q('UPDATE admin_usuarios SET ultimo_login=NOW() WHERE usuario=?', [$f['usuario']]);
    registrar('admin_login', '', $f['usuario']);
    return '';
}

function admin_cerrar(string $motivo = ''): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        admin_sesion();
    }
    $u = $_SESSION['admin']['usuario'] ?? '';
    if ($u !== '') {
        registrar('admin_logout', $motivo, $u);
    }
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
}

/** Para paginas HTML del panel: sin sesion -> login. */
function admin_requerir_pagina(): string
{
    $u = admin_actual();
    if ($u === null) {
        header('Location: /login.php');
        exit;
    }
    cabeceras_seguras(true);
    return $u;
}

/** Para la API del panel: solo POST, con sesion valida y token CSRF. */
function admin_requerir_api(): string
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_error('Método no permitido', 405);
    }
    $u = admin_actual();
    if ($u === null) {
        json_error('Sesión vencida. Volvé a entrar.', 401);
    }
    if (!csrf_valido()) {
        registrar('admin_csrf_invalido', $_SERVER['REQUEST_URI'] ?? '', $u);
        json_error('Token de seguridad inválido. Recargá la página.', 403);
    }
    // la API puede tardar (indexar, subir); que no bloquee otras pestanias
    session_write_close();
    return $u;
}

/**
 * Despacha ?a=<accion> a la funcion correspondiente. Cada accion recibe el usuario
 * admin y devuelve un array que se manda como JSON con ok=true.
 * Errores de validacion -> 400 con el mensaje; errores internos -> 500 generico.
 */
function admin_despachar(array $acciones): never
{
    $yo = admin_requerir_api();
    $a = (string)($_GET['a'] ?? '');
    if (!isset($acciones[$a])) {
        json_error('Acción desconocida', 404);
    }
    try {
        $r = $acciones[$a]($yo);
        json_salida(['ok' => true] + (is_array($r) ? $r : []));
    } catch (InvalidArgumentException $e) {
        json_error($e->getMessage(), 400);
    } catch (mysqli_sql_exception $e) {
        error_log('[panel] ' . $e->getMessage());
        json_error($e->getCode() === 1062 ? 'Ya existe un registro con ese dato.' : 'Error de base de datos.', 500);
    } catch (Throwable $e) {
        error_log('[panel] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        json_error('Error interno: ' . $e->getMessage(), 500);
    }
}
