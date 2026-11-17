import { api, esc, fmt, modal, confirmar, toast, intentar, subirPorPartes, duracionMedia, leerID3, tituloDesdeArchivo } from './util.js?v=2';

export const titulo = 'Música';
export const sub = 'Biblioteca de TS_LINE';

const AUDIO = '.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.webm';
let $el, generos = [], pistas = [];

export async function render(el) {
  $el = el;
  el.innerHTML = `
    <div class="card"><h3>⬆ Subir canciones</h3>
      <p class="muted chico" style="margin-bottom:10px">Elegí uno o varios archivos (${AUDIO.replaceAll(',', ' ')}). Del mp3 se leen título, artista, álbum y portada; podés corregirlos antes de subir.</p>
      <div class="fila"><label class="btn">🎵 Elegir archivos<input type="file" id="elegir" accept="${AUDIO}" multiple hidden></label>
        <div class="campo" style="flex:0 0 220px;margin:0"><label for="genTodos">Género para todas</label><select id="genTodos"></select></div>
        <button class="btn ok" id="subirTodo" disabled>Subir todo</button></div>
      <div class="cola-subida" id="cola"></div>
    </div>
    <div class="card"><h3>Biblioteca <span class="muted chico" id="cuenta"></span>
      <span class="acciones"><input id="filtro" type="search" placeholder="Filtrar…" style="width:200px"></span></h3>
      <div class="tabla-wrap"><table><thead><tr><th></th><th>Título</th><th>Artista · Álbum</th><th>Género</th><th class="num">Duración</th><th class="num">▶</th><th></th></tr></thead><tbody id="tabla"></tbody></table></div>
    </div>`;
  el.querySelector('#elegir').onchange = e => { agregarACola([...e.target.files]); e.target.value = ''; };
  el.querySelector('#subirTodo').onclick = subirCola;
  el.querySelector('#filtro').oninput = pintar;
  await cargar();
  el.querySelector('#genTodos').innerHTML = '<option value="">(cada una)</option>' + generos.map(g => `<option>${esc(g)}</option>`).join('');
  el.querySelector('#genTodos').onchange = e => { if (e.target.value) $el.querySelectorAll('.item-subida select[name=genero]').forEach(s => s.value = e.target.value); };
}

async function cargar() {
  const d = await api('musica', 'listar');
  generos = d.generos; pistas = d.pistas;
  pintar();
}

function pintar() {
  const f = ($el.querySelector('#filtro')?.value || '').toLowerCase();
  const lista = pistas.filter(p => !f || `${p.titulo} ${p.artista} ${p.album} ${p.genero}`.toLowerCase().includes(f));
  $el.querySelector('#cuenta').textContent = `(${pistas.length})`;
  const $t = $el.querySelector('#tabla');
  $t.innerHTML = lista.length ? lista.map(p => `<tr data-id="${p.id}">
      <td>${p.portada ? `<img class="mini" src="/media.php?t=cover&id=${p.id}&v=${encodeURIComponent(p.portada)}" alt="" loading="lazy">` : '<div class="mini"></div>'}</td>
      <td><b>${esc(p.titulo)}</b>${p.letra ? ' <span class="tag sis" title="Tiene letra sincronizada">LRC</span>' : ''}<div class="muted chico">${esc(p.tamano)} · ${esc(fmt.fecha(p.subido))}</div></td>
      <td>${esc(p.artista) || '<span class="muted">—</span>'}<div class="muted chico">${esc(p.album)}</div></td>
      <td><span class="tag off">${esc(p.genero)}</span></td><td class="num">${fmt.dur(p.duracion)}</td><td class="num muted">${p.reproducciones}</td>
      <td><div class="acciones"><button class="btn ghost chico" data-oir title="Escuchar">▶</button><button class="btn ghost chico" data-ed>Editar</button><button class="btn peligro chico" data-del>🗑️</button></div></td></tr>`).join('')
    : `<tr><td colspan="7"><div class="vacio">${pistas.length ? 'Nada coincide con el filtro' : 'Todavía no hay canciones. Subí las primeras arriba.'}</div></td></tr>`;
  $t.querySelectorAll('tr[data-id]').forEach(tr => {
    const p = pistas.find(x => x.id == tr.dataset.id);
    tr.querySelector('[data-oir]').onclick = () => modal({ titulo: p.titulo, aceptar: '', cuerpo: `<audio controls autoplay src="/media.php?t=audio&id=${p.id}" style="width:100%"></audio>` }).then(() => document.querySelector('#modal audio')?.pause());
    tr.querySelector('[data-ed]').onclick = () => editar(p);
    tr.querySelector('[data-del]').onclick = async () => {
      if (!await confirmar('Borrar canción', `¿Borrar <b>${esc(p.titulo)}</b>? Se elimina el archivo y desaparece de playlists y me gusta.`, { aceptar: 'Borrar' })) return;
      intentar(async () => { await api('musica', 'borrar', { id: p.id }); toast('Canción borrada'); cargar(); });
    };
  });
}

