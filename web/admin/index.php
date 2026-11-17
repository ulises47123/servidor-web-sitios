<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/admin_auth.php';

$usuario = admin_requerir_pagina();
$tok = csrf_token();
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<meta name="csrf" content="<?= h($tok) ?>">
<meta name="usuario" content="<?= h($usuario) ?>">
<title>Panel · Servidor</title>
<link rel="stylesheet" href="/assets/panel.css?v=2">
<script type="module" src="/assets/js/app.js?v=2"></script>
</head>
<body>
<div class="velo" id="velo"></div>
<aside class="side" id="side" aria-label="Secciones">
  <div class="brand"><div class="logo" aria-hidden="true">🖥️</div><div><h1>Panel Servidor</h1><p>Alpine · administración</p></div></div>
  <nav id="nav">
    <a class="nav-item" href="#resumen"><span class="ic" aria-hidden="true">📊</span> Resumen</a>
    <a class="nav-item" href="#sitios"><span class="ic" aria-hidden="true">🌐</span> Sitios</a>
    <a class="nav-item" href="#good"><span class="ic" aria-hidden="true">🔎</span> Good</a>
    <a class="nav-item" href="#musica"><span class="ic" aria-hidden="true">🎵</span> Música</a>
    <a class="nav-item" href="#anime"><span class="ic" aria-hidden="true">☁️</span> Anime</a>
    <a class="nav-item" href="#cuentas"><span class="ic" aria-hidden="true">👥</span> Cuentas</a>
    <a class="nav-item" href="#admins"><span class="ic" aria-hidden="true">🛡️</span> Administradores</a>
    <a class="nav-item" href="#energia"><span class="ic" aria-hidden="true">🔌</span> Energía</a>
    <a class="nav-item" href="#registro"><span class="ic" aria-hidden="true">📝</span> Registro</a>
  </nav>
  <div class="side-foot">
    <div><span class="dot"></span> Sesión: <b><?= h($usuario) ?></b></div>
    <form method="post" action="/logout.php"><input type="hidden" name="_csrf" value="<?= h($tok) ?>"><button class="btn ghost chico" type="submit">Cerrar sesión</button></form>
  </div>
</aside>
<main class="main">
  <div class="top">
    <div class="top-izq">
      <button class="btn-menu" id="btnMenu" aria-label="Abrir menú" aria-controls="side">☰</button>
      <div><h2 id="tituloSec">Resumen</h2><div class="sub" id="subSec"></div></div>
    </div>
    <span class="pill"><span class="dot"></span> <span id="hostname">servidor</span></span>
  </div>
  <div id="contenido" aria-live="polite"></div>
</main>
<div class="toast" id="toast" role="status"></div>
<dialog id="modal"><form method="dialog" id="modalForm"></form></dialog>
</body>
</html>
