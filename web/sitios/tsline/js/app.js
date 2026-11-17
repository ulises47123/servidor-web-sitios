// TS_LINE: interfaz (vistas por #hash, barra del reproductor, cola, letra, menus y atajos).
import { get, post, letra as cargarLetra } from './api.js?v=1';
import { Reproductor } from './reproductor.js?v=1';

/* ================================================================ estado */
const E = { pistas: new Map(), likes: [], listas: [], historial: [], prefs: { generos: [], volumen: 80 }, generos: [], usuario: '' };
const $ = s => document.querySelector(s);
const $vista = $('#vista');
const audio = $('#audio');
const R = new Reproductor(audio, id => E.pistas.get(id));
const gustan = id => E.likes.includes(id);
let letraActual = { id: null, lineas: [] };

/* ============================================================== utilidades */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dur = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const durLarga = s => { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };
const ruta = (...p) => '#/' + p.map(encodeURIComponent).join('/');
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

/** Portada de la cancion o una generada con su inicial y un color propio. */
function portada(p) {
  if (p?.portada) return p.portada;
  const t = p?.titulo || '♪';
  const h = hash(t) % 360;
  const ini = esc([...t.trim()][0]?.toUpperCase() || '♪');
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,45%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360},70%,25%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><text x="50" y="64" font-family="Arial" font-weight="700" font-size="44" text-anchor="middle" fill="rgba(255,255,255,.9)">${ini}</text></svg>`);
}

/** Portada de un conjunto: mosaico de 4 o la primera. */
function mosaico(ids, grande = false) {
  const conPortada = [...new Set(ids)].map(id => E.pistas.get(id)).filter(Boolean);
  const cl = grande ? 'mosaico grande' : 'mosaico';
  if (conPortada.length >= 4) return `<div class="${cl} cuatro">${conPortada.slice(0, 4).map(p => `<img src="${esc(portada(p))}" alt="" loading="lazy">`).join('')}</div>`;
  return `<div class="${cl}"><img src="${esc(conPortada[0] ? portada(conPortada[0]) : 'img/logo.svg')}" alt="" loading="lazy"></div>`;
}

let toastT;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', error);
  t.classList.add('ver');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('ver'), 2600);
}

async function intentar(fn) {
  try { return await fn(); } catch (e) { toast(e.message, true); return undefined; }
}

/* ================================================================== datos */
async function cargar() {
  const d = await get('biblioteca');
  E.pistas = new Map(d.pistas.map(p => [p.id, p]));
  E.likes = d.likes;
  E.listas = d.listas;
  E.historial = d.historial;
  E.prefs = d.prefs;
  E.generos = d.generos;
  E.usuario = d.usuario;
}
const todas = () => [...E.pistas.values()];
const listaPorId = id => E.listas.find(l => l.id === +id);

/* =============================================================== acciones */
async function alternarLike(id) {
  const on = !gustan(id);
  E.likes = on ? [id, ...E.likes] : E.likes.filter(x => x !== id);
  pintarLikes(id);
  pintarBiblioteca();
  try { await post('like', { id, on }); toast(on ? 'Agregada a Me gusta' : 'Quitada de Me gusta'); }
  catch (e) { E.likes = on ? E.likes.filter(x => x !== id) : [id, ...E.likes]; pintarLikes(id); toast(e.message, true); }
}

function pintarLikes(id) {
  document.querySelectorAll(`[data-like="${id}"]`).forEach(b => { const on = gustan(id); b.textContent = on ? '♥' : '♡'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  if (R.actual?.id === id) { const b = $('#repLike'); b.textContent = gustan(id) ? '♥' : '♡'; b.classList.toggle('on', gustan(id)); b.setAttribute('aria-pressed', gustan(id)); }
}

async function nuevaLista(pistaInicial = 0) {
  const nombre = await pedirTexto('Nueva playlist', 'Nombre', `Mi playlist n.º ${E.listas.length + 1}`);
  if (!nombre) return;
  const r = await intentar(() => post('lista_crear', { nombre, pista: pistaInicial }));
  if (!r) return;
  E.listas = r.listas;
  pintarBiblioteca();
  toast(pistaInicial ? 'Playlist creada con la canción' : 'Playlist creada');
  if (!pistaInicial) location.hash = ruta('lista', r.id);
}

async function agregarALista(lista, pista) {
  const r = await intentar(() => post('lista_agregar', { lista, pista }));
  if (!r) return;
  E.listas = r.listas;
  pintarBiblioteca();
  toast(r.ya ? 'Ya estaba en la playlist' : `Agregada a ${listaPorId(lista)?.nombre}`);
}

/* =============================================================== dialogos */
function pedirTexto(titulo, etiqueta, valor = '') {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="dlg"><h2>${esc(titulo)}</h2><label>${esc(etiqueta)}<input name="v" maxlength="80" value="${esc(valor)}" required></label>
    <div class="dlg-pie"><button value="no" type="button" class="btn-sec" data-c>Cancelar</button><button value="si" class="btn-pri">Guardar</button></div></form>`;
  return new Promise(res => {
    const f = dlg.querySelector('form');
    f.querySelector('[data-c]').onclick = () => { dlg.close(); res(null); };
    f.onsubmit = e => { e.preventDefault(); dlg.close(); res(f.v.value.trim() || null); };
    dlg.oncancel = () => res(null);
    dlg.showModal();
    f.v.select();
  });
}

