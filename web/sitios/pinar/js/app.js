/* Pinar — interacción común: ventana de detalle, guardar en tableros, buscador y filtros. */
(function () {
  'use strict';

  var T = window.PinarTableros;
  var DATOS = window.PINAR || null;
  var RAIZ = document.body.getAttribute('data-raiz') || '';

  var pinesPorSlug = {};
  var categorias = {};
  if (DATOS) {
    DATOS.pines.forEach(function (p) { pinesPorSlug[p.slug] = p; });
    DATOS.categorias.forEach(function (c) { categorias[c.slug] = c; });
  }

  /* ---------- Utilidades ---------- */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizar(t) {
    t = String(t || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* navegador viejo */ }
    return t.replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function urlPin(slug) { return RAIZ + 'pines/' + slug + '.html'; }
  function urlCat(slug) { return RAIZ + 'categorias/' + slug + '.html'; }
  function urlBuscar(q) { return RAIZ + 'index.html?q=' + encodeURIComponent(q); }

  // Evita ids repetidos cuando el mismo SVG aparece en la grilla y en la ventana.
  function svgConSufijo(svg, sufijo) {
    return svg
      .replace(/id="([^"]+)"/g, 'id="$1-' + sufijo + '"')
      .replace(/url\(#([^)]+)\)/g, 'url(#$1-' + sufijo + ')');
  }

  function focoables(contenedor) {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(contenedor.querySelectorAll(sel), function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }

  /* ---------- Aviso flotante (región viva) ---------- */
  var tostada = document.createElement('div');
  tostada.className = 'tostada';
  tostada.setAttribute('role', 'status');
  tostada.setAttribute('aria-live', 'polite');
  document.body.appendChild(tostada);
  var temporizador = null;
  function avisar(msj) {
    tostada.textContent = '';
    // pequeña pausa para que los lectores de pantalla anuncien aunque el texto se repita
    window.setTimeout(function () {
      tostada.textContent = msj;
      tostada.classList.add('visible');
    }, 40);
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(function () { tostada.classList.remove('visible'); }, 3200);
  }

  /* ---------- Gestor de ventanas modales ---------- */
  var pila = [];

  function aplicarInert() {
    var arriba = pila.length ? pila[pila.length - 1].modal : null;
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.tagName === 'SCRIPT' || el === tostada) return;
      if (arriba && el !== arriba) {
        if (!el.hasAttribute('data-inerte')) {
          el.setAttribute('data-inerte', '');
          el.setAttribute('aria-hidden', 'true');
          el.inert = true;
        }
      } else if (el.hasAttribute('data-inerte')) {
        el.removeAttribute('data-inerte');
        el.removeAttribute('aria-hidden');
        el.inert = false;
      }
    });
    document.body.classList.toggle('con-modal', pila.length > 0);
  }

  function abrirModal(modal, opener, alCerrar) {
    modal.hidden = false;
    pila.push({ modal: modal, opener: opener || document.activeElement, alCerrar: alCerrar });
    aplicarInert();
    modal.scrollTop = 0;
    var destino = modal.querySelector('[data-foco-inicial]') || focoables(modal)[0];
    if (destino) destino.focus();
  }

  function cerrarModal() {
    var item = pila.pop();
    if (!item) return;
    item.modal.hidden = true;
    aplicarInert();
    var destino = item.opener;
    if (typeof item.alCerrar === 'function') {
      var otro = item.alCerrar();
      if (otro) destino = otro;
    }
    if (destino && document.body.contains(destino) && typeof destino.focus === 'function') {
      destino.focus();
    }
    if (!pila.length) {
      try { document.dispatchEvent(new CustomEvent('pinar:modal-cerrado')); } catch (e) { /* navegador viejo */ }
    }
  }

  function modalArriba() { return pila.length ? pila[pila.length - 1].modal : null; }

  document.addEventListener('keydown', function (e) {
    var arriba = modalArriba();
    if (!arriba) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      cerrarModal();
      return;
    }
    if (e.key === 'Tab') {
      var lista = focoables(arriba);
      if (!lista.length) { e.preventDefault(); return; }
      var primero = lista[0];
      var ultimo = lista[lista.length - 1];
      var activo = document.activeElement;
      if (!arriba.contains(activo)) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && activo === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
      return;
    }
    if (arriba === modalDetalle && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      moverDetalle(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  // Si el foco se escapa de la ventana (por ejemplo con el mouse), lo devolvemos.
  document.addEventListener('focusin', function (e) {
    var arriba = modalArriba();
    if (arriba && !arriba.contains(e.target) && e.target !== tostada) {
      var lista = focoables(arriba);
      if (lista.length) lista[0].focus();
    }
  });

  function crearModal(clase, html) {
    var m = document.createElement('div');
    m.className = 'modal ' + clase;
    m.hidden = true;
    m.innerHTML = '<div class="modal-velo" data-cerrar></div>' + html;
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target.closest('[data-cerrar]')) {
        e.preventDefault();
        if (modalArriba() === m) cerrarModal();
      }
    });
    return m;
  }

  /* ---------- Tarjeta (misma estructura que las páginas generadas) ---------- */
  function tarjeta(pin, opciones) {
    opciones = opciones || {};
    var cat = categorias[pin.cat] ? categorias[pin.cat].nombre : '';
    var extra = opciones.boton ||
      '<button type="button" class="btn-guardar" data-guardar="' + esc(pin.slug) + '" data-titulo="' + esc(pin.titulo) + '">Guardar' +
      '<span class="visualmente-oculto"> «' + esc(pin.titulo) + '»</span></button>';
    return '<article class="pin" data-slug="' + esc(pin.slug) + '" data-cat="' + esc(pin.cat) + '">' +
      '<a class="pin-enlace" href="' + esc(urlPin(pin.slug)) + '">' +
      '<span class="pin-img">' + (opciones.sufijo ? svgConSufijo(pin.svg, opciones.sufijo) : pin.svg) + '</span>' +
      '<h3 class="pin-titulo">' + esc(pin.titulo) + '</h3></a>' +
      '<div class="pin-pie"><span class="pin-cat">' + esc(cat) + '</span>' + extra + '</div></article>';
  }

  /* ---------- Estado de los botones "Guardar" ---------- */
  function actualizarGuardados() {
    var total = T.totalGuardados();
    var cont = document.getElementById('contador-tableros');
    var contTexto = document.getElementById('contador-tableros-texto');
    if (cont) cont.textContent = total ? String(total) : '';
    if (contTexto) contTexto.textContent = total ? ' (' + total + (total === 1 ? ' idea guardada)' : ' ideas guardadas)') : '';

    Array.prototype.forEach.call(document.querySelectorAll('[data-guardar]'), function (btn) {
      var slug = btn.getAttribute('data-guardar');
      if (!slug) return;
      var titulo = btn.getAttribute('data-titulo') || '';
      var en = T.tablerosCon(slug).length > 0;
      btn.classList.toggle('guardado', en);
      if (btn.classList.contains('btn-guardar')) {
        btn.innerHTML = (en ? 'Guardado' : 'Guardar') + '<span class="visualmente-oculto"> «' + esc(titulo) + '»</span>';
      } else {
        btn.textContent = en ? 'Guardado · editar tableros' : 'Guardar en un tablero';
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-guardado-en]'), function (p) {
      var slug = p.getAttribute('data-guardado-en');
      var tabs = T.tablerosCon(slug);
      p.textContent = tabs.length
        ? 'Guardado en: ' + tabs.map(function (t) { return '«' + t.nombre + '»'; }).join(', ') + '.'
        : '';
    });
  }

  /* ---------- Diálogo "Guardar en un tablero" ---------- */
  var modalGuardar = null;
  var slugGuardando = null;

  function construirGuardar() {
    if (modalGuardar) return modalGuardar;
    modalGuardar = crearModal('modal-guardar',
      '<div class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="guardar-titulo" aria-describedby="guardar-sub">' +
      '<button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">×</button>' +
      '<h2 id="guardar-titulo" tabindex="-1" data-foco-inicial>Guardar en un tablero</h2>' +
      '<p class="sub" id="guardar-sub"></p>' +
      '<p class="aviso" data-aviso hidden>Tu navegador no permite guardar datos en este sitio. Los tableros van a durar solo mientras tengas esta página abierta.</p>' +
      '<p class="vacio-texto" data-vacio>Todavía no tenés tableros. Creá el primero acá abajo.</p>' +
      '<ul class="lista-tableros" data-lista aria-label="Tus tableros"></ul>' +
      '<form class="form-nuevo" data-form novalidate>' +
      '<label for="nuevo-tablero">Crear un tablero nuevo</label>' +
      '<input id="nuevo-tablero" name="nombre" type="text" maxlength="60" autocomplete="off" placeholder="Por ejemplo: Ideas para el balcón">' +
      '<button type="submit" class="boton boton-verde">Crear y guardar</button>' +
      '</form>' +
      '<div class="acciones"><button type="button" class="boton" data-cerrar>Listo</button>' +
      '<a class="boton" href="' + esc(RAIZ + 'tableros.html') + '">Ver mis tableros</a></div>' +
      '</div>');

    modalGuardar.querySelector('[data-lista]').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tablero]');
      if (!btn || !slugGuardando) return;
      var id = btn.getAttribute('data-tablero');
      var t = T.obtener(id);
      var ahora = T.alternar(id, slugGuardando);
      renderListaGuardar();
      var mismo = modalGuardar.querySelector('[data-tablero="' + id + '"]');
      if (mismo) mismo.focus();
      if (t) avisar(ahora ? 'Guardado en «' + t.nombre + '».' : 'Quitado de «' + t.nombre + '».');
    });

    modalGuardar.querySelector('[data-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = modalGuardar.querySelector('#nuevo-tablero');
      var nombre = input.value.trim();
      if (!nombre) {
        avisar('Escribí un nombre para el tablero.');
        input.focus();
        return;
      }
      var t = T.crear(nombre);
      if (!t) return;
      T.agregar(t.id, slugGuardando);
      input.value = '';
      renderListaGuardar();
      avisar('Guardado en «' + t.nombre + '».');
      input.focus();
    });
    return modalGuardar;
  }

  function renderListaGuardar() {
    var lista = T.lista();
    var ul = modalGuardar.querySelector('[data-lista]');
    modalGuardar.querySelector('[data-vacio]').hidden = lista.length > 0;
    ul.hidden = lista.length === 0;
    ul.innerHTML = lista.map(function (t) {
      var en = t.pines.indexOf(slugGuardando) !== -1;
      return '<li><button type="button" class="opcion-tablero" data-tablero="' + esc(t.id) + '" aria-pressed="' + en + '">' +
        '<span>' + esc(t.nombre) + ' <span class="visualmente-oculto">(' + t.pines.length + (t.pines.length === 1 ? ' idea' : ' ideas') + ')</span></span>' +
        '<span class="estado-op" aria-hidden="true">' + (en ? 'Guardado' : 'Guardar') + '</span></button></li>';
    }).join('');
  }

  function abrirGuardar(slug, titulo, opener) {
    construirGuardar();
    slugGuardando = slug;
    var pin = pinesPorSlug[slug];
    titulo = titulo || (pin ? pin.titulo : '');
    modalGuardar.querySelector('#guardar-sub').textContent = 'Elegí dónde guardar «' + titulo + '». Podés marcar más de un tablero.';
    modalGuardar.querySelector('[data-aviso]').hidden = T.disponible();
    renderListaGuardar();
    abrirModal(modalGuardar, opener);
    if (!T.lista().length) {
      var input = modalGuardar.querySelector('#nuevo-tablero');
      if (input) input.focus();
    }
  }

  /* ---------- Ventana de detalle ---------- */
  var modalDetalle = null;
  var recorrido = [];
  var posicion = 0;
  var grillaOrigen = null;

  function construirDetalle() {
    if (modalDetalle) return modalDetalle;
    modalDetalle = crearModal('modal-detalle',
      '<div class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="detalle-titulo">' +
      '<button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">×</button>' +
      '<div class="detalle">' +
      '<div class="detalle-img" data-img></div>' +
      '<div class="detalle-cuerpo">' +
      '<p class="etiqueta-cat"><a data-cat href="#"></a></p>' +
      '<h2 id="detalle-titulo" tabindex="-1" data-foco-inicial></h2>' +
      '<p class="bajada" data-desc></p>' +
      '<ul class="ficha" data-ficha></ul>' +
      '<h3 data-subtitulo></h3>' +
      '<ol class="pasos" data-pasos></ol>' +
      '<h3>Etiquetas</h3>' +
      '<ul class="etiquetas" data-etiquetas></ul>' +
      '<div class="acciones">' +
      '<button type="button" class="boton boton-primario" data-guardar-detalle>Guardar en un tablero</button>' +
      '<a class="boton" data-enlace href="#">Abrir la página de esta idea</a>' +
      '</div>' +
      '<p class="guardado-en" data-guardado-en=""></p>' +
      '<div class="detalle-nav">' +
      '<button type="button" class="boton" data-nav="-1"><span aria-hidden="true">←</span> Anterior</button>' +
      '<span class="visualmente-oculto" data-posicion aria-live="polite"></span>' +
      '<button type="button" class="boton" data-nav="1">Siguiente <span aria-hidden="true">→</span></button>' +
      '</div></div></div></div>');

    modalDetalle.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) {
        moverDetalle(parseInt(nav.getAttribute('data-nav'), 10), nav);
        return;
      }
      var g = e.target.closest('[data-guardar-detalle]');
      if (g) {
        abrirGuardar(recorrido[posicion], null, g);
        return;
      }
      var etiqueta = e.target.closest('[data-etiqueta]');
      if (etiqueta && filtro.activo) {
        e.preventDefault();
        cerrarModal();
        filtro.poner(etiqueta.getAttribute('data-etiqueta'), '');
        var input = document.getElementById('buscar');
        if (input) input.focus();
      }
    });
    return modalDetalle;
  }

  function pintarDetalle() {
    var slug = recorrido[posicion];
    var pin = pinesPorSlug[slug];
    if (!pin) return;
    var m = modalDetalle;
    var cat = categorias[pin.cat];
    m.querySelector('[data-img]').innerHTML = svgConSufijo(pin.svg, 'modal');
    var svg = m.querySelector('[data-img] svg');
    if (svg) {
      svg.removeAttribute('aria-hidden');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Ilustración: ' + pin.titulo);
    }
    var aCat = m.querySelector('[data-cat]');
    aCat.textContent = cat ? cat.nombre : '';
    aCat.href = urlCat(pin.cat);
    m.querySelector('#detalle-titulo').textContent = pin.titulo;
    m.querySelector('[data-desc]').textContent = pin.desc;
    var ficha = [];
    if (pin.tiempo) ficha.push('<li>Tiempo: ' + esc(pin.tiempo) + '</li>');
    if (pin.nivel) ficha.push('<li>Nivel: ' + esc(pin.nivel) + '</li>');
    var ulFicha = m.querySelector('[data-ficha]');
    ulFicha.innerHTML = ficha.join('');
    ulFicha.hidden = !ficha.length;
    var esFrase = pin.cat === 'frases';
    m.querySelector('[data-subtitulo]').textContent = esFrase ? 'Ideas para usarla' : 'Paso a paso';
    var ol = m.querySelector('[data-pasos]');
    ol.className = 'pasos' + (esFrase ? ' tips' : '');
    ol.innerHTML = pin.pasos.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');
    m.querySelector('[data-etiquetas]').innerHTML = pin.etiquetas.map(function (t) {
      return '<li><a href="' + esc(urlBuscar(t)) + '" data-etiqueta="' + esc(t) + '">#' + esc(t) + '</a></li>';
    }).join('');
    m.querySelector('[data-enlace]').href = urlPin(pin.slug);
    var g = m.querySelector('[data-guardar-detalle]');
    g.setAttribute('data-guardar', pin.slug);
    g.setAttribute('data-titulo', pin.titulo);
    m.querySelector('[data-guardado-en]').setAttribute('data-guardado-en', pin.slug);
    var prev = m.querySelector('[data-nav="-1"]');
    var sig = m.querySelector('[data-nav="1"]');
    prev.disabled = posicion <= 0;
    sig.disabled = posicion >= recorrido.length - 1;
    m.querySelector('[data-posicion]').textContent = 'Idea ' + (posicion + 1) + ' de ' + recorrido.length + ': ' + pin.titulo;
    actualizarGuardados();
  }

  function moverDetalle(delta, boton) {
    var nueva = posicion + delta;
    if (nueva < 0 || nueva >= recorrido.length) return;
    posicion = nueva;
    pintarDetalle();
    modalDetalle.scrollTop = 0;
    var caja = modalDetalle.querySelector('.modal-caja');
    if (caja) caja.scrollTop = 0;
    if (boton && !boton.disabled) {
      boton.focus();
    } else if (boton) {
      var otro = modalDetalle.querySelector('[data-nav="' + (-delta) + '"]');
      if (otro && !otro.disabled) otro.focus(); else modalDetalle.querySelector('#detalle-titulo').focus();
    }
  }

  function abrirDetalle(articulo, opener) {
    if (!DATOS) return false;
    var slug = articulo.getAttribute('data-slug');
    if (!pinesPorSlug[slug]) return false;
    construirDetalle();
    grillaOrigen = articulo.parentNode;
    recorrido = Array.prototype.filter.call(grillaOrigen.querySelectorAll('.pin'), function (el) {
      return !el.hidden;
    }).map(function (el) { return el.getAttribute('data-slug'); });
    posicion = Math.max(0, recorrido.indexOf(slug));
    pintarDetalle();
    abrirModal(modalDetalle, opener, function () {
      // al cerrar, el foco vuelve a la tarjeta de la última idea vista
      var actual = recorrido[posicion];
      if (grillaOrigen) {
        var art = grillaOrigen.querySelector('.pin[data-slug="' + actual + '"] .pin-enlace');
        if (art) {
          try { art.scrollIntoView({ block: 'nearest' }); } catch (e) { /* nada */ }
          return art;
        }
      }
      return null;
    });
    return true;
  }

  /* ---------- Delegación de clics ---------- */
  document.addEventListener('click', function (e) {
    var guardar = e.target.closest('[data-guardar]');
    if (guardar && !guardar.hasAttribute('data-guardar-detalle')) {
      e.preventDefault();
      abrirGuardar(guardar.getAttribute('data-guardar'), guardar.getAttribute('data-titulo'), guardar);
      return;
    }
    var enlace = e.target.closest('.pin-enlace');
    if (enlace && DATOS && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
      var art = enlace.closest('.pin');
      if (art && art.parentNode && art.parentNode.classList.contains('grilla') && abrirDetalle(art, enlace)) {
        e.preventDefault();
      }
    }
  });

  /* ---------- Buscador y filtros (portada) ---------- */
  var filtro = { activo: false, poner: function () {} };

  function iniciarFiltros() {
    var grilla = document.getElementById('grilla-principal');
    var form = document.getElementById('form-buscar');
    var input = document.getElementById('buscar');
    if (!grilla || !form || !input || form.getAttribute('data-local') !== 'si') return;

    var tarjetas = Array.prototype.slice.call(grilla.querySelectorAll('.pin'));
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-filtro-cat]'));
    var estado = document.getElementById('estado');
    var sinRes = document.getElementById('sin-resultados');
    var enlaceCat = document.getElementById('enlace-categoria');
    var limpiar = form.querySelector('.limpiar');
    var catActual = '';

    function aplicar(actualizarUrl) {
      var palabras = normalizar(input.value).split(' ').filter(Boolean);
      var visibles = 0;
      tarjetas.forEach(function (t) {
        var texto = t.getAttribute('data-buscar') || '';
        var okCat = !catActual || t.getAttribute('data-cat') === catActual;
        var okTexto = palabras.every(function (p) { return texto.indexOf(p) !== -1; });
        t.hidden = !(okCat && okTexto);
        if (!t.hidden) visibles++;
      });
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', String(c.getAttribute('data-filtro-cat') === catActual));
      });
      var nombreCat = catActual && categorias[catActual] ? categorias[catActual].nombre : '';
      var msj = visibles === 1 ? '1 idea' : visibles + ' ideas';
      if (nombreCat) msj += ' en ' + nombreCat;
      if (palabras.length) msj += ' para «' + input.value.trim() + '»';
      if (estado) estado.textContent = (palabras.length || nombreCat) ? 'Mostrando ' + msj + '.' : 'Mostrando todas las ideas (' + tarjetas.length + ').';
      if (sinRes) sinRes.hidden = visibles > 0;
      if (limpiar) limpiar.hidden = !input.value;
      if (enlaceCat) {
        enlaceCat.hidden = !nombreCat;
        if (nombreCat) {
          enlaceCat.href = urlCat(catActual);
          enlaceCat.textContent = 'Ver la página de ' + nombreCat + ' →';
        }
      }
      if (actualizarUrl) {
        try {
          var params = [];
          if (input.value.trim()) params.push('q=' + encodeURIComponent(input.value.trim()));
          if (catActual) params.push('cat=' + encodeURIComponent(catActual));
          window.history.replaceState(null, '', (location.pathname.split('/').pop() || 'index.html') + (params.length ? '?' + params.join('&') : ''));
        } catch (e) { /* algunos navegadores lo bloquean con file:// */ }
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      aplicar(true);
      if (estado) estado.focus();
    });
    var espera = null;
    input.addEventListener('input', function () {
      window.clearTimeout(espera);
      espera = window.setTimeout(function () { aplicar(true); }, 120);
    });
    if (limpiar) {
      limpiar.addEventListener('click', function () {
        input.value = '';
        aplicar(true);
        input.focus();
      });
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        catActual = c.getAttribute('data-filtro-cat');
        aplicar(true);
      });
    });

    filtro.activo = true;
    filtro.poner = function (q, cat) {
      input.value = q || '';
      catActual = cat || '';
      aplicar(true);
    };

    // Lee ?q= y ?cat= de la dirección
    var q = '';
    try {
      var params = new URLSearchParams(window.location.search);
      q = params.get('q') || '';
      var c = params.get('cat') || '';
      if (c && categorias[c]) catActual = c;
    } catch (e) { /* nada */ }
    input.value = q;
    aplicar(false);
  }

  /* ---------- Inicio ---------- */
  T.alCambiar(actualizarGuardados);
  iniciarFiltros();
  actualizarGuardados();

  window.PinarUI = {
    tarjeta: tarjeta,
    esc: esc,
    avisar: avisar,
    urlPin: urlPin,
    datos: DATOS,
    pinesPorSlug: pinesPorSlug,
    categorias: categorias,
    actualizarGuardados: actualizarGuardados
  };
})();
