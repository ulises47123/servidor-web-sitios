import { api, esc, fmt, modal, confirmar, toast, intentar } from './util.js?v=2';

export const titulo = 'Sitios';
export const sub = 'Crear, editar, publicar y administrar los archivos de cada sitio';

const COLORES = { blue: '#4f8cff', green: '#22c55e', orange: '#f59e0b', purple: '#8b5cf6', red: '#ef4444', teal: '#14b8a6' };
let $el;

export async function render(el, args) {
  $el = el;
  if (args[0] === 'archivos' && args[1]) return gestor(args[1], decodeURIComponent(args.slice(2).join('/')));
  el.innerHTML = `
    <div class="aviso">Los sitios <span class="tag pub">públicos</span> salen por el túnel de Cloudflare (y se ven en Good desde internet).
      Los <span class="tag priv">privados</span> solo se ven en la red local. Una carpeta nueva copiada en <code>sitios/</code> con un <code>index.html</code>
      se registra como <b>privada</b> con "Detectar carpetas nuevas" (y sola cada 10 minutos en el servidor).</div>
    <div class="fila" style="margin-bottom:16px">
      <button class="btn" id="nuevo">＋ Nuevo sitio</button>
      <button class="btn ghost" id="detectar">🔍 Detectar carpetas nuevas</button>
    </div>
    <div id="lista" class="sitios-grid"><div class="cargando">Cargando…</div></div>`;
  el.querySelector('#nuevo').onclick = nuevo;
  el.querySelector('#detectar').onclick = e => intentar(async () => {
    const r = await api('sitios', 'detectar');
    const ign = Object.entries(r.ignorados || {});
    toast(r.nuevos.length ? `Registrados como privados: ${r.nuevos.join(', ')}` : 'No hay carpetas nuevas');
    if (ign.length) {
      await modal({ titulo: 'Carpetas ignoradas', aceptar: '', cuerpo: `<ul style="padding-left:18px;line-height:1.7">${ign.map(([n, m]) => `<li><code>${esc(n)}</code>: ${esc(m)}</li>`).join('')}</ul>` });
    }
    listar();
  }, e.currentTarget);
  await listar();
}

async function listar() {
  const { sitios } = await api('sitios', 'listar');
  const $l = $el.querySelector('#lista');
  if (!sitios.length) { $l.innerHTML = '<div class="vacio">Todavía no hay sitios.</div>'; return; }
  $l.innerHTML = sitios.map(s => {
    const vis = !+s.activa ? '<span class="tag off">desactivado</span>' : +s.publica ? '<span class="tag pub">público</span>' : '<span class="tag priv">privado</span>';
    return `<div class="card sitio" data-slug="${esc(s.slug)}">
      <div class="cab"><div class="av" style="background:${s.hex}22;color:${s.hex}">${esc(s.icono)}</div>
        <div style="min-width:0"><h4>${esc(s.nombre)}</h4><div class="muted chico"><code>/sitios/${esc(s.slug)}/</code></div></div></div>
      <div class="tags">${vis}${+s.sistema ? '<span class="tag sis">sistema</span>' : ''}<span class="tag off">${esc(s.categoria)}</span>
        ${!s.existe ? '<span class="tag err">falta la carpeta</span>' : !s.tiene_index ? '<span class="tag err">sin index</span>' : ''}
        <span class="tag off" title="Entradas en el índice de Good">🔎 ${s.paginas}</span></div>
      <p class="desc">${esc(s.descripcion) || '<i>Sin descripción</i>'}</p>
      <div class="fila">
        <label class="switch"><input type="checkbox" data-campo="activa" ${+s.activa ? 'checked' : ''}> Activo</label>
        <label class="switch"><input type="checkbox" data-campo="publica" ${+s.publica ? 'checked' : ''} ${+s.activa ? '' : 'disabled'}> Público</label>
      </div>
      <div class="acciones">
        <a class="btn ghost chico" href="http://${location.hostname}${location.hostname === '127.0.0.1' ? ':8080' : ''}/sitios/${esc(s.slug)}/" target="_blank" rel="noopener">Abrir ↗</a>
        <a class="btn ghost chico" href="#sitios/archivos/${esc(s.slug)}">📁 Archivos</a>
        <button class="btn ghost chico" data-acc="editar">✏️ Editar</button>
        <button class="btn ghost chico" data-acc="reindexar">🔎 Reindexar</button>
        ${+s.sistema ? '' : '<button class="btn peligro chico" data-acc="borrar">🗑️</button>'}
      </div></div>`;
  }).join('');
  $l.querySelectorAll('.sitio').forEach(card => {
    const s = sitios.find(x => x.slug === card.dataset.slug);
    card.querySelectorAll('input[data-campo]').forEach(chk => chk.onchange = async () => {
      const campo = chk.dataset.campo;
      if (campo === 'publica' && chk.checked) {
        const ok = await confirmar('Publicar en internet', `<b>${esc(s.nombre)}</b> va a quedar visible por el túnel de Cloudflare para cualquiera que tenga el enlace, y sus páginas van a aparecer en Good desde internet.`, { aceptar: 'Publicar', peligro: false });
        if (!ok) { chk.checked = false; return; }
      }
      await intentar(async () => {
        await api('sitios', 'actualizar', { slug: s.slug, [campo]: chk.checked });
        toast('Guardado');
        listar();
      });
    });
    card.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => ({ editar, reindexar, borrar })[b.dataset.acc](s, b));
  });
}

