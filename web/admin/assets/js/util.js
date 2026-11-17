// Utilidades compartidas del panel: API con CSRF, toasts, modales, formato y subidas por partes.

const CSRF = document.querySelector('meta[name="csrf"]').content;
export const YO = document.querySelector('meta[name="usuario"]').content;

/** Escapa texto para insertarlo en HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Llama a /api/<mod>.php?a=<accion> con JSON (o FormData). Lanza Error con el mensaje del servidor. */
export async function api(mod, accion, datos = {}, extraQuery = '') {
  const esForm = datos instanceof FormData;
  let r;
  try {
    r = await fetch(`/api/${mod}.php?a=${encodeURIComponent(accion)}${extraQuery}`, {
      method: 'POST',
      headers: esForm ? { 'X-CSRF': CSRF } : { 'X-CSRF': CSRF, 'Content-Type': 'application/json' },
      body: esForm ? datos : JSON.stringify(datos),
      credentials: 'same-origin',
    });
  } catch (e) {
    throw new Error('Sin conexión con el servidor');
  }
  if (r.status === 401) {
    toast('La sesión venció. Volvé a entrar.', true);
    setTimeout(() => location.assign('/login.php'), 1200);
    throw new Error('Sesión vencida');
  }
  let d;
  try { d = await r.json(); } catch { throw new Error(`Respuesta inválida del servidor (${r.status})`); }
  if (!d.ok) throw new Error(d.error || 'Error');
  return d;
}

let toastT;
export function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!error);
  t.classList.add('ver');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('ver'), error ? 5000 : 2800);
}

/** Ejecuta una accion con manejo de errores y boton deshabilitado. */
export async function intentar(fn, boton) {
  if (boton) boton.disabled = true;
  try { return await fn(); }
  catch (e) { toast(e.message, true); return undefined; }
  finally { if (boton) boton.disabled = false; }
}

/**
 * Modal con formulario. `cuerpo` es HTML; `alEnviar(form)` puede devolver false para no cerrar.
 * Devuelve una promesa que resuelve con true (aceptado) o false (cancelado).
 */
export function modal({ titulo, cuerpo, aceptar = 'Guardar', peligro = false, ancho = false, alEnviar, alAbrir }) {
  const dlg = document.getElementById('modal');
  const form = document.getElementById('modalForm');
  dlg.classList.toggle('ancho', ancho);
  form.innerHTML = `<h3>${esc(titulo)}</h3><div class="cuerpo">${cuerpo}</div>
    <div class="pie"><button type="button" class="btn ghost" data-cancelar>Cancelar</button>
    ${aceptar ? `<button type="submit" class="btn ${peligro ? 'peligro' : ''}" data-aceptar>${esc(aceptar)}</button>` : ''}</div>`;
  return new Promise(resolve => {
    const cerrar = v => { dlg.close(); form.onsubmit = null; resolve(v); };
    form.querySelector('[data-cancelar]').onclick = () => cerrar(false);
    dlg.oncancel = e => { e.preventDefault(); cerrar(false); };
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('[data-aceptar]');
      if (!alEnviar) return cerrar(true);
      btn.disabled = true;
      try {
        const r = await alEnviar(form);
        if (r !== false) cerrar(true);
      } catch (err) { toast(err.message, true); }
      finally { btn.disabled = false; }
    };
    dlg.showModal();
    alAbrir?.(form);
    form.querySelector('input:not([type=hidden]),select,textarea')?.focus();
  });
}

/** Confirmacion simple; si `escribir` se da, hay que tipearlo exacto. */
export function confirmar(titulo, texto, { escribir = '', aceptar = 'Confirmar', peligro = true } = {}) {
  const extra = escribir
    ? `<div class="campo" style="margin-top:12px"><label for="cf">Para confirmar escribí <b>${esc(escribir)}</b></label><input id="cf" name="cf" autocomplete="off" required></div>`
    : '';
  return modal({
    titulo, aceptar, peligro,
    cuerpo: `<p class="muted" style="line-height:1.5">${texto}</p>${extra}`,
    alEnviar: form => {
      if (escribir && form.cf.value !== escribir) { toast('El texto no coincide', true); return false; }
      return true;
    },
  });
}

export const fmt = {
  bytes(b) {
    b = Number(b) || 0;
    const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
  },
  dur(s) {
    s = Math.round(Number(s) || 0);
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
  },
  uptime(s) {
    if (s == null) return '—';
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return [d && `${d} d`, h && `${h} h`, `${m} min`].filter(Boolean).join(' ');
  },
  fecha(f) { return f ? String(f).slice(0, 16).replace('T', ' ') : '—'; },
};

/* ---------------------------------------------------------------- subidas */

const PARTE = 8 * 1024 * 1024;

/**
 * Sube un archivo grande por partes. `mod` = 'musica' | 'anime'.
 * `extraInicio` se manda al iniciar (ej. serie_id); `finalizar` recibe el id de subida
 * y debe llamar a la accion de finalizar con los metadatos.
 */
