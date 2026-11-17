<?php
/** API: cuentas de los sitios publicos y administradores del panel. */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/admin_auth.php';

admin_despachar([
    /* ------------------------------------------------ cuentas (musica+anime) */
    'cuentas' => fn(): array => ['cuentas' => filas(
        'SELECT c.id, c.usuario, c.activa, c.creado, c.ultimo_login,
                (SELECT COUNT(*) FROM musica_likes l WHERE l.cuenta_id=c.id) AS likes,
                (SELECT COUNT(*) FROM musica_listas m WHERE m.cuenta_id=c.id) AS listas,
                (SELECT COUNT(*) FROM anime_lista a WHERE a.cuenta_id=c.id) AS en_lista
         FROM cuentas c ORDER BY c.usuario')],

    'cuenta_crear' => function (string $yo): array {
        $u = ent_str('usuario', '', 32);
        $p = (string)(entrada()['pass'] ?? '');
        if (($e = validar_usuario($u)) !== '' || ($e = validar_pass($p, 6)) !== '') {
            throw new InvalidArgumentException($e);
        }
        q('INSERT INTO cuentas (usuario, pass_hash) VALUES (?,?)', [$u, password_hash($p, PASSWORD_DEFAULT)]);
        registrar('cuenta_creada', $u, $yo);
        return [];
    },

    'cuenta_pass' => function (string $yo): array {
        $id = ent_int('id');
        $p = (string)(entrada()['pass'] ?? '');
        if (($e = validar_pass($p, 6)) !== '') {
            throw new InvalidArgumentException($e);
        }
        if (!ejecutar('UPDATE cuentas SET pass_hash=? WHERE id=?', [password_hash($p, PASSWORD_DEFAULT), $id])) {
            throw new InvalidArgumentException('No existe la cuenta');
        }
        registrar('cuenta_pass', (string)valor('SELECT usuario FROM cuentas WHERE id=?', [$id]), $yo);
        return [];
    },

    'cuenta_activa' => function (string $yo): array {
        $id = ent_int('id');
        $act = ent_bool('activa');
        ejecutar('UPDATE cuentas SET activa=? WHERE id=?', [$act ? 1 : 0, $id]);
        registrar($act ? 'cuenta_activada' : 'cuenta_desactivada', (string)valor('SELECT usuario FROM cuentas WHERE id=?', [$id]), $yo);
        return [];
    },

    'cuenta_borrar' => function (string $yo): array {
        $id = ent_int('id');
        $u = (string)valor('SELECT usuario FROM cuentas WHERE id=?', [$id]);
        if ($u === '') {
            throw new InvalidArgumentException('No existe la cuenta');
        }
        q('DELETE FROM cuentas WHERE id=?', [$id]);
        registrar('cuenta_borrada', $u, $yo);
        return [];
    },

    /* ------------------------------------------------------ administradores */
    'admins' => fn(string $yo): array => [
        'admins' => filas('SELECT usuario, activo, creado, ultimo_login FROM admin_usuarios ORDER BY usuario'),
        'yo' => $yo,
    ],

    'admin_crear' => function (string $yo): array {
        $u = ent_str('usuario', '', 32);
        $p = (string)(entrada()['pass'] ?? '');
        if (($e = validar_usuario($u)) !== '' || ($e = validar_pass($p, 10)) !== '') {
            throw new InvalidArgumentException($e);
        }
        q('INSERT INTO admin_usuarios (usuario, pass_hash) VALUES (?,?)', [$u, password_hash($p, PASSWORD_DEFAULT)]);
        registrar('admin_creado', $u, $yo);
        return [];
    },

    'admin_pass' => function (string $yo): array {
        $u = ent_str('usuario', '', 32);
        $p = (string)(entrada()['pass'] ?? '');
        if ($u === $yo) {
            // cambiar la propia exige la actual
            $hash = (string)valor('SELECT pass_hash FROM admin_usuarios WHERE usuario=?', [$yo]);
            if (!password_verify((string)(entrada()['actual'] ?? ''), $hash)) {
                throw new InvalidArgumentException('La contraseña actual no es correcta.');
            }
        }
        if (($e = validar_pass($p, 10)) !== '') {
            throw new InvalidArgumentException($e);
        }
        if (!ejecutar('UPDATE admin_usuarios SET pass_hash=? WHERE usuario=?', [password_hash($p, PASSWORD_DEFAULT), $u])) {
            throw new InvalidArgumentException('No existe ese administrador');
        }
        registrar('admin_pass', $u, $yo);
        return [];
    },

    'admin_activo' => function (string $yo): array {
        $u = ent_str('usuario', '', 32);
        $act = ent_bool('activo');
        if ($u === $yo && !$act) {
            throw new InvalidArgumentException('No podés desactivarte a vos mismo.');
        }
        if (!$act && (int)valor('SELECT COUNT(*) FROM admin_usuarios WHERE activo=1 AND usuario<>?', [$u]) === 0) {
            throw new InvalidArgumentException('Tiene que quedar al menos un administrador activo.');
        }
        ejecutar('UPDATE admin_usuarios SET activo=? WHERE usuario=?', [$act ? 1 : 0, $u]);
        registrar($act ? 'admin_activado' : 'admin_desactivado', $u, $yo);
        return [];
    },

    'admin_borrar' => function (string $yo): array {
        $u = ent_str('usuario', '', 32);
        if ($u === $yo) {
            throw new InvalidArgumentException('No podés borrarte a vos mismo.');
        }
        if ((int)valor('SELECT COUNT(*) FROM admin_usuarios WHERE activo=1 AND usuario<>?', [$u]) === 0) {
            throw new InvalidArgumentException('Tiene que quedar al menos un administrador activo.');
        }
        if (!ejecutar('DELETE FROM admin_usuarios WHERE usuario=?', [$u])) {
            throw new InvalidArgumentException('No existe ese administrador');
        }
        registrar('admin_borrado', $u, $yo);
        return [];
    },
]);
