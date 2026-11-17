<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';

cuenta_sesion();
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_valido()) {
    cuenta_cerrar();
}
header('Location: login.php');