export async function subirPorPartes(mod, file, { extraInicio = {}, alProgreso, cancelado }) {
  const { id } = await api(mod, 'subida_iniciar', { nombre: file.name, tamano: file.size, ...extraInicio });
  let offset = 0;
  try {
    while (offset < file.size) {
      if (cancelado?.()) throw new Error('Cancelada');
      const fd = new FormData();
      fd.append('id', id);
      fd.append('offset', String(offset));
      fd.append('parte', file.slice(offset, offset + PARTE), 'parte');
      const r = await api(mod, 'subida_parte', fd);
      offset = r.recibido;
      alProgreso?.(offset / file.size);
    }
  } catch (e) {
    api(mod, 'subida_cancelar', { id }).catch(() => {});
    throw e;
  }
  return id;
}

/** Duracion de un archivo de audio/video leyendo sus metadatos en el navegador. */
export function duracionMedia(file, tipo = 'audio') {
  return new Promise(res => {
    const el = document.createElement(tipo);
    const url = URL.createObjectURL(file);
    const fin = v => { URL.revokeObjectURL(url); res(v); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => fin(Number.isFinite(el.duration) ? Math.round(el.duration) : 0);
    el.onerror = () => fin(0);
    setTimeout(() => fin(0), 8000);
    el.src = url;
  });
}

/** Captura un cuadro del video (al 10%) como miniatura JPEG en data URL. */
export function capturarMiniatura(file) {
  return new Promise(res => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let listo = false;
    const fin = x => { if (listo) return; listo = true; URL.revokeObjectURL(url); res(x); };
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    v.onloadedmetadata = () => { v.currentTime = Math.min(Math.max(1, v.duration * 0.1), Math.max(0, v.duration - 0.5)); };
    v.onseeked = () => {
      try {
        const w = 480, h = Math.round(w * (v.videoHeight || 270) / (v.videoWidth || 480));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        fin(c.toDataURL('image/jpeg', 0.8));
      } catch { fin(''); }
    };
    v.onerror = () => fin('');
    setTimeout(() => fin(''), 15000);
    v.src = url;
  });
}

/** Lee etiquetas ID3v2 de un mp3 (titulo, artista, album y portada como data URL). */
export async function leerID3(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (!(head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33)) return {};
    const ver = head[3];
    const size = (head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9];
    const buf = new Uint8Array(await file.slice(0, 10 + size).arrayBuffer());
    const out = {};
    const dec = (bytes, enc) => {
      try {
        const nombre = enc === 1 || enc === 2 ? 'utf-16' : enc === 3 ? 'utf-8' : 'iso-8859-1';
        return new TextDecoder(nombre).decode(bytes).replace(/\0+$/, '').trim();
      } catch { return ''; }
    };
    let pos = 10;
    while (pos + 10 <= buf.length) {
      const id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fsize = ver === 4
        ? (buf[pos + 4] << 21) | (buf[pos + 5] << 14) | (buf[pos + 6] << 7) | buf[pos + 7]
        : (buf[pos + 4] << 24) | (buf[pos + 5] << 16) | (buf[pos + 6] << 8) | buf[pos + 7];
      const ini = pos + 10;
      if (fsize <= 0 || ini + fsize > buf.length) break;
      const data = buf.subarray(ini, ini + fsize);
      if (id === 'TIT2') out.titulo = dec(data.subarray(1), data[0]);
      else if (id === 'TPE1') out.artista = dec(data.subarray(1), data[0]);
      else if (id === 'TALB') out.album = dec(data.subarray(1), data[0]);
      else if (id === 'APIC' && !out.portada) {
        const enc = data[0];
        let p = 1, fm = 1;
        while (fm < data.length && data[fm] !== 0) fm++;
        const mime = dec(data.subarray(p, fm), 0) || 'image/jpeg';
        p = fm + 2;
        if (enc === 1 || enc === 2) { while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2; p += 2; }
        else { while (p < data.length && data[p] !== 0) p++; p += 1; }
        const img = data.subarray(p);
        if (img.length > 0 && img.length < 6 * 1024 * 1024) {
          let bin = '';
          for (let i = 0; i < img.length; i += 0x8000) bin += String.fromCharCode.apply(null, img.subarray(i, i + 0x8000));
          out.portada = `data:${mime.includes('/') ? mime : 'image/jpeg'};base64,${btoa(bin)}`;
        }
      }
      pos = ini + fsize;
    }
    return out;
  } catch { return {}; }
}

/** Separa "Artista - Titulo" del nombre de archivo y quita el [ID] de YouTube. */
export function tituloDesdeArchivo(nombre) {
  let base = nombre.replace(/\.[^.]+$/, '').replace(/\s*[[(_][A-Za-z0-9_-]{6,}[\])_]\s*$/, '').replace(/[_]+/g, ' ').trim();
  const partes = base.split(' - ');
  return partes.length > 1 ? { artista: partes[0].trim(), titulo: partes.slice(1).join(' - ').trim() } : { artista: '', titulo: base };
}
