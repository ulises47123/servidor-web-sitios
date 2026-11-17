<?php
/** TS_LINE: reproductor de musica (requiere cuenta). */
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
<meta name="theme-color" content="#0b0b0f">
<meta name="csrf" content="<?= h($tok) ?>">
<meta name="usuario" content="<?= h($c['usuario']) ?>">
<title>TS_LINE</title>
<link rel="icon" href="img/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/app.css?v=1">
<script type="module" src="js/app.js?v=1"></script>
</head>
<body>
<a class="saltar" href="#vista">Saltar al contenido</a>
<div class="app">
  <aside class="lateral" aria-label="Navegación">
    <a class="marca" href="#/inicio"><img src="img/logo.svg" alt="" width="34" height="34"><span>TS_LINE</span></a>
    <nav class="nav-principal">
      <a href="#/inicio" data-ruta="inicio"><span aria-hidden="true">⌂</span> Inicio</a>
      <a href="#/buscar" data-ruta="buscar"><span aria-hidden="true">⌕</span> Buscar</a>
    </nav>
    <div class="biblioteca">
      <div class="biblioteca-cab"><span>Tu biblioteca</span>
        <button class="icono" id="btnNuevaLista" title="Crear playlist" aria-label="Crear playlist">＋</button></div>
      <ul id="listaBiblioteca" class="lista-biblioteca"></ul>
    </div>
  </aside>

  <main class="vista" id="vista" tabindex="-1">
    <div class="cargando">Cargando tu música…</div>
  </main>

  <aside class="panel-der" id="panelDer" hidden aria-label="Cola y letra">
    <div class="panel-tabs" role="tablist">
      <button role="tab" data-tab="cola" aria-selected="true">Cola</button>
      <button role="tab" data-tab="letra" aria-selected="false">Letra</button>
      <button class="icono" id="cerrarPanel" aria-label="Cerrar panel">✕</button>
    </div>
    <div class="panel-cuerpo" id="panelCuerpo"></div>
  </aside>
</div>

<div class="usuario-menu">
  <button class="avatar" id="btnUsuario" aria-haspopup="true" aria-expanded="false" title="<?= h($c['usuario']) ?>"><?= h(mb_strtoupper(mb_substr($c['usuario'], 0, 1))) ?></button>
  <div class="usuario-pop" id="popUsuario" hidden>
    <div class="usuario-nombre"><?= h($c['usuario']) ?></div>
    <button id="btnGeneros">Mis géneros</button>
    <form method="post" action="logout.php"><input type="hidden" name="_csrf" value="<?= h($tok) ?>"><button type="submit">Cerrar sesión</button></form>
  </div>
</div>

<footer class="reproductor" id="reproductor" aria-label="Reproductor">
  <div class="rep-info">
    <button class="rep-portada" id="repPortada" aria-label="Abrir reproductor"><img id="repImg" alt=""></button>
    <div class="rep-textos"><div class="rep-titulo" id="repTitulo">Elegí una canción</div><div class="rep-artista" id="repArtista"></div></div>
    <button class="icono corazon" id="repLike" aria-label="Me gusta" aria-pressed="false" disabled>♡</button>
  </div>
  <div class="rep-centro">
    <div class="rep-controles">
      <button class="icono" id="btnAleatorio" aria-label="Aleatorio" aria-pressed="false" title="Aleatorio (S)">⤮</button>
      <button class="icono" id="btnAnterior" aria-label="Anterior" title="Anterior (Shift+←)">⏮</button>
      <button class="play" id="btnPlay" aria-label="Reproducir" title="Reproducir/Pausa (Espacio)">▶</button>
      <button class="icono" id="btnSiguiente" aria-label="Siguiente" title="Siguiente (Shift+→)">⏭</button>
      <button class="icono" id="btnRepetir" aria-label="Repetir: no" title="Repetir (R)">↻</button>
    </div>
    <div class="rep-progreso">
      <span id="tActual">0:00</span>
      <input type="range" id="barra" min="0" max="1000" value="0" step="1" aria-label="Posición">
      <span id="tTotal">0:00</span>
    </div>
  </div>
  <div class="rep-der">
    <button class="icono" id="btnLetra" aria-label="Letra" title="Letra" aria-pressed="false">🎤</button>
    <button class="icono" id="btnCola" aria-label="Cola" title="Cola (Q)" aria-pressed="false">☰</button>
    <button class="icono" id="btnMute" aria-label="Silenciar" title="Silenciar (M)">🔊</button>
    <input type="range" id="volumen" min="0" max="100" value="80" aria-label="Volumen">
  </div>
</footer>

<nav class="nav-movil" aria-label="Navegación">
  <a href="#/inicio" data-ruta="inicio"><span aria-hidden="true">⌂</span>Inicio</a>
  <a href="#/buscar" data-ruta="buscar"><span aria-hidden="true">⌕</span>Buscar</a>
  <a href="#/biblioteca" data-ruta="biblioteca"><span aria-hidden="true">▤</span>Biblioteca</a>
</nav>

<div class="menu-ctx" id="menu" role="menu" hidden></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<dialog id="dlg"></dialog>
<audio id="audio" preload="metadata"></audio>
</body>
</html>