function confirmar(titulo, texto, aceptar = 'Borrar') {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="dlg"><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>
    <div class="dlg-pie"><button type="button" class="btn-sec" data-c>Cancelar</button><button class="btn-pri peligro">${esc(aceptar)}</button></div></form>`;
  return new Promise(res => {
    const f = dlg.querySelector('form');
    f.querySelector('[data-c]').onclick = () => { dlg.close(); res(false); };
    f.onsubmit = e => { e.preventDefault(); dlg.close(); res(true); };
    dlg.oncancel = () => res(false);
    dlg.showModal();
  });
}

function elegirGeneros(primeraVez = false) {
  const disponibles = [...new Set(todas().map(p => p.genero))];
  const lista = E.generos.filter(g => disponibles.includes(g) || E.prefs.generos.includes(g));
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="dlg"><h2>${primeraVez ? `¡Hola, ${esc(E.usuario)}!` : 'Mis géneros'}</h2>
    <p>${primeraVez ? 'Elegí los géneros que te gustan y armamos tu inicio.' : 'Elegí los géneros para "Para vos".'}</p>
    <div class="chips">${(lista.length ? lista : E.generos).map(g => `<label class="chip"><input type="checkbox" value="${esc(g)}" ${E.prefs.generos.includes(g) ? 'checked' : ''}><span>${esc(g)}</span></label>`).join('')}</div>
    <div class="dlg-pie"><button type="button" class="btn-sec" data-c>${primeraVez ? 'Ahora no' : 'Cancelar'}</button><button class="btn-pri">Listo</button></div></form>`;
  const f = dlg.querySelector('form');
  const guardar = async generos => {
    E.prefs.generos = generos; E.prefs.configuradas = true;
    await intentar(() => post('prefs', { generos }));
    if (!location.hash || location.hash.startsWith('#/inicio')) render();
  };
  f.querySelector('[data-c]').onclick = () => { dlg.close(); if (primeraVez) guardar([]); };
  f.onsubmit = e => { e.preventDefault(); dlg.close(); guardar([...f.querySelectorAll('input:checked')].map(i => i.value)); };
  dlg.showModal();
}

/* =========================================================== menu contextual */
const $menu = $('#menu');
let menuOrigen = null;
function abrirMenu(boton, items) {
  menuOrigen = boton;
  $menu.innerHTML = items.map((it, i) => it.sep ? '<hr>' : it.titulo ? `<div class="menu-tit">${esc(it.titulo)}</div>` : `<button role="menuitem" data-i="${i}">${esc(it.txt)}</button>`).join('');
  $menu.hidden = false;
  const r = boton.getBoundingClientRect();
  const mw = $menu.offsetWidth, mh = $menu.offsetHeight;
  $menu.style.left = `${Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8))}px`;
  $menu.style.top = `${r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4}px`;
  $menu.querySelectorAll('button').forEach(b => b.onclick = () => { cerrarMenu(); items[+b.dataset.i].fn(); });
  $menu.querySelector('button')?.focus();
}
function cerrarMenu() { if ($menu.hidden) return; $menu.hidden = true; menuOrigen?.focus(); menuOrigen = null; }
document.addEventListener('click', e => { if (!$menu.hidden && !$menu.contains(e.target) && e.target !== menuOrigen) cerrarMenu(); });
$menu.addEventListener('keydown', e => {
  const bs = [...$menu.querySelectorAll('button')];
  const i = bs.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
  if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); cerrarMenu(); }
});

function menuPista(boton, id, extra = []) {
  const p = E.pistas.get(id);
  abrirMenu(boton, [
    { txt: 'Reproducir a continuación', fn: () => { R.reproducirDespues(id); toast('Suena después de la actual'); } },
    { txt: 'Agregar a la cola', fn: () => { R.agregarACola(id); toast('Agregada a la cola'); } },
    { txt: gustan(id) ? 'Quitar de Me gusta' : 'Agregar a Me gusta', fn: () => alternarLike(id) },
    { sep: true }, { titulo: 'Agregar a playlist' },
    ...E.listas.slice(0, 12).map(l => ({ txt: l.nombre, fn: () => agregarALista(l.id, id) })),
    { txt: '＋ Nueva playlist…', fn: () => nuevaLista(id) },
    { sep: true },
    ...(p.artista ? [{ txt: `Ir a ${p.artista}`, fn: () => { location.hash = ruta('artista', p.artista); } }] : []),
    ...(p.album ? [{ txt: `Ir al álbum ${p.album}`, fn: () => { location.hash = ruta('album', p.album); } }] : []),
    ...extra,
  ]);
}

/* ============================================================= componentes */
function cabecera({ tipo, titulo, sub, ids, portadaHtml, acciones = '' }) {
  const total = ids.reduce((a, id) => a + (E.pistas.get(id)?.duracion || 0), 0);
  return `<header class="cabecera">${portadaHtml ?? mosaico(ids, true)}
    <div class="cab-txt"><span class="cab-tipo">${esc(tipo)}</span><h1>${esc(titulo)}</h1>
      <p class="cab-sub">${sub ? esc(sub) + ' · ' : ''}${ids.length} canci${ids.length === 1 ? 'ón' : 'ones'}${total ? ' · ' + durLarga(total) : ''}</p></div></header>
    <div class="acciones-lista">
      <button class="play grande" data-play-todo ${ids.length ? '' : 'disabled'} aria-label="Reproducir">▶</button>
      <button class="icono grande" data-mezclar ${ids.length ? '' : 'disabled'} aria-label="Reproducir en aleatorio" title="Aleatorio">⤮</button>
      ${acciones}</div>`;
}

