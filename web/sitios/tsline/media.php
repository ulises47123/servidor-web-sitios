<?php
/** Audio, portadas y letras de TS_LINE (solo con sesion). */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';
require_once __DIR__ . '/../../_app/media.php';

if (cuenta_actual() === null) {
    http_response_code(403);
    exit;
}
session_write_close();
media_atender(['audio', 'cover', 'letra']);
