// AniNube: vistas por #hash, catalogo con filtros, ficha de serie y reproductor con progreso.
const CSRF = document.querySelector('meta[name="csrf"]').content;
const $ = s => document.querySelector(s);
const $vista = $('#vista');
const E = { series: [], porId: new Map(), seguir: [], miLista: [], generos: [], estados: {}, usuario: '' };
let limpiarVista = null; // se llama al salir de una vista (guardar progreso, timers)

/* =============================================================== utilidades */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dur = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`; };
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
const epNombre = e => `T${e.temporada} · E${e.numero}`;

async function api(a, datos = null, params = '') {
  const op = datos ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF }, body: JSON.stringify(datos) } : { cache: 'no-store' };
  let r;
  try { r = await fetch(`api.php?a=${a}${params}`, { credentials: 'same-origin', ...op }); } catch { throw new Error('Sin conexión'); }
  if (r.status === 401) { location.href = 'login.php'; throw new Error('Sesión vencida'); }
  const d = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
  if (!d.ok) throw new Error(d.error || 'Error');
  return d;
}

let toastT;
function toast(m, error = false) {
  const t = $('#toast'); t.textContent = m; t.classList.toggle('error', error); t.classList.add('ver');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('ver'), 2600);
}

/** Imagen de la serie o un poster generado con el titulo. */
function poster(s, tipo = 'portada') {
  if (s[tipo]) return s[tipo];
  if (tipo === 'banner' && s.portada) return s.portada;
  const h = hash(s.titulo) % 360;
  const palabras = s.titulo.split(/\s+/).slice(0, 6);
  const lineas = []; let l = '';
  for (const p of palabras) { if ((l + ' ' + p).trim().length > 12) { if (l) lineas.push(l); l = p; } else l = (l + ' ' + p).trim(); }
  if (l) lineas.push(l);
  const txt = lineas.slice(0, 4).map((x, i) => `<text x="100" y="${150 + i * 30 - lineas.length * 13}" text-anchor="middle" font-family="Arial" font-weight="800" font-size="24" fill="#fff">${esc(x)}</text>`).join('');
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},65%,42%)"/><stop offset="1" stop-color="hsl(${(h + 70) % 360},70%,18%)"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/>${txt}</svg>`);
}

function vacio(ic, t, txt, extra = '') {
  return `<div class="vacio"><div class="vacio-ic" aria-hidden="true">${ic}</div><h2>${esc(t)}</h2><p>${esc(txt)}</p>${extra}</div>`;
}

const enLista = id => E.miLista.includes(id);
async function alternarLista(id, boton) {
  const on = !enLista(id);
  try {
    await api('lista', { serie: id, on });
    E.miLista = on ? [id, ...E.miLista] : E.miLista.filter(x => x !== id);
    toast(on ? 'Agregada a Mi lista' : 'Quitada de Mi lista');
    if (boton) pintarBotonLista(boton, id);
  } catch (e) { toast(e.message, true); }
}
function pintarBotonLista(b, id) {
  b.textContent = enLista(id) ? '✓ En Mi lista' : '＋ Mi lista';
  b.classList.toggle('on', enLista(id));
  b.setAttribute('aria-pressed', enLista(id));
}

async function cargar() {
  const d = await api('inicio');
  E.series = d.series; E.porId = new Map(d.series.map(s => [s.id, s]));
  E.seguir = d.seguir; E.miLista = d.mi_lista; E.generos = d.generos; E.estados = d.estados; E.usuario = d.usuario;
}