function editar(p) {
  modal({
    titulo: 'Editar canción',
    cuerpo: `<div class="campo"><label for="e-t">Título</label><input id="e-t" name="titulo" value="${esc(p.titulo)}" required maxlength="200"></div>
      <div class="fila"><div class="campo"><label for="e-a">Artista</label><input id="e-a" name="artista" value="${esc(p.artista)}" maxlength="160"></div>
      <div class="campo"><label for="e-al">Álbum</label><input id="e-al" name="album" value="${esc(p.album)}" maxlength="160"></div></div>
      <div class="campo"><label for="e-g">Género</label><select id="e-g" name="genero">${generos.map(g => `<option ${g === p.genero ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
      <div class="fila"><div class="campo"><label for="e-p">Cambiar portada (jpg/png/webp)</label><input id="e-p" name="portada" type="file" accept="image/jpeg,image/png,image/webp"></div>
      <div class="campo"><label for="e-l">Letra sincronizada (.lrc)</label><input id="e-l" name="letra" type="file" accept=".lrc,text/plain"></div></div>
      ${p.letra ? '<label class="check"><input type="checkbox" name="quitarLetra"> Quitar la letra actual</label>' : ''}`,
    alEnviar: async f => {
      await api('musica', 'editar', { id: p.id, titulo: f.titulo.value, artista: f.artista.value, album: f.album.value, genero: f.genero.value });
      if (f.portada.files[0]) { const fd = new FormData(); fd.append('id', p.id); fd.append('imagen', f.portada.files[0]); await api('musica', 'portada', fd); }
      if (f.letra.files[0]) { const fd = new FormData(); fd.append('id', p.id); fd.append('letra', f.letra.files[0]); await api('musica', 'letra', fd); }
      if (f.quitarLetra?.checked) await api('musica', 'quitar_letra', { id: p.id });
      toast('Guardado');
      cargar();
    },
  });
}

/* ------------------------------------------------------------- cola de subida */

let cola = [];

async function agregarACola(files) {
  const $c = $el.querySelector('#cola');
  for (const file of files) {
    const it = { file, cancelado: false, hecho: false };
    const id3 = file.name.toLowerCase().endsWith('.mp3') ? await leerID3(file) : {};
    const deNombre = tituloDesdeArchivo(file.name);
    it.portada = id3.portada || '';
    const div = document.createElement('div');
    div.className = 'item-subida';
    const genSel = $el.querySelector('#genTodos').value;
    div.innerHTML = `${it.portada ? `<img class="mini" src="${it.portada}" alt="">` : '<div class="mini"></div>'}
      <div style="min-width:0"><div class="chico"><b>${esc(file.name)}</b> <span class="muted">${fmt.bytes(file.size)}</span></div>
        <div class="campos"><input name="titulo" placeholder="Título" value="${esc(id3.titulo || deNombre.titulo)}" aria-label="Título">
          <input name="artista" placeholder="Artista" value="${esc(id3.artista || deNombre.artista)}" aria-label="Artista">
          <input name="album" placeholder="Álbum" value="${esc(id3.album || '')}" aria-label="Álbum">
          <select name="genero" aria-label="Género">${generos.map(g => `<option ${g === (genSel || 'Otros') ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <div class="barra"><i></i></div><div class="estado">En espera</div></div>
      <button class="btn ghost chico" data-quitar title="Quitar">✕</button>`;
    div.querySelector('[data-quitar]').onclick = () => { it.cancelado = true; if (!it.subiendo) { div.remove(); cola = cola.filter(x => x !== it); actualizarBoton(); } };
    it.div = div;
    $c.append(div);
    cola.push(it);
  }
  actualizarBoton();
}

function actualizarBoton() {
  $el.querySelector('#subirTodo').disabled = !cola.some(x => !x.hecho && !x.cancelado);
}

async function subirCola() {
  $el.querySelector('#subirTodo').disabled = true;
  let ok = 0;
  for (const it of cola) {
    if (it.hecho || it.cancelado) continue;
    const $e = it.div.querySelector('.estado'), $b = it.div.querySelector('.barra i');
    const v = n => it.div.querySelector(`[name=${n}]`).value;
    it.subiendo = true;
    try {
      $e.textContent = 'Leyendo duración…';
      const duracion = await duracionMedia(it.file, 'audio');
      $e.textContent = 'Subiendo…';
      const idSubida = await subirPorPartes('musica', it.file, { alProgreso: p => { $b.style.width = `${Math.round(p * 100)}%`; $e.textContent = `Subiendo… ${Math.round(p * 100)}%`; }, cancelado: () => it.cancelado });
      $e.textContent = 'Guardando…';
      await api('musica', 'subida_finalizar', { id: idSubida, titulo: v('titulo'), artista: v('artista'), album: v('album'), genero: v('genero'), duracion, portada: it.portada });
      it.hecho = true; ok++;
      $e.textContent = '✔ Subida';
      it.div.style.opacity = '.6';
    } catch (e) {
      $e.textContent = '✖ ' + e.message;
      $e.style.color = '#fca5a5';
    } finally { it.subiendo = false; }
  }
  cola = cola.filter(x => !x.hecho);
  setTimeout(() => $el.querySelectorAll('.item-subida').forEach(d => { if (d.style.opacity === '0.6') d.remove(); }), 2500);
  actualizarBoton();
  if (ok) { toast(`${ok} canción(es) subidas`); cargar(); }
}
