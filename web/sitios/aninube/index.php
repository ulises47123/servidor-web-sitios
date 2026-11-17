<?php
/** AniNube: anime para ver online (requiere cuenta). */
declare(strict_types=1);

require_once __DIR__ . '/../../_app/cuentas.php';

$c = cuenta_requerir_pagina();
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
$tok = csrf_token();
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0a0d1a">
<meta name="csrf" content="<?= h($tok) ?>">
<title>AniNube</title>
<link rel="icon" href="img/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/app.css?v=1">
<script type="module" src="js/app.js?v=1"></script>
</head>
<body>
<a class="saltar" href="#vista">Saltar al contenido</a>
<header class="top" id="top">
  <a class="marca" href="#/inicio"><img src="img/logo.svg" alt="" width="34" height="34"><span>Ani<b>Nube</b></span></a>
  <nav class="nav" aria-label="Secciones">
    <a href="#/inicio" data-ruta="inicio">Inicio</a>
    <a href="#/catalogo" data-ruta="catalogo">Catálogo</a>
    <a href="#/mi-lista" data-ruta="mi-lista">Mi lista</a>
    <a href="#/historial" data-ruta="historial">Historial</a>
  </nav>
  <form class="buscar" id="formBuscar" role="search">
    <input type="search" id="buscar" placeholder="Buscar anime…" aria-label="Buscar anime" autocomplete="off">
  </form>
  <div class="usuario">
    <button class="avatar" id="btnUsuario" aria-haspopup="true" aria-expanded="false" title="<?= h($c['usuario']) ?>"><?= h(mb_strtoupper(mb_substr($c['usuario'], 0, 1))) ?></button>
    <div class="pop" id="popUsuario" hidden>
      <div class="pop-nombre"><?= h($c['usuario']) ?></div>
      <form method="post" action="logout.php"><input type="hidden" name="_csrf" value="<?= h($tok) ?>"><button type="submit">Cerrar sesión</button></form>
    </div>
  </div>
</header>
<main id="vista" tabindex="-1"><div class="cargando">Cargando…</div></main>
<nav class="nav-movil" aria-label="Secciones">
  <a href="#/inicio" data-ruta="inicio"><span aria-hidden="true">⌂</span>Inicio</a>
  <a href="#/catalogo" data-ruta="catalogo"><span aria-hidden="true">▦</span>Catálogo</a>
  <a href="#/mi-lista" data-ruta="mi-lista"><span aria-hidden="true">★</span>Mi lista</a>
  <a href="#/historial" data-ruta="historial"><span aria-hidden="true">🕑</span>Historial</a>
</nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
</body>
</html>
