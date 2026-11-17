/* La Olla — funciones de cada receta:
   calculadora de porciones, modo cocina e impresión. */
(function () {
  'use strict';

  /* ================= Calculadora de porciones ================= */

  var FRACCIONES = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };

  // tipo "u": unidades enteras (huevos, cebollas...)
  // tipo "f": medidas caseras (tazas, cucharadas) en cuartos
  // tipo "m": pesos y volúmenes (g, ml) con redondeo según el tamaño
  function redondear(valor, tipo) {
    if (tipo === 'u') return Math.max(1, Math.round(valor));
    if (tipo === 'f') return Math.max(0.25, Math.round(valor * 4) / 4);
    var paso;
    if (valor < 10) paso = 0.5;
    else if (valor < 50) paso = 1;
    else if (valor < 200) paso = 5;
    else if (valor < 1000) paso = 10;
    else paso = 25;
    return Math.max(paso, Math.round(valor / paso) * paso);
  }

  function formatear(valor, tipo) {
    if (tipo === 'f') {
      var entero = Math.floor(valor);
      var resto = Math.round((valor - entero) * 4) / 4;
      var fr = FRACCIONES[resto] || '';
      if (!entero) return fr || '0';
      return fr ? entero + ' ' + fr : String(entero);
    }
    return String(valor).replace('.', ',');
  }

  function aplicarPlural(contenedor, valor) {
    var singular = valor <= 1;
    var spans = contenedor.querySelectorAll('.pl');
    for (var i = 0; i < spans.length; i++) {
      spans[i].textContent = singular ? spans[i].getAttribute('data-s') : spans[i].getAttribute('data-p');
    }
  }

  var calc = document.querySelector('.calculadora[data-porciones-base]');
  if (calc) {
    var base = parseInt(calc.getAttribute('data-porciones-base'), 10) || 1;
    var actual = base;
    var MAX = Math.max(base * 6, 24);
    var salida = calc.querySelector('output');
    var numero = calc.querySelector('.porciones-num');
    var menos = calc.querySelector('[data-paso="-1"]');
    var mas = calc.querySelector('[data-paso="1"]');
    var reset = calc.querySelector('.calc-reset');
    var items = document.querySelectorAll('.ingredientes li');

    var actualizar = function () {
      var factor = actual / base;
      for (var i = 0; i < items.length; i++) {
        var cant = items[i].querySelector('.cant');
        if (!cant) continue;
        var tipo = cant.getAttribute('data-tipo') || 'm';
        var valorBase = parseFloat(cant.getAttribute('data-base'));
        var valor = factor === 1 ? valorBase : redondear(valorBase * factor, tipo);
        cant.textContent = formatear(valor, tipo);
        aplicarPlural(items[i], valor);
      }
      numero.textContent = String(actual);
      aplicarPlural(salida, actual);
      menos.disabled = actual <= 1;
      mas.disabled = actual >= MAX;
      reset.hidden = actual === base;
    };

    var cambiar = function (delta) {
      var nuevo = Math.min(MAX, Math.max(1, actual + delta));
      if (nuevo !== actual) {
        actual = nuevo;
        actualizar();
      }
    };

    menos.addEventListener('click', function () { cambiar(-1); });
    mas.addEventListener('click', function () { cambiar(1); });
    reset.addEventListener('click', function () {
      actual = base;
      actualizar();
      mas.focus();
    });

    menos.hidden = false;
    mas.hidden = false;
    var nota = calc.parentNode.querySelector('.calc-nota');
    if (nota) nota.hidden = false;
    actualizar();
  }

  /* ================= Imprimir ================= */

  var botonImprimir = document.getElementById('btn-imprimir');
  if (botonImprimir && typeof window.print === 'function') {
    botonImprimir.hidden = false;
    botonImprimir.addEventListener('click', function () { window.print(); });
  }

  /* ================= Modo cocina ================= */

  var botonCocina = document.getElementById('btn-modo-cocina');
  var listaPasos = document.querySelectorAll('.pasos > li');
  if (!botonCocina || !listaPasos.length) return;

  var pasos = Array.prototype.map.call(listaPasos, function (li) {
    return li.textContent.replace(/\s+/g, ' ').trim();
  });
  var titulo = (document.querySelector('h1') || {}).textContent || '';
  var capa = null;
  var indice = 0;
  var wakeLock = null;
  var focoPrevio = null;
  var toqueX = null;
  var el = {};

  function crearCapa() {
    capa = document.createElement('div');
    capa.className = 'modo-cocina';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'mc-titulo');
    capa.innerHTML =
      '<div class="mc-cabecera">' +
        '<div><p class="mc-receta" id="mc-titulo"></p><p class="mc-contador"></p></div>' +
        '<button type="button" class="boton boton-sec mc-cerrar">Salir <span aria-hidden="true">✕</span></button>' +
      '</div>' +
      '<div class="mc-progreso" aria-hidden="true"><div class="mc-barra"></div></div>' +
      '<div class="mc-paso"><p class="mc-texto" tabindex="-1" aria-live="polite"></p></div>' +
      '<p class="mc-ayuda">Usá las flechas ← → del teclado o deslizá el dedo para cambiar de paso. Esc para salir.</p>' +
      '<p class="mc-wake"></p>' +
      '<div class="mc-nav">' +
        '<button type="button" class="boton boton-sec mc-ant"><span aria-hidden="true">←</span> Anterior</button>' +
        '<button type="button" class="boton mc-sig">Siguiente <span aria-hidden="true">→</span></button>' +
      '</div>';
    document.body.appendChild(capa);

    el.titulo = capa.querySelector('.mc-receta');
    el.contador = capa.querySelector('.mc-contador');
    el.barra = capa.querySelector('.mc-barra');
    el.texto = capa.querySelector('.mc-texto');
    el.wake = capa.querySelector('.mc-wake');
    el.ant = capa.querySelector('.mc-ant');
    el.sig = capa.querySelector('.mc-sig');
    el.cerrar = capa.querySelector('.mc-cerrar');

    el.titulo.textContent = titulo + ' · modo cocina';
    el.ant.addEventListener('click', anterior);
    el.sig.addEventListener('click', siguiente);
    el.cerrar.addEventListener('click', cerrar);

    capa.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) toqueX = e.touches[0].clientX;
    }, { passive: true });
    capa.addEventListener('touchend', function (e) {
      if (toqueX === null || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - toqueX;
      toqueX = null;
      if (Math.abs(dx) < 60) return;
      if (dx < 0) siguiente(); else anterior();
    });
  }

  function mostrar() {
    var total = pasos.length;
    el.contador.textContent = 'Paso ' + (indice + 1) + ' de ' + total;
    el.texto.textContent = pasos[indice];
    el.barra.style.width = ((indice + 1) / total * 100) + '%';
    el.ant.disabled = indice === 0;
    el.sig.innerHTML = indice === total - 1
      ? 'Terminar <span aria-hidden="true">✓</span>'
      : 'Siguiente <span aria-hidden="true">→</span>';
    var paso = capa.querySelector('.mc-paso');
    if (paso) paso.scrollTop = 0;
  }

  function anterior() {
    if (indice > 0) { indice--; mostrar(); }
  }

  function siguiente() {
    if (indice < pasos.length - 1) { indice++; mostrar(); }
    else cerrar();
  }

  function pedirWakeLock() {
    if (!el.wake) return;
    try {
      if (!('wakeLock' in navigator) || !navigator.wakeLock) {
        el.wake.textContent = 'Tu navegador no puede mantener la pantalla encendida: revisá el apagado automático del dispositivo.';
        return;
      }
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        el.wake.textContent = 'La pantalla se mantiene encendida mientras cocinás.';
        lock.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {
        el.wake.textContent = 'No se pudo mantener la pantalla encendida.';
      });
    } catch (e) {
      el.wake.textContent = 'No se pudo mantener la pantalla encendida.';
    }
  }

  function soltarWakeLock() {
    try {
      if (wakeLock) wakeLock.release();
    } catch (e) { /* nada */ }
    wakeLock = null;
  }

  function enfocables() {
    return Array.prototype.filter.call(
      capa.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.disabled && n.offsetParent !== null; }
    );
  }

  function alTeclado(e) {
    if (!capa || capa.hidden) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'PageDown') { e.preventDefault(); siguiente(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === 'PageUp') { e.preventDefault(); anterior(); return; }
    if (e.key === 'Tab') {
      var f = enfocables();
      if (!f.length) return;
      var primero = f[0];
      var ultimo = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !capa.contains(document.activeElement))) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !capa.contains(document.activeElement))) {
        e.preventDefault(); primero.focus();
      }
    }
  }

  function alCambiarVisibilidad() {
    if (capa && !capa.hidden && document.visibilityState === 'visible' && !wakeLock) pedirWakeLock();
  }

  function abrir() {
    if (!capa) crearCapa();
    focoPrevio = document.activeElement;
    indice = 0;
    capa.hidden = false;
    document.body.classList.add('sin-scroll');
    mostrar();
    el.sig.focus();
    document.addEventListener('keydown', alTeclado);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    pedirWakeLock();
  }

  function cerrar() {
    if (!capa) return;
    capa.hidden = true;
    document.body.classList.remove('sin-scroll');
    document.removeEventListener('keydown', alTeclado);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    soltarWakeLock();
    if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
  }

  botonCocina.hidden = false;
  botonCocina.addEventListener('click', abrir);
})();
