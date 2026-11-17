<?php
/**
 * Crea (o resetea la contrasena de) un administrador del panel.
 * Uso:  php _app/cli/crear-admin.php <usuario>
 * La contrasena se pide por teclado (no queda en el historial de la consola).
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}
require_once __DIR__ . '/../seguridad.php';

$u = $argv[1] ?? '';
if (($e = validar_usuario($u)) !== '') {
    fwrite(STDERR, "Uso: php crear-admin.php <usuario>\n$e\n");
    exit(1);
}

function leer_oculto(string $msg): string
{
    echo $msg;
    if (DIRECTORY_SEPARATOR === '/') {
        system('stty -echo');
        $p = rtrim((string)fgets(STDIN), "\r\n");
        system('stty echo');
        echo "\n";
        return $p;
    }
    // Windows: sin eco no es trivial; se lee normal
    return rtrim((string)fgets(STDIN), "\r\n");
}

$p1 = getenv('ADMIN_PASS') ?: leer_oculto('Contraseña (mínimo 10 caracteres): ');
$p2 = getenv('ADMIN_PASS') ?: leer_oculto('Repetila: ');
if ($p1 !== $p2) {
    fwrite(STDERR, "No coinciden.\n");
    exit(1);
}
if (($e = validar_pass($p1, 10)) !== '') {
    fwrite(STDERR, "$e\n");
    exit(1);
}
q('INSERT INTO admin_usuarios (usuario, pass_hash, activo) VALUES (?,?,1)
   ON DUPLICATE KEY UPDATE pass_hash=VALUES(pass_hash), activo=1', [$u, password_hash($p1, PASSWORD_DEFAULT)]);
registrar('admin_creado_cli', $u, 'cli');
echo "Administrador '$u' listo.\n";
