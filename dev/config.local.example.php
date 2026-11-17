<?php
// Ejemplo de configuración local. Copialo como dev/config.local.php (ese archivo NO se sube al repo).
return [
    'entorno' => 'pc',
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3307,
        'user' => 'panel',
        'pass' => '<password>',
        'name' => 'servidor',
    ],
    // en el servidor: '/usr/bin/doas /usr/local/sbin/panel-energia'
    'energia_cmd' => '',
];
