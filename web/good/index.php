<?php
/**
 * Good: portada del servidor y buscador de los sitios alojados.
 *   /               portada
 *   /?q=texto       resultados (&tipo=pagina|anime|musica, &p=N)
 *   /?ver=sitios    explorar sitios
 */
declare(strict_types=1);

require_once __DIR__ . '/../_app/buscador.php';
require_once __DIR__ . '/../_app/sitios.php';
require_once __DIR__ . '/../_app/seguridad.php';

cabeceras_seguras();
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'");

$q = mb_substr(trim((string)($_GET['q'] ?? '')), 0, 200);
$tipo = (string)($_GET['tipo'] ?? 'todo');
if (!isset(GOOD_TIPOS[$tipo])) {
    $tipo = 'todo';
}
$pag = max(1, min(50, (int)($_GET['p'] ?? 1)));
$ver = (string)($_GET['ver'] ?? '');
$local = alcance() !== 'publico';

$modo = $q !== '' ? 'resultados' : ($ver === 'sitios' ? 'sitios' : 'portada');
$res = null;
$t0 = microtime(true);
try {
    if ($modo === 'resultados') {
        $res = good_buscar($q, $tipo, $pag);
    }
    $sitios = $modo !== 'resultados' ? sitios_visibles(alcance()) : [];
    $error = '';
} catch (Throwable $e) {
    error_log('[good] ' . $e->getMessage());
    $error = 'El buscador no está disponible en este momento.';
    $sitios = [];
}
$ms = (int)round((microtime(true) - $t0) * 1000);

function url_good(array $p): string
{
    return '/?' . http_build_query(array_filter($p, fn($v) => $v !== '' && $v !== null && $v !== 'todo' && $v !== 1));
}

$titulo = match ($modo) {
    'resultados' => "$q - Good",
    'sitios' => 'Explorar sitios - Good',
    default => 'Good',
};
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= h($titulo) ?></title>
<meta name="description" content="Good: el buscador de las páginas alojadas en este servidor.">
<link rel="icon" href="/good/assets/icono.svg" type="image/svg+xml">
<link rel="stylesheet" href="/good/assets/good.css?v=3">
<script src="/good/assets/good.js?v=3" defer></script>
</head>
<body class="modo-<?= h($modo) ?>">

<?php if ($modo === 'portada'): ?>
<header class="barra">
  <a href="/?ver=sitios">Explorar sitios</a>
  <a href="/good/azar.php">Sorprendeme</a>
  <?php if ($local): ?><span class="insignia" title="Estás en la red local: ves también los sitios privados">Red local</span><?php endif; ?>
</header>
<main class="portada">
  <h1 class="logo">Good</h1>
  <form class="buscador" action="/" method="get" role="search" autocomplete="off">
    <div class="caja" id="caja">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input id="q" name="q" type="search" placeholder="Buscá páginas, anime, música…" aria-label="Buscar" autofocus maxlength="200" aria-autocomplete="list" aria-controls="sugerencias" aria-expanded="false">
    </div>
    <ul class="sugerencias" id="sugerencias" role="listbox" aria-label="Sugerencias"></ul>
    <div class="botones">
      <button type="submit">Buscar con Good</button>
      <a class="boton" href="/good/azar.php">Sorprendeme</a>
    </div>
  </form>
  <?php if ($sitios): ?>
  <nav class="atajos" aria-label="Sitios">
    <?php foreach (array_slice($sitios, 0, 8) as $s): ?>
      <a href="/sitios/<?= h($s['slug']) ?>/" class="atajo">
        <span class="av c-<?= h($s['color']) ?>"><?= h($s['icono']) ?></span>
        <span><?= h($s['nombre']) ?></span>
      </a>
    <?php endforeach; ?>
  </nav>
  <?php endif; ?>
  <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
</main>

<?php else: ?>
<header class="cabecera">
  <a class="logo chico" href="/" aria-label="Good, inicio">Good</a>
  <form class="buscador" action="/" method="get" role="search" autocomplete="off">
    <div class="caja" id="caja">
      <input id="q" name="q" type="search" value="<?= h($q) ?>" placeholder="Buscar en Good" aria-label="Buscar" maxlength="200" aria-autocomplete="list" aria-controls="sugerencias" aria-expanded="false">
      <button class="lupa" type="submit" aria-label="Buscar"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></button>
    </div>
    <ul class="sugerencias" id="sugerencias" role="listbox" aria-label="Sugerencias"></ul>
    <?php if ($tipo !== 'todo'): ?><input type="hidden" name="tipo" value="<?= h($tipo) ?>"><?php endif; ?>
  </form>
  <?php if ($local): ?><span class="insignia" title="Estás en la red local: ves también los sitios privados">Red local</span><?php endif; ?>
</header>

