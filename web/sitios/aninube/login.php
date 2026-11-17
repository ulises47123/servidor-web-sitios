<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';

cuenta_pagina_login([
    'nombre' => 'AniNube',
    'acento' => '#a78bfa',
    'fondo'  => '#0a0d1a',
    'lema'   => 'Tu anime, en la nube de casa',
    'logo'   => file_get_contents(__DIR__ . '/img/logo.svg'),
]);