function tabla(ids, { contexto, lista = null, numerar = true } = {}) {
  if (!ids.length) return '';
  return `<div class="tabla" role="table" aria-label="Canciones">
    <div class="fila cab" role="row"><span role="columnheader">#</span><span role="columnheader">Título</span><span role="columnheader" class="col-album">Álbum</span><span></span><span role="columnheader" class="col-dur">⏱</span><span></span></div>
    ${ids.map((id, i) => { const p = E.pistas.get(id); if (!p) return ''; return `
    <div class="fila pista ${R.actual?.id === id ? 'sonando' : ''}" role="row" data-id="${id}" data-i="${i}" ${lista ? 'draggable="true"' : ''}>
      <span class="num" role="cell"><span class="n">${numerar ? i + 1 : '♪'}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
      <span class="titulo-celda" role="cell"><img src="${esc(portada(p))}" alt="" loading="lazy">
        <span class="tt"><button class="t-titulo" data-play="${i}">${esc(p.titulo)}</button>
        ${p.artista ? `<a class="t-artista" href="${ruta('artista', p.artista)}">${esc(p.artista)}</a>` : '<span class="t-artista">—</span>'}</span></span>
      <span class="col-album" role="cell">${p.album ? `<a href="${ruta('album', p.album)}">${esc(p.album)}</a>` : ''}</span>
      <span role="cell"><button class="icono corazon ${gustan(id) ? 'on' : ''}" data-like="${id}" aria-pressed="${gustan(id)}" aria-label="Me gusta">${gustan(id) ? '♥' : '♡'}</button></span>
      <span class="col-dur" role="cell">${p.duracion ? dur(p.duracion) : ''}</span>
      <span role="cell"><button class="icono" data-mas="${id}" aria-label="Más opciones para ${esc(p.titulo)}" aria-haspopup="menu">⋯</button></span>
    </div>`; }).join('')}</div>`;
}

/** Conecta los botones de una vista con el reproductor. */
function conectar(raiz, ids, contexto, lista = null) {
  raiz.querySelectorAll('[data-play]').forEach(b => b.onclick = () => R.reproducirLista(ids, +b.dataset.play, contexto));
  raiz.querySelectorAll('.fila.pista').forEach(f => f.ondblclick = e => { if (!e.target.closest('button,a')) R.reproducirLista(ids, +f.dataset.i, contexto); });
  raiz.querySelector('[data-play-todo]')?.addEventListener('click', () => {
    if (R.contexto?.ruta === contexto.ruta && R.pos >= 0) { R.alternar(); return; }
    if (R.aleatorio) R.alternarAleatorio();
    R.reproducirLista(ids, 0, contexto); pintarEstado();
  });
  raiz.querySelector('[data-mezclar]')?.addEventListener('click', () => { if (!R.aleatorio) R.alternarAleatorio(); R.reproducirLista(ids, Math.floor(Math.random() * ids.length), contexto); pintarModos(); });
  raiz.querySelectorAll('[data-like]').forEach(b => b.onclick = () => alternarLike(+b.dataset.like));
  raiz.querySelectorAll('[data-mas]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = +b.dataset.mas;
    const extra = lista ? [{ sep: true }, { txt: 'Quitar de esta playlist', fn: async () => {
      const r = await intentar(() => post('lista_quitar', { lista: lista.id, pista: id }));
      if (r) { E.listas = r.listas; pintarBiblioteca(); render(); toast('Quitada de la playlist'); }
    } }] : [];
    menuPista(b, id, extra);
  });
  raiz.querySelectorAll('.tarjeta[data-ids]').forEach(t => {
    const tids = t.dataset.ids.split(',').map(Number);
    t.querySelector('.tarjeta-play')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); R.reproducirLista(tids, +t.dataset.inicio || 0, { ruta: t.dataset.ruta || '', nombre: t.dataset.nombre || '' }); });
  });
  if (lista) arrastrar(raiz, lista);
}

/** Reordenar canciones de una playlist arrastrando. */
function arrastrar(raiz, lista) {
  let origen = null;
  raiz.querySelectorAll('.fila.pista').forEach(f => {
    f.addEventListener('dragstart', e => { origen = f; f.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; });
    f.addEventListener('dragend', () => { f.classList.remove('arrastrando'); raiz.querySelectorAll('.sobre').forEach(x => x.classList.remove('sobre')); });
    f.addEventListener('dragover', e => { e.preventDefault(); f.classList.add('sobre'); });
    f.addEventListener('dragleave', () => f.classList.remove('sobre'));
    f.addEventListener('drop', async e => {
      e.preventDefault();
      if (!origen || origen === f) return;
      f.parentNode.insertBefore(origen, +origen.dataset.i < +f.dataset.i ? f.nextSibling : f);
      const ids = [...raiz.querySelectorAll('.fila.pista')].map(x => +x.dataset.id);
      const r = await intentar(() => post('lista_orden', { lista: lista.id, ids }));
      if (r) { E.listas = r.listas; render(); }
    });
  });
}

