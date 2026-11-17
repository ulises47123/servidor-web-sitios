<?php
/** Sugerencias de autocompletado para Good (JSON). */
declare(strict_types=1);

require_once __DIR__ . '/../_app/buscador.php';

try {
    $s = good_sugerir(mb_substr((string)($_GET['q'] ?? ''), 0, 100));
} catch (Throwable) {
    $s = [];
}
header('Cache-Control: private, max-age=60');
json_salida(['ok' => true, 'sugerencias' => $s]);
