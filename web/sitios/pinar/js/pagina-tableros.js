/* Pinar — página "Mis tableros". */
(function () {
  'use strict';

  var T = window.PinarTableros;
  var UI = window.PinarUI;
  var cont = document.getElementById('tableros');
  var form = document.getElementById('form-crear');
  var aviso = document.getElementById('aviso-almacenamiento');
  if (!cont || !UI) return;

  var esc = UI.esc;

  if (aviso) aviso.hidden = T.disponible();

  function render() {
    var lista = T.lista();
    if (!lista.length) {
      cont.innerHTML =
        '<div class="vacio">' +
        '<h2>Todavía no tenés tableros</h2>' +
        '<p>Creá uno con el formulario de arriba, o explorá las ideas y tocá <strong>Guardar</strong> en las que te gusten.</p>' +
        '<p><a class="boton boton-primario" href="index.html">Explorar ideas</a></p>' +
        '</div>';
      return;
    }
    cont.innerHTML = lista.map(function (t, i) {
      var pines = t.pines.map(function (s) { return UI.pinesPorSlug[s]; }).filter(Boolean);
      var idTit = 'tablero-' + i;
      var cuerpo = pines.length
        ? '<div class="grilla">' + pines.map(function (p) {
            return UI.tarjeta(p, {
              sufijo: 't' + i,
              boton: '<button type="button" class="btn-quitar" data-quitar="' + esc(p.slug) + '" data-tablero="' + esc(t.id) + '">' +
                'Quitar<span class="visualmente-oculto"> «' + esc(p.titulo) + '» de «' + esc(t.nombre) + '»</span></button>'
            });
          }).join('') + '</div>'
        : '<p class="vacio-texto">Este tablero está vacío. <a href="index.html">Explorá ideas</a> y tocá «Guardar» para sumarlas.</p>';
      return '<section class="tablero" aria-labelledby="' + idTit + '" data-id="' + esc(t.id) + '">' +
        '<div class="tablero-cabecera">' +
        '<h2 id="' + idTit + '" tabindex="-1">' + esc(t.nombre) +
        ' <span class="cuenta">· ' + pines.length + (pines.length === 1 ? ' idea' : ' ideas') + '</span></h2>' +
        '<button type="button" class="boton boton-peligro boton-chico" data-borrar="' + esc(t.id) + '">' +
        'Borrar tablero<span class="visualmente-oculto"> «' + esc(t.nombre) + '»</span></button>' +
        '</div>' + cuerpo + '</section>';
    }).join('');
  }

  cont.addEventListener('click', function (e) {
    var quitar = e.target.closest('[data-quitar]');
    if (quitar) {
      var idT = quitar.getAttribute('data-tablero');
      var slug = quitar.getAttribute('data-quitar');
      var tab = T.obtener(idT);
      var pin = UI.pinesPorSlug[slug];
      // buscamos a dónde mover el foco después de quitar
      var art = quitar.closest('.pin');
      var vecino = art && (art.nextElementSibling || art.previousElementSibling);
      var slugVecino = vecino ? vecino.getAttribute('data-slug') : null;
      T.quitar(idT, slug);
      render();
      var destino = slugVecino && cont.querySelector('[data-quitar="' + slugVecino + '"][data-tablero="' + idT + '"]');
      if (!destino) destino = cont.querySelector('section[data-id="' + idT + '"] h2');
      if (destino) destino.focus();
      if (tab && pin) UI.avisar('Quitaste «' + pin.titulo + '» de «' + tab.nombre + '».');
      return;
    }
    var borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      var id = borrar.getAttribute('data-borrar');
      var t = T.obtener(id);
      if (!t) return;
      var ok = true;
      try {
        ok = window.confirm('¿Borrar el tablero «' + t.nombre + '»? Las ideas no se borran del sitio, solo se quitan de este tablero.');
      } catch (err) { ok = true; }
      if (!ok) return;
      var seccion = borrar.closest('.tablero');
      var sig = seccion && (seccion.nextElementSibling || seccion.previousElementSibling);
      var idSig = sig ? sig.getAttribute('data-id') : null;
      T.borrar(id);
      render();
      var foco = idSig && cont.querySelector('section[data-id="' + idSig + '"] h2');
      if (!foco) foco = document.getElementById('titulo-pagina');
      if (foco) foco.focus();
      UI.avisar('Borraste el tablero «' + t.nombre + '».');
    }
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input');
      var nombre = input.value.trim();
      if (!nombre) {
        UI.avisar('Escribí un nombre para el tablero.');
        input.focus();
        return;
      }
      var existia = T.lista().some(function (t) { return t.nombre.toLowerCase() === nombre.toLowerCase(); });
      var t = T.crear(nombre);
      input.value = '';
      render();
      UI.avisar(existia ? 'Ya tenías un tablero llamado «' + t.nombre + '».' : 'Creaste el tablero «' + t.nombre + '».');
      input.focus();
    });
  }

  var pendiente = false;
  T.alCambiar(function () {
    // otra pestaña o el diálogo de guardar cambiaron los datos
    if (document.body.classList.contains('con-modal')) { pendiente = true; return; }
    if (!cont.contains(document.activeElement)) render();
  });

  document.addEventListener('pinar:modal-cerrado', function () {
    if (!pendiente) return;
    pendiente = false;
    var activo = document.activeElement;
    var art = activo && activo.closest ? activo.closest('.pin') : null;
    var sec = activo && activo.closest ? activo.closest('.tablero') : null;
    var slug = art ? art.getAttribute('data-slug') : null;
    var idT = sec ? sec.getAttribute('data-id') : null;
    render();
    var destino = null;
    if (slug && idT) destino = cont.querySelector('section[data-id="' + idT + '"] .pin[data-slug="' + slug + '"] .pin-enlace');
    if (!destino && idT) destino = cont.querySelector('section[data-id="' + idT + '"] h2');
    if (!destino) destino = document.getElementById('titulo-pagina');
    if (destino) destino.focus();
  });

  render();
})();