<?php if ($modo === 'resultados'): ?>
<nav class="pestanias" aria-label="Tipo de resultado">
  <?php foreach (GOOD_TIPOS as $k => $n):
      $cant = $k === 'todo' ? array_sum($res['por_tipo'] ?? []) : ($res['por_tipo'][$k] ?? 0); ?>
    <a href="<?= h(url_good(['q' => $q, 'tipo' => $k])) ?>" class="<?= $k === $tipo ? 'activa' : '' ?>" <?= $k === $tipo ? 'aria-current="page"' : '' ?>>
      <?= h($n) ?><?= $cant ? ' <small>' . $cant . '</small>' : '' ?></a>
  <?php endforeach; ?>
</nav>
<main class="resultados">
  <?php if ($error): ?>
    <p class="error"><?= h($error) ?></p>
  <?php elseif (!$res['total']): ?>
    <div class="sin-resultados">
      <p>No encontramos nada para <b><?= h($q) ?></b><?= $tipo !== 'todo' ? ' en ' . h(mb_strtolower(GOOD_TIPOS[$tipo])) : '' ?>.</p>
      <ul><li>Revisá que las palabras estén bien escritas.</li><li>Probá con palabras más generales o con menos palabras.</li>
        <?php if ($tipo !== 'todo'): ?><li><a href="<?= h(url_good(['q' => $q])) ?>">Buscar en todo</a></li><?php endif; ?>
        <li><a href="/?ver=sitios">Explorar los sitios disponibles</a></li></ul>
    </div>
  <?php else: ?>
    <p class="meta-res">Cerca de <?= $res['total'] ?> resultado<?= $res['total'] === 1 ? '' : 's' ?> (<?= $ms / 1000 ?> s)</p>
    <?php foreach ($res['resultados'] as $r): ?>
      <article class="resultado">
        <div class="origen">
          <span class="av c-<?= h($r['color']) ?>"><?= h($r['icono']) ?></span>
          <div><div class="sitio"><?= h($r['sitio_nombre']) ?>
            <?php if ($r['tipo'] !== 'pagina'): ?><span class="etiqueta"><?= h(GOOD_TIPOS[$r['tipo']] ?? $r['tipo']) ?></span><?php endif; ?>
            <?php if ($local && !(int)$r['publica']): ?><span class="etiqueta privada">privado</span><?php endif; ?></div>
            <div class="url"><?= h(rawurldecode($r['url'])) ?></div></div>
        </div>
        <h2><a href="<?= h($r['url']) ?>"><?= $r['titulo_html'] ?></a></h2>
        <p><?= $r['fragmento'] ?></p>
      </article>
    <?php endforeach; ?>
    <?php $paginas = (int)ceil($res['total'] / GOOD_POR_PAGINA); if ($paginas > 1): ?>
      <nav class="paginacion" aria-label="Páginas de resultados">
        <?php if ($pag > 1): ?><a href="<?= h(url_good(['q' => $q, 'tipo' => $tipo, 'p' => $pag - 1])) ?>" rel="prev">‹ Anterior</a><?php endif; ?>
        <?php for ($i = max(1, $pag - 4); $i <= min($paginas, $pag + 4); $i++): ?>
          <?= $i === $pag ? '<span aria-current="page">' . $i . '</span>' : '<a href="' . h(url_good(['q' => $q, 'tipo' => $tipo, 'p' => $i])) . '">' . $i . '</a>' ?>
        <?php endfor; ?>
        <?php if ($pag < $paginas): ?><a href="<?= h(url_good(['q' => $q, 'tipo' => $tipo, 'p' => $pag + 1])) ?>" rel="next">Siguiente ›</a><?php endif; ?>
      </nav>
    <?php endif; ?>
  <?php endif; ?>
  <p class="web">¿No está acá? <a href="https://duckduckgo.com/?q=<?= rawurlencode($q) ?>" rel="noopener noreferrer">Buscar “<?= h($q) ?>” en la web ↗</a></p>
</main>

<?php else: /* explorar sitios */ ?>
<main class="explorar">
  <h1>Explorar sitios</h1>
  <p class="meta-res"><?= count($sitios) ?> sitio<?= count($sitios) === 1 ? '' : 's' ?> disponible<?= count($sitios) === 1 ? '' : 's' ?><?= $local ? ' (incluye los privados de la red local)' : '' ?></p>
  <div class="grilla">
    <?php foreach ($sitios as $s): ?>
      <a class="tarjeta" href="/sitios/<?= h($s['slug']) ?>/">
        <span class="av grande c-<?= h($s['color']) ?>"><?= h($s['icono']) ?></span>
        <span class="cat"><?= h($s['categoria']) ?><?= $local && !(int)$s['publica'] ? ' · <b class="privada">privado</b>' : '' ?></span>
        <span class="nombre"><?= h($s['nombre']) ?></span>
        <span class="desc"><?= h($s['descripcion']) ?></span>
        <span class="ir">Entrar →</span>
      </a>
    <?php endforeach; ?>
    <?php if (!$sitios): ?><p class="sin-resultados">Todavía no hay sitios publicados.</p><?php endif; ?>
  </div>
</main>
<?php endif; ?>
<?php endif; ?>

<footer class="pie">
  <span>Good · buscador del servidor</span>
  <span><a href="/?ver=sitios">Sitios</a> · <a href="/good/azar.php">Al azar</a></span>
</footer>
</body>
</html>
