// Acceso a la API de TS_LINE (sesion por cookie + token CSRF en los POST).
const CSRF = document.querySelector('meta[name="csrf"]').content;

async function pedir(url, opciones) {
  let r;
  try { r = await fetch(url, { credentials: 'same-origin', ...opciones }); }
  catch { throw new Error('Sin conexión'); }
  if (r.status === 401) { location.href = 'login.php'; throw new Error('Sesión vencida'); }
  let d;
  try { d = await r.json(); } catch { throw new Error('Respuesta inválida del servidor'); }
  if (!d.ok) throw new Error(d.error || 'Error');
  return d;
}

export const get = a => pedir(`api.php?a=${encodeURIComponent(a)}`, { cache: 'no-store' });
export const post = (a, datos = {}) => pedir(`api.php?a=${encodeURIComponent(a)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF },
  body: JSON.stringify(datos),
});

/** Letra .lrc -> [{t: segundos, txt}] (sin marcas: una linea por renglon, t=-1). */
export async function letra(id) {
  const r = await fetch(`media.php?t=letra&id=${id}`, { credentials: 'same-origin' });
  if (!r.ok) return [];
  const txt = await r.text();
  const out = [];
  for (const linea of txt.split(/\r?\n/)) {
    const marcas = [...linea.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const texto = linea.replace(/\[[^\]]*\]/g, '').trim();
    if (!marcas.length) continue;
    for (const m of marcas) {
      const frac = m[3] ? Number(m[3]) / (m[3].length === 3 ? 1000 : 100) : 0;
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, txt: texto });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