/* ============================================================= componentes */
function tarjeta(s) {
  return `<a class="poster" href="#/serie/${s.id}">
    <span class="poster-img"><img src="${esc(poster(s))}" alt="" loading="lazy">${s.estado === 'emision' ? '<span class="badge">En emisión</span>' : ''}</span>
    <span class="poster-t">${esc(s.titulo)}</span>
    <span class="poster-s">${[s.anio, s.episodios ? `${s.episodios} ep.` : 'Sin episodios'].filter(Boolean).join(' · ')}</span></a>`;
}
function fila(titulo, series, enlace = '') {
  if (!series.length) return '';
  return `<section class="fila-sec"><div class="fila-cab"><h2>${esc(titulo)}</h2>${enlace ? `<a href="${enlace}">Ver todo ›</a>` : ''}</div>
    <div class="carrusel">${series.map(tarjeta).join('')}</div></section>`;
}
function tarjetaEp(x, conSerie = true) {
  const s = E.porId.get(x.serie_id);
  const pct = x.duracion ? Math.min(100, Math.round(x.segundos / x.duracion * 100)) : 0;
  const img = x.miniatura || (s ? poster(s, 'banner') : '');
  return `<a class="ep-card" href="#/ver/${x.episodio_id}">
    <span class="ep-img"><img src="${esc(img)}" alt="" loading="lazy"><span class="ep-play" aria-hidden="true">▶</span>
      ${pct ? `<span class="prog"><i style="width:${pct}%"></i></span>` : ''}</span>
    ${conSerie && s ? `<span class="ep-serie">${esc(s.titulo)}</span>` : ''}
    <span class="ep-t">${esc(epNombre(x))}${x.titulo ? ' · ' + esc(x.titulo) : ''}</span></a>`;
}