function estante(titulo, ids, { ruta: r = '', nombre = '', enlace = '' } = {}) {
  if (!ids.length) return '';
  return `<section class="estante"><div class="estante-cab"><h2>${esc(titulo)}</h2>${enlace ? `<a href="${enlace}">Ver todo</a>` : ''}</div>
    <div class="fila-tarjetas">${ids.slice(0, 12).map((id, i) => { const p = E.pistas.get(id); return `
      <div class="tarjeta" data-ids="${ids.join(',')}" data-inicio="${i}" data-ruta="${esc(r)}" data-nombre="${esc(nombre)}">
        <span class="tarjeta-img"><img src="${esc(portada(p))}" alt="" loading="lazy"><button class="tarjeta-play" aria-label="Reproducir ${esc(p.titulo)}">▶</button></span>
        <a class="tarjeta-t estirado" href="${ruta('pista', id)}">${esc(p.titulo)}</a><span class="tarjeta-s">${esc(p.artista || p.genero)}</span></div>`; }).join('')}</div></section>`;
}

function vacio(icono, titulo, texto, extra = '') {
  return `<div class="vacio"><div class="vacio-ic" aria-hidden="true">${icono}</div><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>${extra}</div>`;
}

/* ================================================================== vistas */
const VISTAS = {
  inicio() {
    const ps = todas();
    if (!ps.length) return vacio('🎵', 'Todavía no hay música', 'El administrador puede subir canciones desde el panel del servidor.');
    const h = new Date().getHours();
    const saludo = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const novedades = [...ps].sort((a, b) => String(b.subido).localeCompare(String(a.subido))).map(p => p.id);
    const masOidas = [...ps].filter(p => p.reproducciones > 0).sort((a, b) => b.reproducciones - a.reproducciones).map(p => p.id);
    const paraVos = E.prefs.generos.length ? ps.filter(p => E.prefs.generos.includes(p.genero)).sort(() => Math.random() - .5).map(p => p.id) : [];
    const generos = [...new Set(ps.map(p => p.genero))].sort();
    const accesos = [
      { href: '#/me-gusta', t: 'Tus me gusta', img: '<div class="mosaico corazon-mos">♥</div>' },
      ...E.listas.slice(0, 5).map(l => ({ href: ruta('lista', l.id), t: l.nombre, img: mosaico(l.pistas) })),
    ];
    return `<h1 class="saludo">${saludo}, ${esc(E.usuario)}</h1>
      <div class="accesos">${accesos.map(a => `<a class="acceso" href="${a.href}">${a.img}<span>${esc(a.t)}</span></a>`).join('')}</div>
      ${estante('Escuchado recientemente', E.historial.filter(id => E.pistas.has(id)), { ruta: 'historial', nombre: 'Historial', enlace: '#/historial' })}
      ${paraVos.length ? estante('Para vos', paraVos, { ruta: 'para-vos', nombre: 'Para vos' }) : ''}
      ${estante('Novedades', novedades, { ruta: 'novedades', nombre: 'Novedades' })}
      ${estante('Lo más escuchado', masOidas, { ruta: 'populares', nombre: 'Lo más escuchado' })}
      <section class="estante"><div class="estante-cab"><h2>Géneros</h2><button class="enlace" id="misGeneros">Elegir mis géneros</button></div>
        <div class="generos">${generos.map(g => `<a class="genero" style="--h:${hash(g) % 360}" href="${ruta('genero', g)}">${esc(g)}</a>`).join('')}</div></section>`;
  },

  buscar(args) {
    const q = decodeURIComponent(args[0] || '');
    const ps = todas();
    const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const nq = norm(q.trim());
    let html = `<div class="buscar-cab"><input type="search" id="campoBuscar" class="campo-buscar" placeholder="¿Qué querés escuchar?" value="${esc(q)}" aria-label="Buscar canciones, artistas o álbumes" autocomplete="off"></div>`;
    if (!nq) {
      const generos = [...new Set(ps.map(p => p.genero))].sort();
      return html + `<h2 class="sub">Explorar géneros</h2><div class="generos grandes">${generos.map(g => `<a class="genero" style="--h:${hash(g) % 360}" href="${ruta('genero', g)}">${esc(g)}<small>${ps.filter(p => p.genero === g).length} canciones</small></a>`).join('') || '<p class="muted">Todavía no hay música.</p>'}</div>`;
    }
    const coinc = ps.filter(p => norm(`${p.titulo} ${p.artista} ${p.album} ${p.genero}`).includes(nq));
    const artistas = [...new Set(ps.filter(p => p.artista && norm(p.artista).includes(nq)).map(p => p.artista))];
    const albumes = [...new Set(ps.filter(p => p.album && norm(p.album).includes(nq)).map(p => p.album))];
    if (!coinc.length) return html + vacio('🔍', `Sin resultados para “${q}”`, 'Revisá la ortografía o probá con otras palabras.');
    html += `<h2 class="sub">Canciones</h2>${tabla(coinc.map(p => p.id), { numerar: false })}`;
    if (artistas.length) html += `<h2 class="sub">Artistas</h2><div class="fila-tarjetas">${artistas.map(a => { const ids = ps.filter(p => p.artista === a).map(p => p.id); return `<a class="tarjeta artista" href="${ruta('artista', a)}"><span class="tarjeta-img redonda">${mosaico(ids)}</span><span class="tarjeta-t">${esc(a)}</span><span class="tarjeta-s">Artista</span></a>`; }).join('')}</div>`;
    if (albumes.length) html += `<h2 class="sub">Álbumes</h2><div class="fila-tarjetas">${albumes.map(a => { const ids = ps.filter(p => p.album === a).map(p => p.id); return `<a class="tarjeta" href="${ruta('album', a)}"><span class="tarjeta-img">${mosaico(ids)}</span><span class="tarjeta-t">${esc(a)}</span><span class="tarjeta-s">Álbum</span></a>`; }).join('')}</div>`;
    return html;
  },

  biblioteca() {
    return `<h1 class="saludo">Tu biblioteca</h1><button class="btn-pri" id="crearMovil">＋ Crear playlist</button>
      <ul class="lista-biblioteca grande">${itemsBiblioteca()}</ul>`;
  },

  'me-gusta': () => {
    const ids = E.likes.filter(id => E.pistas.has(id));
    return cabecera({ tipo: 'Playlist', titulo: 'Tus me gusta', ids, portadaHtml: '<div class="mosaico grande corazon-mos">♥</div>' })
      + (ids.length ? tabla(ids, {}) : vacio('♡', 'Todavía no marcaste canciones', 'Tocá el corazón de una canción para guardarla acá.'));
  },

  historial: () => {
    const ids = E.historial.filter(id => E.pistas.has(id));
    return cabecera({ tipo: 'Historial', titulo: 'Escuchado recientemente', ids }) + (ids.length ? tabla(ids, {}) : vacio('🕑', 'Sin historial', 'Las canciones que escuches van a aparecer acá.'));
  },

  lista(args) {
    const l = listaPorId(args[0]);
    if (!l) return vacio('🤔', 'No encontramos esa playlist', 'Puede que la hayas borrado.');
    const ids = l.pistas.filter(id => E.pistas.has(id));
    return cabecera({ tipo: 'Playlist', titulo: l.nombre, sub: E.usuario, ids,
      acciones: `<button class="icono grande" data-renombrar aria-label="Renombrar playlist" title="Renombrar">✎</button><button class="icono grande" data-borrar-lista aria-label="Borrar playlist" title="Borrar">🗑</button>` })
      + (ids.length ? `${tabla(ids, { lista: l })}<p class="muted chico ayuda">Arrastrá las canciones para cambiar el orden.</p>` : vacio('🎶', 'Esta playlist está vacía', 'Usá el menú ⋯ de cualquier canción para agregarla.'));
  },

  artista(args) {
    const a = decodeURIComponent(args[0] || '');
    const ids = todas().filter(p => p.artista === a).map(p => p.id);
    const albumes = [...new Set(ids.map(id => E.pistas.get(id).album).filter(Boolean))];
    return cabecera({ tipo: 'Artista', titulo: a, ids, portadaHtml: `<div class="redonda">${mosaico(ids, true)}</div>` }) + tabla(ids, {})
      + (albumes.length ? `<h2 class="sub">Álbumes</h2><div class="fila-tarjetas">${albumes.map(al => { const aids = ids.filter(id => E.pistas.get(id).album === al); return `<a class="tarjeta" href="${ruta('album', al)}"><span class="tarjeta-img">${mosaico(aids)}</span><span class="tarjeta-t">${esc(al)}</span><span class="tarjeta-s">${aids.length} canciones</span></a>`; }).join('')}</div>` : '');
  },

  album(args) {
    const a = decodeURIComponent(args[0] || '');
    const ids = todas().filter(p => p.album === a).map(p => p.id);
    const artistas = [...new Set(ids.map(id => E.pistas.get(id).artista).filter(Boolean))];
    return cabecera({ tipo: 'Álbum', titulo: a, sub: artistas.join(', '), ids }) + tabla(ids, {});
  },

  genero(args) {
    const g = decodeURIComponent(args[0] || '');
    const ids = todas().filter(p => p.genero === g).map(p => p.id);
    return cabecera({ tipo: 'Género', titulo: g, ids, portadaHtml: `<div class="mosaico grande genero-mos" style="--h:${hash(g) % 360}">${esc(g)}</div>` }) + tabla(ids, {});
  },

  pista(args) {
    const p = E.pistas.get(+args[0]);
    if (!p) return vacio('🤔', 'No encontramos esa canción', 'Puede que la hayan quitado de la biblioteca.');
    const delArtista = p.artista ? todas().filter(x => x.artista === p.artista && x.id !== p.id).map(x => x.id) : [];
    const delGenero = todas().filter(x => x.genero === p.genero && x.id !== p.id).map(x => x.id);
    return cabecera({ tipo: 'Canción', titulo: p.titulo, sub: [p.artista, p.album].filter(Boolean).join(' · '), ids: [p.id], portadaHtml: `<div class="mosaico grande"><img src="${esc(portada(p))}" alt=""></div>` })
      + tabla([p.id], { numerar: false })
      + (delArtista.length ? estante(`Más de ${p.artista}`, delArtista, { ruta: 'artista', nombre: p.artista }) : '')
      + estante(`Más ${p.genero}`, delGenero, { ruta: 'genero', nombre: p.genero });
  },
};

