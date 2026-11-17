/* La Olla — buscador y filtros de la portada.
   Las tarjetas ya están en el HTML; acá solo se muestran u ocultan. */
(function () {
  'use strict';

  var form = document.getElementById('filtros');
  var lista = document.getElementById('lista-recetas');
  if (!form || !lista) return;

  var tarjetas = Array.prototype.slice.call(lista.children);
  var campoTexto = form.elements.namedItem('q');
  var campoCategoria = form.elements.namedItem('categoria');
  var campoDificultad = form.elements.namedItem('dificultad');
  var campoTiempo = form.elements.namedItem('tiempo');
  var estado = document.getElementById('estado-resultados');
  var vacio = document.getElementById('sin-resultados');
  var botonLimpiarVacio = document.getElementById('limpiar-vacio');

  function normalizar(texto) {
    var t = String(texto || '').toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/\s+/g, ' ').trim();
  }

  function tieneOpcion(select, valor) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === valor) return true;
    }
    return false;
  }

  function leerURL() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var q = params.get('q');
    if (q) campoTexto.value = q;
    [['categoria', campoCategoria], ['dificultad', campoDificultad], ['tiempo', campoTiempo]].forEach(function (par) {
      var v = params.get(par[0]);
      if (v && tieneOpcion(par[1], v)) par[1].value = v;
    });
  }

  function escribirURL() {
    try {
      var params = new URLSearchParams();
      if (campoTexto.value.trim()) params.set('q', campoTexto.value.trim());
      if (campoCategoria.value) params.set('categoria', campoCategoria.value);
      if (campoDificultad.value) params.set('dificultad', campoDificultad.value);
      if (campoTiempo.value) params.set('tiempo', campoTiempo.value);
      var qs = params.toString();
      window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    } catch (e) { /* en algunos navegadores con file:// no se puede; no pasa nada */ }
  }

  function filtrar() {
    var palabras = normalizar(campoTexto.value).split(' ').filter(Boolean);
    var categoria = campoCategoria.value;
    var dificultad = campoDificultad.value;
    var tiempoMax = parseInt(campoTiempo.value, 10);
    var visibles = 0;

    tarjetas.forEach(function (li) {
      var d = li.dataset;
      var ok = (!categoria || d.categoria === categoria) &&
        (!dificultad || d.dificultad === dificultad) &&
        (!tiempoMax || parseInt(d.tiempo, 10) <= tiempoMax) &&
        palabras.every(function (p) { return d.buscar.indexOf(p) !== -1; });
      li.hidden = !ok;
      if (ok) visibles++;
    });

    estado.textContent = visibles === 1
      ? 'Se encontró 1 receta.'
      : 'Se encontraron ' + visibles + ' recetas.';
    vacio.hidden = visibles !== 0;
    escribirURL();
  }

  form.addEventListener('input', filtrar);
  form.addEventListener('change', filtrar);
  form.addEventListener('submit', function (e) { e.preventDefault(); filtrar(); });
  form.addEventListener('reset', function () { window.setTimeout(filtrar, 0); });
  if (botonLimpiarVacio) {
    botonLimpiarVacio.addEventListener('click', function () {
      form.reset();
      campoTexto.focus();
    });
  }

  form.hidden = false;
  leerURL();
  filtrar();
})();