/* =================================================================== vistas */
const VISTAS = {
  inicio() {
    if (!E.series.length) return vacio('☁️', 'Todavía no hay series', 'El administrador puede cargarlas desde el panel del servidor. ¡Volvé pronto!');
    const dest = E.series.filter(s => s.destacada);
    const hero = (dest.length ? dest : [...E.series].sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))).slice(0, 3));
    const novedades = [...E.series].sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
    const conEps = E.series.filter(s => s.episodios);
    const generosUsados = E.generos.map(g => [g, conEps.filter(s => s.generos.includes(g))]).filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
    return `
      <section class="hero" id="hero" aria-roledescription="carrusel" aria-label="Destacadas">
        ${hero.map((s, i) => `<div class="hero-slide ${i ? '' : 'activa'}" data-i="${i}" ${i ? 'aria-hidden="true"' : ''}>
          <img class="hero-fondo" src="${esc(poster(s, 'banner'))}" alt="">
          <div class="hero-txt"><span class="hero-meta">${esc([s.anio, s.estado_txt, s.generos.slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</span>
            <h1>${esc(s.titulo)}</h1><p>${esc(s.sinopsis.slice(0, 220))}${s.sinopsis.length > 220 ? '…' : ''}</p>
            <div class="hero-acc"><a class="btn-pri" href="#/serie/${s.id}">▶ Ver ahora</a></div></div></div>`).join('')}
        ${hero.length > 1 ? `<div class="hero-puntos">${hero.map((_, i) => `<button aria-label="Destacada ${i + 1}" data-ir="${i}" class="${i ? '' : 'on'}"></button>`).join('')}</div>` : ''}
      </section>
      <div class="contenido">
        ${E.seguir.length ? `<section class="fila-sec"><div class="fila-cab"><h2>Seguir viendo</h2><a href="#/historial">Historial ›</a></div>
          <div class="carrusel eps">${E.seguir.map(x => tarjetaEp(x)).join('')}</div></section>` : ''}
        ${fila('Mi lista', E.miLista.map(id => E.porId.get(id)).filter(Boolean), '#/mi-lista')}
        ${fila('Novedades', novedades.slice(0, 15), '#/catalogo?orden=recientes')}
        ${generosUsados.map(([g, l]) => fila(g, l, `#/catalogo?genero=${encodeURIComponent(g)}`)).join('')}
      </div>`;
  },

  catalogo(_, params) {
    const f = { q: params.get('q') || '', genero: params.get('genero') || '', anio: params.get('anio') || '', estado: params.get('estado') || '', orden: params.get('orden') || 'az' };
    const anios = [...new Set(E.series.map(s => s.anio).filter(Boolean))].sort((a, b) => b - a);
    const generos = E.generos.filter(g => E.series.some(s => s.generos.includes(g)));
    let l = E.series.filter(s =>
      (!f.q || norm(`${s.titulo} ${s.titulo_alt} ${s.generos.join(' ')}`).includes(norm(f.q))) &&
      (!f.genero || s.generos.includes(f.genero)) && (!f.anio || String(s.anio) === f.anio) && (!f.estado || s.estado === f.estado));
    l = l.sort({
      az: (a, b) => a.titulo.localeCompare(b.titulo, 'es'),
      recientes: (a, b) => String(b.actualizado).localeCompare(String(a.actualizado)),
      anio: (a, b) => (b.anio || 0) - (a.anio || 0),
    }[f.orden] || undefined);
    const sel = (n, op, v) => `<select name="${n}" aria-label="${n}">${op.map(([val, t]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    return `<div class="contenido pagina"><h1>Catálogo</h1>
      <form class="filtros" id="filtros">
        <input type="search" name="q" value="${esc(f.q)}" placeholder="Buscar por título o género" aria-label="Buscar">
        ${sel('genero', [['', 'Todos los géneros'], ...generos.map(g => [g, g])], f.genero)}
        ${sel('anio', [['', 'Todos los años'], ...anios.map(a => [a, a])], f.anio)}
        ${sel('estado', [['', 'Cualquier estado'], ...Object.entries(E.estados)], f.estado)}
        ${sel('orden', [['az', 'A–Z'], ['recientes', 'Recién actualizadas'], ['anio', 'Año (nuevas primero)']], f.orden)}
      </form>
      <p class="muted">${l.length} serie${l.length === 1 ? '' : 's'}</p>
      ${l.length ? `<div class="grilla">${l.map(tarjeta).join('')}</div>` : vacio('🔍', 'Nada por acá', E.series.length ? 'Probá con otros filtros.' : 'Todavía no hay series cargadas.')}</div>`;
  },

  'mi-lista'() {
    const l = E.miLista.map(id => E.porId.get(id)).filter(Boolean);
    return `<div class="contenido pagina"><h1>Mi lista</h1>${l.length ? `<div class="grilla">${l.map(tarjeta).join('')}</div>` : vacio('★', 'Tu lista está vacía', 'Abrí una serie y tocá “＋ Mi lista” para guardarla acá.', '<a class="btn-pri" href="#/catalogo">Explorar el catálogo</a>')}</div>`;
  },

  async historial() {
    const { items } = await api('historial');
    return `<div class="contenido pagina"><h1>Historial</h1>${items.length ? `<div class="grilla eps">${items.map(x => tarjetaEp(x)).join('')}</div>`
      : vacio('🕑', 'Todavía no viste nada', 'Los episodios que mires aparecen acá para seguir donde quedaste.')}</div>`;
  },

  async serie([id]) {
    const d = await api('serie', null, `&id=${+id}`);
    const s = d.serie;
    const eps = d.episodios;
    const temporadas = [...new Set(eps.map(e => e.temporada))];
    // proximo a ver: el que esta en curso, o el primero no visto
    const enCurso = eps.find(e => e.progreso && !e.progreso.visto && e.progreso.segundos > 0);
    const proximo = enCurso || eps.find(e => !e.progreso?.visto) || eps[0];
    const tempInicial = proximo?.temporada || temporadas[0];
    return `<section class="ficha">
      <img class="ficha-fondo" src="${esc(poster(s, 'banner'))}" alt="">
      <div class="ficha-cont">
        <img class="ficha-poster" src="${esc(poster(s))}" alt="Portada de ${esc(s.titulo)}">
        <div class="ficha-txt">
          <h1>${esc(s.titulo)}</h1>${s.titulo_alt ? `<p class="alt">${esc(s.titulo_alt)}</p>` : ''}
          <p class="meta">${esc([s.anio, s.estado_txt, `${eps.length} episodio${eps.length === 1 ? '' : 's'}`].filter(Boolean).join(' · '))}</p>
          <div class="chips">${s.generos.map(g => `<a class="chip" href="#/catalogo?genero=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>
          <p class="sinopsis">${esc(s.sinopsis) || '<i>Sin sinopsis.</i>'}</p>
          <div class="ficha-acc">
            ${proximo ? `<a class="btn-pri" href="#/ver/${proximo.id}">▶ ${enCurso ? 'Continuar' : proximo === eps[0] && !proximo.progreso ? 'Ver' : 'Ver'} ${esc(epNombre(proximo))}</a>` : '<span class="muted">Todavía no hay episodios.</span>'}
            <button class="btn-sec" id="btnLista" data-serie="${s.id}"></button>
          </div>
        </div></div></section>
      <div class="contenido">
        ${eps.length ? `<div class="eps-cab"><h2>Episodios</h2>${temporadas.length > 1 ? `<select id="temporada" aria-label="Temporada">${temporadas.map(t => `<option value="${t}" ${t === tempInicial ? 'selected' : ''}>Temporada ${t}</option>`).join('')}</select>` : ''}</div>
        <ol class="lista-eps" id="listaEps">${eps.map(e => {
          const pct = e.progreso && e.duracion ? Math.min(100, Math.round(e.progreso.segundos / e.duracion * 100)) : 0;
          const visto = e.progreso?.visto;
          return `<li class="ep ${visto ? 'visto' : ''}" data-temp="${e.temporada}" ${e.temporada === tempInicial ? '' : 'hidden'}>
            <a href="#/ver/${e.id}" class="ep-link"><span class="ep-img"><img src="${esc(e.miniatura || poster(s, 'banner'))}" alt="" loading="lazy"><span class="ep-play" aria-hidden="true">▶</span>
              ${pct && !visto ? `<span class="prog"><i style="width:${pct}%"></i></span>` : ''}</span>
              <span class="ep-info"><b>${e.numero}. ${esc(e.titulo || `Episodio ${e.numero}`)}</b><small>${e.duracion ? dur(e.duracion) : ''}${visto ? ' · Visto' : pct ? ` · ${pct}%` : ''}</small></span></a>
            <button class="marcar" data-ep="${e.id}" data-visto="${visto ? 1 : 0}" aria-pressed="${!!visto}" title="${visto ? 'Marcar como no visto' : 'Marcar como visto'}" aria-label="${visto ? 'Marcar como no visto' : 'Marcar como visto'}">${visto ? '✓' : '○'}</button></li>`;
        }).join('')}</ol>` : vacio('🎬', 'Sin episodios todavía', 'Esta serie todavía no tiene episodios cargados.')}
      </div>`;
  },

  async ver([id]) {
    const d = await api('episodio', null, `&id=${+id}`);
    const e = d.episodio, s = d.serie;
    return `<div class="ver">
      <div class="ver-video"><video id="video" controls playsinline preload="metadata" src="${esc(e.video)}" poster="${esc(e.miniatura || poster(s, 'banner'))}"></video>
        <div class="siguiente-aviso" id="sigAviso" hidden><p>Siguiente episodio en <b id="cuenta">8</b></p>
          ${d.siguiente ? `<p class="sig-t">${esc(epNombre(d.siguiente))}${d.siguiente.titulo ? ' · ' + esc(d.siguiente.titulo) : ''}</p>` : ''}
          <div><a class="btn-pri" href="#/ver/${d.siguiente?.id}">▶ Ver ahora</a> <button class="btn-sec" id="cancelarSig">Cancelar</button></div></div></div>
      <div class="ver-info contenido">
        <a class="volver" href="#/serie/${s.id}">‹ ${esc(s.titulo)}</a>
        <h1>${esc(epNombre(e))}${e.titulo ? ' · ' + esc(e.titulo) : ''}</h1>
        <div class="ver-acc">
          ${d.anterior ? `<a class="btn-sec" href="#/ver/${d.anterior}">⏮ Anterior</a>` : ''}
          ${d.siguiente ? `<a class="btn-sec" href="#/ver/${d.siguiente.id}">Siguiente ⏭</a>` : ''}
          <label class="auto"><input type="checkbox" id="autoSig" ${localStorageGet('aninube_auto', '1') === '1' ? 'checked' : ''}> Reproducir el siguiente automáticamente</label>
        </div>
        <p class="muted chico">Atajos: espacio pausa · ←/→ 10 s · F pantalla completa · N siguiente</p>
      </div></div>`;
  },
};

function localStorageGet(k, def) { try { return localStorage.getItem(k) ?? def; } catch { return def; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

/* ==================================================== comportamiento por vista */
const DESPUES = {
  inicio() {
    const slides = [...document.querySelectorAll('.hero-slide')];
    if (slides.length < 2) return;
    let i = 0;
    const ir = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('activa', k === i); s.setAttribute('aria-hidden', k !== i); });
      document.querySelectorAll('.hero-puntos button').forEach((b, k) => b.classList.toggle('on', k === i));
    };
    document.querySelectorAll('.hero-puntos button').forEach(b => b.onclick = () => { ir(+b.dataset.ir); reiniciar(); });
    let t;
    const reiniciar = () => { clearInterval(t); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) t = setInterval(() => ir(i + 1), 7000); };
    reiniciar();
    limpiarVista = () => clearInterval(t);
  },

  catalogo() {
    const f = $('#filtros');
    const aplicar = () => {
      const p = new URLSearchParams();
      for (const el of f.elements) if (el.value && !(el.name === 'orden' && el.value === 'az')) p.set(el.name, el.value);
      history.replaceState(null, '', '#/catalogo' + (p.toString() ? '?' + p : ''));
      render(false);
    };
    f.querySelectorAll('select').forEach(s => s.onchange = aplicar);
    let t;
    f.q.oninput = () => { clearTimeout(t); t = setTimeout(aplicar, 250); };
    f.onsubmit = e => { e.preventDefault(); aplicar(); };
  },

  serie([id]) {
    const b = $('#btnLista');
    pintarBotonLista(b, +id);
    b.onclick = () => alternarLista(+id, b);
    $('#temporada')?.addEventListener('change', e => document.querySelectorAll('#listaEps .ep').forEach(li => { li.hidden = li.dataset.temp !== e.target.value; }));
    document.querySelectorAll('.marcar').forEach(m => m.onclick = async () => {
      const visto = m.dataset.visto !== '1';
      try { await api('marcar', { episodio: +m.dataset.ep, visto }); render(false); }
      catch (e) { toast(e.message, true); }
    });
  },

  ver([id]) {
    const v = $('#video');
    const epId = +id;
    let ultimo = 0, terminado = false, cuentaT = null;
    const guardar = (forzar = false) => {
      if (!Number.isFinite(v.duration) || v.currentTime < 1) return;
      const ahora = Date.now();
      if (!forzar && ahora - ultimo < 10000) return;
      ultimo = ahora;
      fetch(`api.php?a=progreso`, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF },
        body: JSON.stringify({ episodio: epId, segundos: Math.floor(v.currentTime), duracion: Math.floor(v.duration), visto: terminado }) }).catch(() => {});
    };
    api('episodio', null, `&id=${epId}`).then(d => {
      const p = d.progreso;
      v.addEventListener('loadedmetadata', () => {
        if (p && !p.visto && p.segundos > 5 && p.segundos < v.duration - 15) { v.currentTime = p.segundos; toast(`Seguís desde ${Math.floor(p.segundos / 60)}:${String(p.segundos % 60).padStart(2, '0')}`); }
      }, { once: true });
      v.play().catch(() => { /* el navegador puede pedir un toque */ });
      const sig = d.siguiente;
      v.addEventListener('ended', () => {
        terminado = true; guardar(true);
        if (!sig || !$('#autoSig').checked) return;
        const aviso = $('#sigAviso'); aviso.hidden = false;
        let n = 8; $('#cuenta').textContent = n;
        cuentaT = setInterval(() => { n--; $('#cuenta').textContent = n; if (n <= 0) { clearInterval(cuentaT); location.hash = `#/ver/${sig.id}`; } }, 1000);
        $('#cancelarSig').onclick = () => { clearInterval(cuentaT); aviso.hidden = true; };
      });
      const teclas = e => {
        if (e.target.closest('input, select, textarea')) return;
        const k = e.key.toLowerCase();
        if (k === 'f') { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : v.requestFullscreen?.(); }
        else if (k === 'n' && sig) location.hash = `#/ver/${sig.id}`;
        else if (e.target !== v) {
          if (k === ' ' && !e.target.closest('button, a')) { e.preventDefault(); v.paused ? v.play() : v.pause(); }
          else if (k === 'arrowright') { e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 10); }
          else if (k === 'arrowleft') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); }
        }
      };
      document.addEventListener('keydown', teclas);
      const oculto = () => { if (document.visibilityState === 'hidden') guardar(true); };
      document.addEventListener('visibilitychange', oculto);
      limpiarVista = () => { guardar(true); clearInterval(cuentaT); document.removeEventListener('keydown', teclas); document.removeEventListener('visibilitychange', oculto); v.pause(); };
    }).catch(e => toast(e.message, true));
    v.addEventListener('timeupdate', () => guardar());
    v.addEventListener('pause', () => guardar(true));
    v.addEventListener('error', () => { if (v.error) toast('No se pudo reproducir el video (formato no compatible con este navegador).', true); });
    $('#autoSig').onchange = e => localStorageSet('aninube_auto', e.target.checked ? '1' : '0');
  },
};

