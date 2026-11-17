<?php
/**
 * Cuentas de los sitios publicos (TS_LINE y AniNube comparten login).
 * Las cuentas se crean desde el panel admin; aca solo se entra y se sale.
 */
declare(strict_types=1);

require_once __DIR__ . '/seguridad.php';

const CUENTA_VIDA       = 30 * 24 * 3600;  // la sesion no se cierra al refrescar
const CUENTA_MAX_FALLOS = 10;

function cuenta_sesion(): void
{
    sesion_abrir('CUENTASESS', '/sitios/', 'Lax', CUENTA_VIDA);
}

/** ['id'=>int,'usuario'=>string] o null. */
function cuenta_actual(): ?array
{
    cuenta_sesion();
    $id = $_SESSION['cuenta_id'] ?? null;
    if (!is_int($id)) {
        return null;
    }
    if (!hash_equals($_SESSION['huella'] ?? '', huella_cliente())) {
        cuenta_cerrar();
        return null;
    }
    static $cache = [];
    if (!isset($cache[$id])) {
        $f = fila('SELECT id, usuario, activa FROM cuentas WHERE id=?', [$id]);
        if (!$f || (int)$f['activa'] !== 1) {
            cuenta_cerrar();
            return null;
        }
        $cache[$id] = ['id' => (int)$f['id'], 'usuario' => $f['usuario']];
    }
    return $cache[$id];
}

function cuenta_login(string $usuario, string $pass): string
{
    cuenta_sesion();
    $usuario = trim($usuario);
    if (login_bloqueado('cuentas', $usuario, CUENTA_MAX_FALLOS)) {
        return 'Demasiados intentos. Probá de nuevo en ' . BLOQUEO_VENTANA_MIN . ' minutos.';
    }
    $f = $usuario === '' ? null : fila('SELECT id, usuario, pass_hash, activa FROM cuentas WHERE usuario=?', [$usuario]);
    $hash = $f['pass_hash'] ?? hash_relleno();
    if (!password_verify($pass, $hash) || !$f || (int)$f['activa'] !== 1) {
        login_fallo('cuentas', $usuario);
        return 'Usuario o contraseña incorrectos.';
    }
    if (password_needs_rehash($f['pass_hash'], PASSWORD_DEFAULT)) {
        q('UPDATE cuentas SET pass_hash=? WHERE id=?', [password_hash($pass, PASSWORD_DEFAULT), (int)$f['id']]);
    }
    login_limpiar('cuentas', $f['usuario']);
    session_regenerate_id(true);
    $_SESSION = ['cuenta_id' => (int)$f['id'], 'huella' => huella_cliente()];
    csrf_token();
    q('UPDATE cuentas SET ultimo_login=NOW() WHERE id=?', [(int)$f['id']]);
    return '';
}

function cuenta_cerrar(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        cuenta_sesion();
    }
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    session_destroy();
}

/** Paginas: sin sesion -> login.php del propio sitio. */
function cuenta_requerir_pagina(): array
{
    $c = cuenta_actual();
    if ($c === null) {
        header('Location: login.php');
        exit;
    }
    cabeceras_seguras();
    return $c;
}

/** API: sesion valida; los POST ademas exigen token CSRF. */
function cuenta_requerir_api(): array
{
    $c = cuenta_actual();
    if ($c === null) {
        json_error('Tu sesión terminó. Volvé a entrar.', 401);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' && !csrf_valido()) {
        json_error('Token de seguridad inválido. Recargá la página.', 403);
    }
    session_write_close();
    return $c;
}

/**
 * Pantalla de login compartida con la marca de cada sitio.
 * $marca = ['nombre','acento','fondo','logo'(svg),'lema'].
 */
function cuenta_pagina_login(array $marca): never
{
    cuenta_sesion();
    if (cuenta_actual() !== null) {
        header('Location: ./');
        exit;
    }
    $err = '';
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        if (!csrf_valido()) {
            $err = 'La página venció. Probá de nuevo.';
        } else {
            $err = cuenta_login((string)($_POST['usuario'] ?? ''), (string)($_POST['pass'] ?? ''));
            if ($err === '') {
                header('Location: ./');
                exit;
            }
        }
    }
    cabeceras_seguras(true);
    $tok = csrf_token();
    $a = h($marca['acento']);
    $f = h($marca['fondo']);
    header('Content-Type: text/html; charset=utf-8');
    ?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Entrar · <?= h($marca['nombre']) ?></title>
<style>
  :root { --acento: <?= $a ?>; --fondo: <?= $f ?>; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100dvh; display: grid; place-items: center; padding: 16px; color: #f3f4f6;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
         background: radial-gradient(900px 500px at 50% -10%, color-mix(in srgb, var(--acento) 35%, transparent), var(--fondo) 65%); }
  form { width: 100%; max-width: 380px; background: rgba(18,20,26,.92); border: 1px solid #2a2f3a; border-radius: 18px; padding: 30px 24px; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
  .logo { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.6rem; font-weight: 800; }
  .logo svg { width: 36px; height: 36px; }
  .lema { text-align: center; color: #a6adbb; font-size: .92rem; margin: 6px 0 22px; }
  label { display: block; font-size: .82rem; color: #cfd3dc; margin: 14px 0 6px; }
  input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #353b48; background: #1b1f27; color: #fff; font-size: 1rem; }
  input:focus { outline: 2px solid var(--acento); outline-offset: 1px; border-color: transparent; }
  button { width: 100%; margin-top: 22px; padding: 13px; border: 0; border-radius: 999px; background: var(--acento); color: #111; font-weight: 800; font-size: 1rem; cursor: pointer; }
  button:hover { filter: brightness(1.08); }
  button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .err { margin-top: 16px; padding: 10px 12px; border-radius: 10px; background: rgba(239,68,68,.14); border: 1px solid rgba(239,68,68,.4); color: #fecaca; font-size: .88rem; text-align: center; }
  .nota { margin-top: 18px; color: #8b93a3; font-size: .8rem; text-align: center; line-height: 1.5; }
</style>
</head>
<body>
<form method="post" autocomplete="on">
  <div class="logo"><?= $marca['logo'] ?><span><?= h($marca['nombre']) ?></span></div>
  <p class="lema"><?= h($marca['lema']) ?></p>
  <input type="hidden" name="_csrf" value="<?= h($tok) ?>">
  <label for="usuario">Usuario</label>
  <input id="usuario" name="usuario" autocomplete="username" required autofocus>
  <label for="pass">Contraseña</label>
  <input id="pass" name="pass" type="password" autocomplete="current-password" required>
  <button type="submit">Entrar</button>
  <?php if ($err !== ''): ?><div class="err" role="alert"><?= h($err) ?></div><?php endif; ?>
  <p class="nota">La misma cuenta sirve para TS_LINE y AniNube.<br>Las cuentas las crea el administrador.</p>
</form>
</body>
</html>
<?php
    exit;
}