function formSitio(s = {}) {
  return `
    <div class="fila"><div class="campo"><label for="f-nombre">Nombre</label><input id="f-nombre" name="nombre" maxlength="80" required value="${esc(s.nombre)}"></div>
      ${s.slug ? '' : '<div class="campo"><label for="f-slug">Carpeta (opcional)</label><input id="f-slug" name="slug" maxlength="48" pattern="[a-z0-9][a-z0-9_\\-]*" placeholder="se genera del nombre"></div>'}</div>
    <div class="campo"><label for="f-desc">Descripción (aparece en Good)</label><textarea id="f-desc" name="descripcion" maxlength="255" rows="2">${esc(s.descripcion)}</textarea></div>
    <div class="fila"><div class="campo"><label for="f-cat">Categoría</label><input id="f-cat" name="categoria" maxlength="60" value="${esc(s.categoria || 'General')}"></div>
      <div class="campo" style="flex:0 0 90px"><label for="f-ico">Ícono</label><input id="f-ico" name="icono" maxlength="8" value="${esc(s.icono || '🌐')}"></div>
      <div class="campo" style="flex:0 0 140px"><label for="f-color">Color</label><select id="f-color" name="color">${Object.keys(COLORES).map(c => `<option ${s.color === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
    ${s.slug ? '' : '<label class="check"><input type="checkbox" name="publica"> Publicar en internet al crearlo</label>'}`;
}

function nuevo() {
  modal({
    titulo: 'Nuevo sitio', aceptar: 'Crear', cuerpo: formSitio(),
    alEnviar: async f => {
      const r = await api('sitios', 'crear', { nombre: f.nombre.value, slug: f.slug.value, descripcion: f.descripcion.value, categoria: f.categoria.value, icono: f.icono.value, color: f.color.value, publica: f.publica.checked });
      toast(`Sitio creado: /sitios/${r.slug}/`);
      listar();
    },
  });
}

function editar(s) {
  modal({
    titulo: `Editar ${s.nombre}`, cuerpo: formSitio(s),
    alEnviar: async f => {
      await api('sitios', 'actualizar', { slug: s.slug, nombre: f.nombre.value, descripcion: f.descripcion.value, categoria: f.categoria.value, icono: f.icono.value, color: f.color.value });
      toast('Guardado');
      listar();
    },
  });
}

function reindexar(s, b) {
  intentar(async () => { const r = await api('sitios', 'reindexar', { slug: s.slug }); toast(`${s.nombre}: ${r.entradas} entradas en Good`); listar(); }, b);
}

async function borrar(s) {
  const ok = await confirmar('Eliminar sitio', `Se quita <b>${esc(s.nombre)}</b> del servidor y de Good. La carpeta se mueve a <code>_datos/papelera/</code> (se puede recuperar a mano).`, { escribir: s.slug, aceptar: 'Eliminar' });
  if (!ok) return;
  intentar(async () => { await api('sitios', 'borrar', { slug: s.slug, confirmar: s.slug }); toast('Sitio eliminado'); listar(); });
}

/* ------------------------------------------------------- gestor de archivos */

async function gestor(slug, ruta) {
  $el.innerHTML = `<div class="card"><h3>📁 Archivos de <code>${esc(slug)}</code>
      <span class="acciones fila"><a class="btn ghost chico" href="#sitios">← Sitios</a></span></h3>
    <div class="ruta" id="ruta"></div>
    <div class="fila" style="margin-bottom:12px">
      <button class="btn chico" id="nuevoArch">＋ Archivo</button>
      <button class="btn ghost chico" id="nuevaCarp">＋ Carpeta</button>
      <label class="btn ghost chico">⬆ Subir archivos<input type="file" id="subirArch" multiple hidden></label>
      <label class="btn ghost chico">⬆ Subir carpeta<input type="file" id="subirCarp" webkitdirectory hidden></label>
      <button class="btn ghost chico" id="reidx">🔎 Reindexar</button>
    </div>
    <p class="muted chico" style="margin-bottom:10px">Por seguridad no se permiten archivos de código de servidor (.php, .phtml, .htaccess…).</p>
    <div class="tabla-wrap"><table><thead><tr><th>Nombre</th><th class="num">Tamaño</th><th>Modificado</th><th></th></tr></thead><tbody id="items"></tbody></table></div></div>`;
  const ir = r => { location.hash = `#sitios/archivos/${slug}/${r.split('/').map(encodeURIComponent).join('/')}`; };
  const partes = ruta ? ruta.split('/') : [];
  const $ruta = $el.querySelector('#ruta');
  $ruta.innerHTML = `<button data-r="">${esc(slug)}</button>` + partes.map((p, i) => ` / <button data-r="${esc(partes.slice(0, i + 1).join('/'))}">${esc(p)}</button>`).join('');
  $ruta.querySelectorAll('button').forEach(b => b.onclick = () => ir(b.dataset.r));
  const unir = n => (ruta ? ruta + '/' : '') + n;
  const recargar = () => gestor(slug, ruta);

  let items = [];
  try { items = (await api('archivos', 'listar', { ruta }, `&sitio=${encodeURIComponent(slug)}`)).items; }
  catch (e) { $el.querySelector('#items').innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`; return; }
  const $items = $el.querySelector('#items');
  $items.innerHTML = (ruta ? `<tr><td colspan="4"><button class="arch-nombre" data-subir>⬆ ..</button></td></tr>` : '') +
    (items.length ? items.map(it => `<tr data-n="${esc(it.nombre)}"><td><button class="arch-nombre" data-abrir>${it.carpeta ? '📁' : it.editable ? '📝' : '📄'} ${esc(it.nombre)}</button></td>
      <td class="num muted">${it.carpeta ? '' : fmt.bytes(it.tamano)}</td><td class="muted chico">${esc(it.mod)}</td>
      <td><div class="acciones"><button class="btn ghost chico" data-ren>Renombrar</button><button class="btn peligro chico" data-del>Borrar</button></div></td></tr>`).join('')
      : '<tr><td colspan="4" class="muted">Carpeta vacía</td></tr>');
  $items.querySelector('[data-subir]')?.addEventListener('click', () => ir(partes.slice(0, -1).join('/')));
  $items.querySelectorAll('tr[data-n]').forEach(tr => {
    const it = items.find(x => x.nombre === tr.dataset.n);
    tr.querySelector('[data-abrir]').onclick = () => it.carpeta ? ir(unir(it.nombre)) : it.editable ? editarArchivo(slug, unir(it.nombre)) : window.open(`http://${location.hostname}${location.hostname === '127.0.0.1' ? ':8080' : ''}/sitios/${slug}/${unir(it.nombre)}`, '_blank', 'noopener');
    tr.querySelector('[data-ren]').onclick = () => modal({
      titulo: 'Renombrar', aceptar: 'Renombrar', cuerpo: `<div class="campo"><label for="nn">Nuevo nombre</label><input id="nn" name="nn" value="${esc(it.nombre)}" required></div>`,
      alEnviar: async f => { await api('archivos', 'renombrar', { ruta: unir(it.nombre), nuevo: f.nn.value }, `&sitio=${slug}`); toast('Renombrado'); recargar(); },
    });
    tr.querySelector('[data-del]').onclick = async () => {
      if (!await confirmar('Borrar', `¿Borrar ${it.carpeta ? 'la carpeta' : 'el archivo'} <code>${esc(unir(it.nombre))}</code>${it.carpeta ? ' con todo su contenido' : ''}? No se puede deshacer.`, { aceptar: 'Borrar', escribir: it.carpeta ? it.nombre : '' })) return;
      intentar(async () => { await api('archivos', 'borrar', { ruta: unir(it.nombre) }, `&sitio=${slug}`); toast('Borrado'); recargar(); });
    };
  });

  $el.querySelector('#nuevaCarp').onclick = () => modal({
    titulo: 'Nueva carpeta', aceptar: 'Crear', cuerpo: '<div class="campo"><label for="nc">Nombre</label><input id="nc" name="nc" required></div>',
    alEnviar: async f => { await api('archivos', 'carpeta', { ruta: unir(f.nc.value) }, `&sitio=${slug}`); recargar(); },
  });
  $el.querySelector('#nuevoArch').onclick = () => modal({
    titulo: 'Nuevo archivo', aceptar: 'Crear', cuerpo: '<div class="campo"><label for="na">Nombre (ej. pagina.html, estilos.css)</label><input id="na" name="na" required></div>',
    alEnviar: async f => { await api('archivos', 'guardar', { ruta: unir(f.na.value), contenido: '' }, `&sitio=${slug}`); recargar(); editarArchivo(slug, unir(f.na.value)); },
  });
  const subir = async (input, conRutas) => {
    const files = [...input.files];
    if (!files.length) return;
    const fd = new FormData();
    fd.append('ruta', ruta);
    files.forEach(f => fd.append('archivos[]', f));
    fd.append('rutas', JSON.stringify(files.map(f => conRutas ? f.webkitRelativePath : f.name)));
    toast(`Subiendo ${files.length} archivo(s)…`);
    await intentar(async () => {
      const r = await api('archivos', 'subir', fd, `&sitio=${slug}`);
      toast(`Subidos: ${r.subidos.length}${r.rechazados.length ? ` · rechazados: ${r.rechazados.length}` : ''}`, r.rechazados.length > 0);
      if (r.rechazados.length) await modal({ titulo: 'Archivos rechazados', aceptar: '', cuerpo: `<ul style="padding-left:18px;line-height:1.7">${r.rechazados.map(x => `<li><code>${esc(x.archivo)}</code>: ${esc(x.motivo)}</li>`).join('')}</ul>` });
      recargar();
    });
    input.value = '';
  };
  $el.querySelector('#subirArch').onchange = e => subir(e.target, false);
  $el.querySelector('#subirCarp').onchange = e => subir(e.target, true);
  $el.querySelector('#reidx').onclick = e => intentar(async () => { const r = await api('sitios', 'reindexar', { slug }); toast(`${r.entradas} entradas en Good`); }, e.currentTarget);
}

async function editarArchivo(slug, ruta) {
  let contenido;
  try { contenido = (await api('archivos', 'leer', { ruta }, `&sitio=${slug}`)).contenido; }
  catch (e) { toast(e.message, true); return; }
  modal({
    titulo: `Editar ${ruta}`, ancho: true, aceptar: 'Guardar',
    cuerpo: `<textarea class="editor" name="ed" spellcheck="false">${esc(contenido)}</textarea>
      <p class="muted chico">Tab inserta espacios. Ctrl+S guarda.</p>`,
    alAbrir: f => {
      f.ed.addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); const s = f.ed.selectionStart; f.ed.setRangeText('  ', s, f.ed.selectionEnd, 'end'); }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); }
      });
    },
    alEnviar: async f => { await api('archivos', 'guardar', { ruta, contenido: f.ed.value }, `&sitio=${slug}`); toast('Guardado. Reindexá el sitio para actualizar Good.'); },
  });
}
