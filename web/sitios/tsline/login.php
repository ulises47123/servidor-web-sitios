<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';

cuenta_pagina_login([
    'nombre' => 'TS_LINE',
    'acento' => '#ff8a3d',
    'fondo'  => '#0b0b0f',
    'lema'   => 'Entrá para escuchar tu música',
    'logo'   => file_get_contents(__DIR__ . '/img/logo.svg'),
]);
