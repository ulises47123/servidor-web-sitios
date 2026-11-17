<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/admin_auth.php';

// Solo por POST con token: un enlace externo no puede cerrar la sesion.
admin_sesion();
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_valido()) {
    admin_cerrar('manual');
}
header('Location: /login.php');