/* ================================================================== router */
function render() {
  const [nombre = 'inicio', ...args] = location.hash.replace(/^#\/?/, '').split('/');
  const vista = VISTAS[nombre] || VISTAS.inicio;
  $vista.innerHTML = `<div class="vista-cont">${vista(args)}</div>`;
  const ctx = { ruta: location.hash, nombre };
  // ids en el orden en que aparecen en la tabla (para reproducir desde ahi)
  const ids = [...$vista.querySelectorAll('.fila.pista')].map(f => +f.dataset.id);
  conectar($vista, ids, ctx, nombre === 'lista' ? listaPorId(args[0]) : null);
  document.querySelectorAll('[data-ruta]').forEach(a => { const on = a.dataset.ruta === nombre; a.classList.toggle('activo', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  document.querySelectorAll('.lista-biblioteca a').forEach(a => a.classList.toggle('activo', a.getAttribute('href') === location.hash));

  if (nombre === 'buscar') {
    const c = $('#campoBuscar');
    c.focus();
    c.setSelectionRange(c.value.length, c.value.length);
    let t;
    c.oninput = () => { clearTimeout(t); t = setTimeout(() => history.replaceState(null, '', ruta('buscar', c.value)) || render(), 250); };
  }
  $('#misGeneros')?.addEventListener('click', () => elegirGeneros());
  $('#crearMovil')?.addEventListener('click', () => nuevaLista());
  $vista.querySelector('[data-renombrar]')?.addEventListener('click', async () => {
    const l = listaPorId(args[0]);
    const n = await pedirTexto('Renombrar playlist', 'Nombre', l.nombre);
    if (!n) return;
    const r = await intentar(() => post('lista_renombrar', { lista: l.id, nombre: n }));
    if (r) { E.listas = r.listas; pintarBiblioteca(); render(); }
  });
  $vista.querySelector('[data-borrar-lista]')?.addEventListener('click', async () => {
    const l = listaPorId(args[0]);
    if (!await confirmar('Borrar playlist', `¿Borrar “${l.nombre}”? Las canciones siguen en la biblioteca.`)) return;
    const r = await intentar(() => post('lista_borrar', { lista: l.id }));
    if (r) { E.listas = r.listas; pintarBiblioteca(); location.hash = '#/inicio'; toast('Playlist borrada'); }
  });
  if (nombre !== 'buscar') $vista.scrollTop = 0;
  marcarSonando();
}

function itemsBiblioteca() {
  return `<li><a href="#/me-gusta"><div class="mosaico corazon-mos">♥</div><span><b>Tus me gusta</b><small>Playlist · ${E.likes.length} canciones</small></span></a></li>
    <li><a href="#/historial"><div class="mosaico hist-mos">🕑</div><span><b>Escuchado recientemente</b><small>Historial</small></span></a></li>
    ${E.listas.map(l => `<li><a href="${ruta('lista', l.id)}">${mosaico(l.pistas)}<span><b>${esc(l.nombre)}</b><small>Playlist · ${l.pistas.length} canciones</small></span></a></li>`).join('')}`;
}
function pintarBiblioteca() {
  $('#listaBiblioteca').innerHTML = itemsBiblioteca();
  document.querySelectorAll('.lista-biblioteca a').forEach(a => a.classList.toggle('activo', a.getAttribute('href') === location.hash));
}

/* ========================================================= barra inferior */
const $play = $('#btnPlay'), $barra = $('#barra'), $vol = $('#volumen');
let arrastrandoBarra = false;

function pintarPista() {
  const p = R.actual;
  $('#repImg').src = p ? portada(p) : 'img/logo.svg';
  $('#repTitulo').textContent = p ? p.titulo : 'Elegí una canción';
  $('#repArtista').innerHTML = p?.artista ? `<a href="${ruta('artista', p.artista)}">${esc(p.artista)}</a>` : '';
  const like = $('#repLike');
  like.disabled = !p;
  if (p) { like.dataset.like = p.id; pintarLikes(p.id); }
  document.title = p ? `${p.titulo}${p.artista ? ' · ' + p.artista : ''} — TS_LINE` : 'TS_LINE';
  marcarSonando();
  if (!$('#panelDer').hidden) pintarPanel();
}
function marcarSonando() {
  const id = R.actual?.id;
  document.querySelectorAll('.fila.pista').forEach(f => f.classList.toggle('sonando', +f.dataset.id === id));
  document.body.classList.toggle('en-pausa', !R.sonando);
}
function pintarEstado() {
  $play.textContent = R.sonando ? '⏸' : '▶';
  $play.setAttribute('aria-label', R.sonando ? 'Pausa' : 'Reproducir');
  document.body.classList.toggle('en-pausa', !R.sonando);
  document.querySelectorAll('[data-play-todo]').forEach(b => {
    const mio = R.contexto?.ruta === location.hash && R.pos >= 0;
    b.textContent = mio && R.sonando ? '⏸' : '▶';
  });
}
function pintarTiempo() {
  const d = audio.duration, t = audio.currentTime;
  $('#tActual').textContent = dur(t);
  $('#tTotal').textContent = Number.isFinite(d) ? dur(d) : (R.actual ? dur(R.actual.duracion) : '0:00');
  if (!arrastrandoBarra && Number.isFinite(d) && d > 0) $barra.value = Math.round(t / d * 1000);
  $barra.style.setProperty('--p', `${$barra.value / 10}%`);
  if (letraActual.lineas.length && !$('#panelDer').hidden && panelTab === 'letra') resaltarLetra();
}
function pintarModos() {
  const a = $('#btnAleatorio'); a.classList.toggle('on', R.aleatorio); a.setAttribute('aria-pressed', R.aleatorio);
  const r = $('#btnRepetir'); r.classList.toggle('on', R.repetir !== 'no'); r.textContent = R.repetir === 'una' ? '↻¹' : '↻';
  r.setAttribute('aria-label', `Repetir: ${{ no: 'no', todo: 'toda la cola', una: 'una canción' }[R.repetir]}`);
}

R.addEventListener('pista', pintarPista);
R.addEventListener('estado', pintarEstado);
R.addEventListener('tiempo', pintarTiempo);
R.addEventListener('cola', () => { if (!$('#panelDer').hidden && panelTab === 'cola') pintarPanel(); });
R.addEventListener('error', e => toast(e.detail, true));
R.addEventListener('contar', async e => {
  const id = e.detail;
  if (!id) return;
  E.historial = [id, ...E.historial.filter(x => x !== id)].slice(0, 30);
  const p = E.pistas.get(id); if (p) p.reproducciones++;
  try { await post('reproducida', { id }); } catch { /* no es grave */ }
});

$play.onclick = () => { if (R.pos < 0) { const ids = todas().map(p => p.id); if (ids.length) R.reproducirLista(ids, 0, { ruta: '#/inicio' }); } else R.alternar(); };
$('#btnSiguiente').onclick = () => R.siguiente();
$('#btnAnterior').onclick = () => R.anterior();
$('#btnAleatorio').onclick = () => { R.alternarAleatorio(); pintarModos(); };
$('#btnRepetir').onclick = () => { R.alternarRepetir(); pintarModos(); };
$('#repLike').onclick = () => R.actual && alternarLike(R.actual.id);
$barra.addEventListener('input', () => { arrastrandoBarra = true; $barra.style.setProperty('--p', `${$barra.value / 10}%`); if (Number.isFinite(audio.duration)) $('#tActual').textContent = dur($barra.value / 1000 * audio.duration); });
$barra.addEventListener('change', () => { R.irAFraccion($barra.value / 1000); arrastrandoBarra = false; });

let volGuardar;
function aplicarVolumen(v, guardar = true) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  $vol.value = v; $vol.style.setProperty('--p', `${v}%`);
  R.volumen(v / 100); audio.muted = false;
  $('#btnMute').textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
  if (guardar) { clearTimeout(volGuardar); volGuardar = setTimeout(() => post('prefs', { volumen: v }).catch(() => {}), 800); }
}
let volPrevio = 80;
$vol.addEventListener('input', () => aplicarVolumen(+$vol.value));
$('#btnMute').onclick = () => { if (+$vol.value > 0) { volPrevio = +$vol.value; aplicarVolumen(0); } else aplicarVolumen(volPrevio || 80); };

/* --------------------------------------------- reproductor expandido (movil) */
const $rep = $('#reproductor');
const bajar = document.createElement('button');
bajar.className = 'icono bajar'; bajar.textContent = '⌄'; bajar.setAttribute('aria-label', 'Cerrar reproductor');
$rep.prepend(bajar);
$('#repPortada').onclick = () => { if (matchMedia('(max-width: 760px)').matches && R.actual) $rep.classList.add('expandido'); };
$('.rep-textos').addEventListener('click', e => { if (!e.target.closest('a') && matchMedia('(max-width: 760px)').matches && R.actual) $rep.classList.add('expandido'); });
bajar.onclick = () => $rep.classList.remove('expandido');

/* =================================================== panel derecho (cola/letra) */
let panelTab = 'cola';
function abrirPanel(tab) {
  const p = $('#panelDer');
  if (!p.hidden && panelTab === tab) { p.hidden = true; actualizarBotonesPanel(); return; }
  panelTab = tab; p.hidden = false;
  $rep.classList.remove('expandido');
  pintarPanel(); actualizarBotonesPanel();
}
function actualizarBotonesPanel() {
  const vis = !$('#panelDer').hidden;
  $('#btnCola').setAttribute('aria-pressed', vis && panelTab === 'cola'); $('#btnCola').classList.toggle('on', vis && panelTab === 'cola');
  $('#btnLetra').setAttribute('aria-pressed', vis && panelTab === 'letra'); $('#btnLetra').classList.toggle('on', vis && panelTab === 'letra');
  document.querySelectorAll('.panel-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === panelTab));
}
async function pintarPanel() {
  const $c = $('#panelCuerpo');
  if (panelTab === 'cola') {
    const act = R.actual;
    const sig = R.cola.slice(R.pos + 1);
    $c.innerHTML = !act ? '<p class="muted">La cola está vacía. Elegí algo para escuchar.</p>' : `
      <h3>Sonando ahora</h3>${filaCola(act, R.pos, true)}
      <h3>A continuación${R.contexto?.nombre ? ` · <small>${esc(R.contexto.nombre)}</small>` : ''}</h3>
      ${sig.length ? sig.map((id, k) => filaCola(E.pistas.get(id), R.pos + 1 + k)).join('') : '<p class="muted chico">No hay más canciones en la cola.</p>'}`;
    $c.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => R.irA(+b.dataset.ir));
    $c.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => R.quitarDeCola(+b.dataset.quitar));
    $c.querySelectorAll('[data-subir]').forEach(b => b.onclick = () => R.moverEnCola(+b.dataset.subir, +b.dataset.subir - 1));
    $c.querySelectorAll('[data-bajar]').forEach(b => b.onclick = () => R.moverEnCola(+b.dataset.bajar, +b.dataset.bajar + 1));
  } else {
    const p = R.actual;
    if (!p) { $c.innerHTML = '<p class="muted">Elegí una canción.</p>'; return; }
    if (!p.letra) { $c.innerHTML = `<div class="sin-letra"><p><b>${esc(p.titulo)}</b></p><p class="muted">Esta canción no tiene letra cargada.</p></div>`; return; }
    if (letraActual.id !== p.id) {
      $c.innerHTML = '<p class="muted">Cargando letra…</p>';
      letraActual = { id: p.id, lineas: await cargarLetra(p.id) };
      if (R.actual?.id !== p.id || panelTab !== 'letra') return;
    }
    $c.innerHTML = `<div class="letra">${letraActual.lineas.map((l, i) => `<button class="linea" data-t="${l.t}" data-i="${i}">${esc(l.txt) || '♪'}</button>`).join('')}</div>`;
    $c.querySelectorAll('.linea').forEach(b => b.onclick = () => { audio.currentTime = +b.dataset.t; R.play(); });
    resaltarLetra(true);
  }
}
function filaCola(p, i, actual = false) {
  if (!p) return '';
  const puedeSubir = !actual && i > R.pos + 1, puedeBajar = !actual && i < R.cola.length - 1;
  return `<div class="fila-cola ${actual ? 'actual' : ''}"><img src="${esc(portada(p))}" alt="">
    <button class="fc-txt" ${actual ? '' : `data-ir="${i}"`}><b>${esc(p.titulo)}</b><small>${esc(p.artista)}</small></button>
    ${actual ? '' : `<span class="fc-acc"><button class="icono chico" data-subir="${i}" ${puedeSubir ? '' : 'disabled'} aria-label="Subir">↑</button><button class="icono chico" data-bajar="${i}" ${puedeBajar ? '' : 'disabled'} aria-label="Bajar">↓</button><button class="icono chico" data-quitar="${i}" aria-label="Quitar de la cola">✕</button></span>`}</div>`;
}
let lineaPrev = -1;
function resaltarLetra(forzar = false) {
  const t = audio.currentTime + 0.25;
  let i = -1;
  for (let k = 0; k < letraActual.lineas.length; k++) { if (letraActual.lineas[k].t <= t) i = k; else break; }
  if (i === lineaPrev && !forzar) return;
  lineaPrev = i;
  document.querySelectorAll('.letra .linea').forEach((b, k) => { b.classList.toggle('activa', k === i); b.classList.toggle('pasada', k < i); });
  document.querySelector('.letra .linea.activa')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
$('#btnCola').onclick = () => abrirPanel('cola');
$('#btnLetra').onclick = () => abrirPanel('letra');
$('#cerrarPanel').onclick = () => { $('#panelDer').hidden = true; actualizarBotonesPanel(); };
document.querySelectorAll('.panel-tabs [data-tab]').forEach(b => b.onclick = () => { panelTab = b.dataset.tab; pintarPanel(); actualizarBotonesPanel(); });

/* ================================================================== varios */
$('#btnNuevaLista').onclick = () => nuevaLista();
const $pop = $('#popUsuario');
$('#btnUsuario').onclick = e => { e.stopPropagation(); $pop.hidden = !$pop.hidden; $('#btnUsuario').setAttribute('aria-expanded', !$pop.hidden); };
document.addEventListener('click', e => { if (!$pop.hidden && !$pop.contains(e.target)) { $pop.hidden = true; $('#btnUsuario').setAttribute('aria-expanded', 'false'); } });
$('#btnGeneros').onclick = () => { $pop.hidden = true; elegirGeneros(); };

document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || $('#dlg').open) {
    if (e.key === 'Escape' && e.target.id === 'campoBuscar') e.target.blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === ' ' && !e.target.closest('button, a')) { e.preventDefault(); $play.click(); }
  else if (k === 'arrowright') { e.preventDefault(); e.shiftKey ? R.siguiente() : R.saltar(5); }
  else if (k === 'arrowleft') { e.preventDefault(); e.shiftKey ? R.anterior() : R.saltar(-5); }
  else if (k === 'm') $('#btnMute').click();
  else if (k === 'l' && R.actual) alternarLike(R.actual.id);
  else if (k === 's') $('#btnAleatorio').click();
  else if (k === 'r') $('#btnRepetir').click();
  else if (k === 'q') abrirPanel('cola');
  else if (k === '/') { e.preventDefault(); location.hash = '#/buscar'; }
  else if (k === 'escape') { $rep.classList.remove('expandido'); }
});

window.addEventListener('hashchange', () => { $rep.classList.remove('expandido'); render(); });

/* ================================================================== inicio */
(async () => {
  try { await cargar(); }
  catch (e) { $vista.innerHTML = `<div class="vista-cont">${vacio('⚠️', 'No se pudo cargar la música', e.message)}</div>`; return; }
  aplicarVolumen(E.prefs.volumen ?? 80, false);
  pintarBiblioteca();
  pintarModos();
  pintarPista();
  render();
  if (!E.prefs.configuradas && E.pistas.size) setTimeout(() => elegirGeneros(true), 400);
})();
