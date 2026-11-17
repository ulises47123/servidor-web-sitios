<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/admin_auth.php';

if (admin_actual() !== null) {
    header('Location: /');
    exit;
}
$err = '';
$usuario = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $usuario = trim((string)($_POST['usuario'] ?? ''));
    if (!csrf_valido()) {
        $err = 'La página venció. Probá de nuevo.';
    } else {
        $err = admin_login($usuario, (string)($_POST['pass'] ?? ''));
        if ($err === '') {
            header('Location: /');
            exit;
        }
    }
}
$sin_admins = (int)valor('SELECT COUNT(*) FROM admin_usuarios') === 0;
cabeceras_seguras(true);
$tok = csrf_token();
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Entrar · Panel</title>
<link rel="stylesheet" href="/assets/panel.css?v=2">
</head>
<body class="pagina-login">
<form class="login" method="post" autocomplete="off">
  <div class="brand"><div class="logo" aria-hidden="true">🛡️</div><div><h1>Panel del servidor</h1><p>Acceso restringido · red privada</p></div></div>
  <input type="hidden" name="_csrf" value="<?= h($tok) ?>">
  <label for="usuario">Usuario</label>
  <input id="usuario" name="usuario" value="<?= h($usuario) ?>" autocomplete="username" required autofocus>
  <label for="pass">Contraseña</label>
  <input id="pass" name="pass" type="password" autocomplete="current-password" required>
  <button class="btn" type="submit">Entrar</button>
  <?php if ($err !== ''): ?><div class="aviso error" role="alert"><?= h($err) ?></div><?php endif; ?>
  <?php if ($sin_admins): ?>
    <div class="aviso">Todavía no hay administradores. Creá el primero en la consola del servidor:<br>
      <code>php /srv/www/web/_app/cli/crear-admin.php tu_usuario</code></div>
  <?php endif; ?>
  <p class="nota">La sesión se cierra sola tras 20 minutos sin uso. 5 intentos fallidos bloquean el acceso por 15 minutos.</p>
</form>
</body>
</html>
