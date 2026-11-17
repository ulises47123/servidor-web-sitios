import { api, esc, fmt, modal, confirmar, toast, intentar, subirPorPartes, duracionMedia, capturarMiniatura } from './util.js?v=2';

export const titulo = 'Anime';
export const sub = 'Catálogo de AniNube';

const VIDEO = '.mp4,.m4v,.webm,.ogv';
let $el, meta = { generos: [], estados: {} };

export async function render(el, args) {
  $el = el;
  if (args[0] === 'serie' && args[1]) return serie(+args[1]);
  el.innerHTML = `
    <div class="fila" style="margin-bottom:16px"><button class="btn" id="nueva">＋ Nueva serie</button>
      <input id="filtro" type="search" placeholder="Filtrar series…" style="max-width:260px"></div>
    <div class="card"><div class="tabla-wrap"><table><thead><tr><th></th><th>Serie</th><th>Géneros</th><th>Estado</th><th class="num">Episodios</th><th></th></tr></thead><tbody id="tabla"></tbody></table></div></div>`;
  const d = await api('anime', 'listar');
  meta = { generos: d.generos, estados: d.estados };
  const pintar = () => {
    const f = el.querySelector('#filtro').value.toLowerCase();
    const l = d.series.filter(s => !f || `${s.titulo} ${s.titulo_alt} ${s.generos}`.toLowerCase().includes(f));
    el.querySelector('#tabla').innerHTML = l.length ? l.map(s => `<tr>
      <td>${s.portada ? `<img class="mini" src="/media.php?t=portada&id=${s.id}&v=${encodeURIComponent(s.actualizado)}" alt="" loading="lazy">` : '<div class="mini"></div>'}</td>
      <td><a href="#anime/serie/${s.id}"><b>${esc(s.titulo)}</b></a>${+s.destacada ? ' <span class="tag sis">destacada</span>' : ''}<div class="muted chico">${esc(s.titulo_alt)} ${s.anio ? '· ' + s.anio : ''}</div></td>
      <td class="chico">${esc(s.generos || '—')}</td><td><span class="tag off">${esc(meta.estados[s.estado] || s.estado)}</span></td>
      <td class="num">${s.n_eps}</td><td><div class="acciones"><a class="btn ghost chico" href="#anime/serie/${s.id}">Administrar</a></div></td></tr>`).join('')
      : `<tr><td colspan="6"><div class="vacio">${d.series.length ? 'Nada coincide' : 'Todavía no hay series. Creá la primera con “Nueva serie”.'}</div></td></tr>`;
  };
  el.querySelector('#filtro').oninput = pintar;
  el.querySelector('#nueva').onclick = () => formSerie();
  pintar();
}

function formSerie(s = null, generosSel = []) {
  const v = s || { titulo: '', titulo_alt: '', sinopsis: '', anio: '', estado: 'emision', destacada: 0 };
  return modal({
    titulo: s ? 'Editar serie' : 'Nueva serie', aceptar: s ? 'Guardar' : 'Crear', ancho: true,
    cuerpo: `<div class="fila"><div class="campo"><label for="s-t">Título</label><input id="s-t" name="titulo" required maxlength="200" value="${esc(v.titulo)}"></div>
      <div class="campo"><label for="s-ta">Título alternativo</label><input id="s-ta" name="titulo_alt" maxlength="200" value="${esc(v.titulo_alt)}"></div></div>
      <div class="campo"><label for="s-s">Sinopsis</label><textarea id="s-s" name="sinopsis" rows="5" maxlength="5000">${esc(v.sinopsis)}</textarea></div>
      <div class="fila"><div class="campo" style="flex:0 0 120px"><label for="s-a">Año</label><input id="s-a" name="anio" type="number" min="1950" max="2100" value="${esc(v.anio ?? '')}"></div>
        <div class="campo" style="flex:0 0 180px"><label for="s-e">Estado</label><select id="s-e" name="estado">${Object.entries(meta.estados).map(([k, n]) => `<option value="${k}" ${k === v.estado ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <label class="check" style="margin-bottom:14px"><input type="checkbox" name="destacada" ${+v.destacada ? 'checked' : ''}> Destacada (aparece en el carrusel)</label></div>
      <div class="lbl" style="margin-bottom:6px">Géneros</div>
      <div class="chips">${meta.generos.map(g => `<label class="chip"><input type="checkbox" name="gen" value="${esc(g)}" ${generosSel.includes(g) ? 'checked' : ''}>${esc(g)}</label>`).join('')}</div>`,
    alEnviar: async f => {
      const datos = { titulo: f.titulo.value, titulo_alt: f.titulo_alt.value, sinopsis: f.sinopsis.value, anio: f.anio.value, estado: f.estado.value,
        destacada: f.destacada.checked, generos: [...f.querySelectorAll('[name=gen]:checked')].map(x => x.value) };
      if (s) { await api('anime', 'editar', { id: s.id, ...datos }); toast('Guardado'); serie(s.id); }
      else { const r = await api('anime', 'crear', datos); toast('Serie creada'); location.hash = `#anime/serie/${r.id}`; }
    },
  });
}

