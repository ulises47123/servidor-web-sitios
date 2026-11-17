<?php
/** "Sorprendeme": una pagina al azar entre las visibles desde esta puerta. */
declare(strict_types=1);

require_once __DIR__ . '/../_app/buscador.php';

try {
    $url = good_azar();
} catch (Throwable) {
    $url = null;
}
header('Cache-Control: no-store');
header('Location: ' . ($url && str_starts_with($url, '/sitios/') ? $url : '/?ver=sitios'), true, 302);