/* =================================================================== router */
let renderId = 0;
async function render(arriba = true) {
  try { limpiarVista?.(); } catch { /* nada */ }
  limpiarVista = null;
  const crudo = location.hash.replace(/^#\/?/, '');
  const [camino, query = ''] = crudo.split('?');
  const [nombre = 'inicio', ...args] = camino.split('/');
  const vista = VISTAS[nombre] ? nombre : 'inicio';
  const mio = ++renderId;
  document.body.dataset.vista = vista;
  document.querySelectorAll('[data-ruta]').forEach(a => { const on = a.dataset.ruta === vista; a.classList.toggle('activo', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  if (vista === 'inicio' || vista === 'serie' || vista === 'mi-lista') {
    // refrescar "seguir viendo" y la lista al volver
    try { await cargar(); } catch { /* usa lo que haya */ }
  }
  let html;
  try { html = await VISTAS[vista](args, new URLSearchParams(query)); }
  catch (e) { html = `<div class="contenido pagina">${vacio('⚠️', 'No se pudo cargar', e.message, '<a class="btn-pri" href="#/inicio">Ir al inicio</a>')}</div>`; }
  if (mio !== renderId) return;
  $vista.innerHTML = html;
  DESPUES[vista]?.(args);
  if (arriba) { scrollTo(0, 0); $vista.focus({ preventScroll: true }); }
}

$('#formBuscar').onsubmit = e => { e.preventDefault(); const q = $('#buscar').value.trim(); location.hash = '#/catalogo' + (q ? `?q=${encodeURIComponent(q)}` : ''); $('#buscar').blur(); };
const $pop = $('#popUsuario');
$('#btnUsuario').onclick = e => { e.stopPropagation(); $pop.hidden = !$pop.hidden; $('#btnUsuario').setAttribute('aria-expanded', !$pop.hidden); };
document.addEventListener('click', e => { if (!$pop.hidden && !$pop.contains(e.target)) { $pop.hidden = true; $('#btnUsuario').setAttribute('aria-expanded', 'false'); } });
addEventListener('scroll', () => $('#top').classList.toggle('solida', scrollY > 20), { passive: true });
addEventListener('hashchange', () => render());
addEventListener('pagehide', () => { try { limpiarVista?.(); } catch { /* nada */ } });

(async () => {
  try { await cargar(); } catch (e) { $vista.innerHTML = `<div class="contenido pagina">${vacio('⚠️', 'No se pudo cargar AniNube', e.message)}</div>`; return; }
  render();
})();