async function serie(id) {
  if (!meta.generos.length) { const d = await api('anime', 'listar'); meta = { generos: d.generos, estados: d.estados }; }
  const { serie: s, episodios } = await api('anime', 'serie', { id });
  const ts = encodeURIComponent(s.actualizado);
  $el.innerHTML = `
    <div class="fila" style="margin-bottom:14px"><a class="btn ghost chico" href="#anime">← Series</a></div>
    <div class="card"><div class="serie-cab">
      <img src="${s.portada ? `/media.php?t=portada&id=${s.id}&v=${ts}` : 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}" alt="Portada">
      <div><h3 style="font-size:1.3rem">${esc(s.titulo)} ${+s.destacada ? '<span class="tag sis">destacada</span>' : ''}</h3>
        <p class="muted chico">${esc(s.titulo_alt)} ${s.anio ? '· ' + s.anio : ''} · ${esc(meta.estados[s.estado] || s.estado)} · ${esc(s.generos.join(', ') || 'sin géneros')}</p>
        <p style="margin:10px 0;line-height:1.55;white-space:pre-line">${esc(s.sinopsis) || '<i class="muted">Sin sinopsis</i>'}</p>
        <div class="fila"><button class="btn ghost chico" id="ed">✏️ Editar datos</button>
          <label class="btn ghost chico">🖼️ Portada (vertical)<input type="file" id="por" accept="image/jpeg,image/png,image/webp" hidden></label>
          <label class="btn ghost chico">🏞️ Banner (horizontal)<input type="file" id="ban" accept="image/jpeg,image/png,image/webp" hidden></label>
          <button class="btn peligro chico" id="del">🗑️ Borrar serie</button></div>
        ${s.banner ? `<img src="/media.php?t=banner&id=${s.id}&v=${ts}" alt="Banner" style="margin-top:12px;width:100%;max-width:420px;aspect-ratio:16/6;object-fit:cover;border-radius:10px">` : ''}
      </div></div></div>
    <div class="card"><h3>⬆ Subir episodios</h3>
      <p class="muted chico" style="margin-bottom:10px">Formatos que el navegador reproduce: <b>MP4 (H.264 + AAC)</b> o <b>WebM</b>. Los .mkv/.avi no se reproducen: convertilos antes (por ejemplo con HandBrake). Se suben por partes, así que pueden ser archivos grandes.</p>
      <div class="fila"><label class="btn">🎬 Elegir videos<input type="file" id="vids" accept="${VIDEO}" multiple hidden></label>
        <div class="campo" style="flex:0 0 110px;margin:0"><label for="temp">Temporada</label><input id="temp" type="number" min="1" value="1"></div>
        <button class="btn ok" id="subir" disabled>Subir todo</button></div>
      <div class="cola-subida" id="cola"></div></div>
    <div class="card"><h3>Episodios (${episodios.length})</h3><div class="tabla-wrap"><table><thead><tr><th></th><th>Ep.</th><th>Título</th><th class="num">Duración</th><th class="num">Tamaño</th><th></th></tr></thead><tbody>
      ${episodios.length ? episodios.map(e => `<tr data-id="${e.id}"><td>${e.miniatura ? `<img class="mini ancha" src="/media.php?t=miniatura&id=${e.id}" alt="" loading="lazy">` : '<div class="mini ancha"></div>'}</td>
        <td>T${e.temporada} · E${e.numero}</td><td>${esc(e.titulo) || '<span class="muted">—</span>'}</td><td class="num">${fmt.dur(e.duracion)}</td><td class="num muted">${esc(e.tamano)}</td>
        <td><div class="acciones"><button class="btn ghost chico" data-ver>▶</button><button class="btn ghost chico" data-ed>Editar</button><button class="btn peligro chico" data-del>🗑️</button></div></td></tr>`).join('')
      : '<tr><td colspan="6"><div class="vacio">Sin episodios todavía</div></td></tr>'}</tbody></table></div></div>`;

  $el.querySelector('#ed').onclick = () => formSerie(s, s.generos);
  for (const [sel, tipo] of [['#por', 'portada'], ['#ban', 'banner']]) {
    $el.querySelector(sel).onchange = e => intentar(async () => {
      const fd = new FormData(); fd.append('id', s.id); fd.append('tipo', tipo); fd.append('imagen', e.target.files[0]);
      await api('anime', 'imagen', fd); toast('Imagen guardada'); serie(s.id);
    });
  }
  $el.querySelector('#del').onclick = async () => {
    if (!await confirmar('Borrar serie', `Se borran <b>${esc(s.titulo)}</b>, sus ${episodios.length} episodios (archivos incluidos) y el progreso de todos los usuarios.`, { escribir: s.titulo, aceptar: 'Borrar' })) return;
    intentar(async () => { await api('anime', 'borrar', { id: s.id, confirmar: s.titulo }); toast('Serie borrada'); location.hash = '#anime'; });
  };
  $el.querySelectorAll('tr[data-id]').forEach(tr => {
    const e = episodios.find(x => x.id == tr.dataset.id);
    tr.querySelector('[data-ver]').onclick = () => modal({ titulo: `T${e.temporada} E${e.numero} ${e.titulo}`, aceptar: '', ancho: true, cuerpo: `<video controls autoplay src="/media.php?t=video&id=${e.id}" style="width:100%;border-radius:10px;background:#000"></video>` }).then(() => document.querySelector('#modal video')?.pause());
    tr.querySelector('[data-ed]').onclick = () => modal({
      titulo: 'Editar episodio',
      cuerpo: `<div class="fila"><div class="campo"><label for="ee-t">Temporada</label><input id="ee-t" name="temporada" type="number" min="1" value="${e.temporada}"></div>
        <div class="campo"><label for="ee-n">Número</label><input id="ee-n" name="numero" type="number" min="1" value="${e.numero}"></div></div>
        <div class="campo"><label for="ee-ti">Título</label><input id="ee-ti" name="titulo" maxlength="200" value="${esc(e.titulo)}"></div>`,
      alEnviar: async f => { await api('anime', 'episodio_editar', { id: e.id, temporada: f.temporada.value, numero: f.numero.value, titulo: f.titulo.value }); toast('Guardado'); serie(s.id); },
    });
    tr.querySelector('[data-del]').onclick = async () => {
      if (!await confirmar('Borrar episodio', `¿Borrar T${e.temporada} E${e.numero}? Se elimina el archivo de video.`, { aceptar: 'Borrar' })) return;
      intentar(async () => { await api('anime', 'episodio_borrar', { id: e.id }); toast('Episodio borrado'); serie(s.id); });
    };
  });

  // ---- cola de episodios ----
  let cola = [];
  const siguienteNum = t => Math.max(0, ...episodios.filter(x => +x.temporada === t).map(x => +x.numero), ...cola.filter(x => !x.hecho).map(x => +x.div.querySelector('[name=numero]').value || 0)) + 1;
  const $btn = $el.querySelector('#subir');
  const actualizar = () => { $btn.disabled = !cola.some(x => !x.hecho && !x.cancelado); };
  $el.querySelector('#vids').onchange = async ev => {
    const files = [...ev.target.files].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    ev.target.value = '';
    const t = +$el.querySelector('#temp').value || 1;
    for (const file of files) {
      const it = { file, hecho: false, cancelado: false };
      const div = document.createElement('div');
      div.className = 'item-subida';
      const m = file.name.match(/(?:ep?|cap[ií]tulo|episodio|\b)[\s._-]*(\d{1,4})(?!.*\d{1,4})/i);
      div.innerHTML = `<div class="mini"></div><div style="min-width:0"><div class="chico"><b>${esc(file.name)}</b> <span class="muted">${fmt.bytes(file.size)}</span></div>
        <div class="campos"><input name="temporada" type="number" min="1" value="${t}" aria-label="Temporada" title="Temporada">
        <input name="numero" type="number" min="1" value="${m ? +m[1] : siguienteNum(t)}" aria-label="Número" title="Número">
        <input name="titulo" placeholder="Título del episodio (opcional)" aria-label="Título"></div>
        <div class="barra"><i></i></div><div class="estado">En espera</div></div><button class="btn ghost chico" data-q>✕</button>`;
      it.div = div;
      div.querySelector('[data-q]').onclick = () => { it.cancelado = true; if (!it.subiendo) { div.remove(); cola = cola.filter(x => x !== it); actualizar(); } };
      $el.querySelector('#cola').append(div);
      cola.push(it);
      capturarMiniatura(file).then(img => { it.mini = img; if (img) div.querySelector('.mini').outerHTML = `<img class="mini ancha" src="${img}" alt="">`; });
    }
    actualizar();
  };
  $btn.onclick = async () => {
    $btn.disabled = true;
    let ok = 0;
    for (const it of cola) {
      if (it.hecho || it.cancelado) continue;
      const $e = it.div.querySelector('.estado'), $b = it.div.querySelector('.barra i');
      const v = n => it.div.querySelector(`[name=${n}]`).value;
      it.subiendo = true;
      try {
        const duracion = await duracionMedia(it.file, 'video');
        const idSubida = await subirPorPartes('anime', it.file, { extraInicio: { serie_id: s.id }, alProgreso: p => { $b.style.width = `${Math.round(p * 100)}%`; $e.textContent = `Subiendo… ${Math.round(p * 100)}%`; }, cancelado: () => it.cancelado });
        $e.textContent = 'Guardando…';
        await api('anime', 'subida_finalizar', { id: idSubida, serie_id: s.id, temporada: v('temporada'), numero: v('numero'), titulo: v('titulo'), duracion, miniatura: it.mini || '' });
        it.hecho = true; ok++; $e.textContent = '✔ Subido';
      } catch (e) { $e.textContent = '✖ ' + e.message; $e.style.color = '#fca5a5'; }
      finally { it.subiendo = false; }
    }
    actualizar();
    if (ok) { toast(`${ok} episodio(s) subidos`); setTimeout(() => serie(s.id), 800); }
  };
}
