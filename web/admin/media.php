<?php
/** Vista previa de multimedia para el panel (requiere sesion de admin). */
declare(strict_types=1);

require_once __DIR__ . '/../_app/admin_auth.php';
require_once __DIR__ . '/../_app/media.php';

if (admin_actual() === null) {
    http_response_code(403);
    exit;
}
session_write_close();
media_atender(['audio', 'cover', 'letra', 'portada', 'banner', 'video', 'miniatura']);
