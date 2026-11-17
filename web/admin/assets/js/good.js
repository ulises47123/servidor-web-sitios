import { api, esc, fmt, toast, intentar } from './util.js?v=2';

export const titulo = 'Good';
export const sub = 'Índice del buscador';

export async function render(el) {
  el.innerHTML = `
    <div class="aviso">Good indexa cada página <code>.html</code> de los sitios activos (título, descripción, títulos y texto),
      además de cada serie de AniNube y cada canción de TS_LINE. Desde internet solo aparecen resultados de sitios <b>públicos</b>.</div>
    <div class="fila" style="margin-bottom:16px">
      <button class="btn" id="todo">🔄 Detectar y reindexar todo</button>
      <a class="btn ghost" href="http://${location.hostname}${location.hostname === '127.0.0.1' ? ':8080' : ''}/" target="_blank" rel="noopener">Abrir Good ↗</a>
    </div>
    <div class="grid kpi" id="kpis"></div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>Por sitio</h3><div class="tabla-wrap"><table><thead><tr><th>Sitio</th><th>Visible</th><th class="num">Entradas</th><th>Indexado</th></tr></thead><tbody id="porSitio"></tbody></table></div></div>
      <div class="card"><h3>Últimas entradas</h3><div class="tabla-wrap"><table><tbody id="ultimas"></tbody></table></div></div>
    </div>`;
  el.querySelector('#todo').onclick = e => intentar(async () => {
    const r = await api('sitios', 'reindexar_todo');
    const total = Object.values(r.sitios).reduce((a, b) => a + b, 0);
    const nuevos = r.detectados.nuevos;
    toast(`${total} entradas indexadas${nuevos.length ? ` · sitios nuevos (privados): ${nuevos.join(', ')}` : ''}`);
    cargar();
  }, e.currentTarget);

  async function cargar() {
    const d = await api('sitios', 'good_estado');
    const tipos = Object.fromEntries(d.por_tipo.map(t => [t.tipo, t.n]));
    el.querySelector('#kpis').innerHTML = [['🔎', 'Total', d.total], ['📄', 'Páginas', tipos.pagina || 0], ['☁️', 'Series', tipos.anime || 0], ['🎵', 'Canciones', tipos.musica || 0]]
      .map(([i, n, v]) => `<div class="card"><div class="kpi-lbl">${i} ${n}</div><div class="kpi-val">${v}</div></div>`).join('');
    el.querySelector('#porSitio').innerHTML = d.por_sitio.map(s => `<tr><td>${esc(s.icono)} ${esc(s.nombre)}</td>
      <td>${!+s.activa ? '<span class="tag off">no</span>' : +s.publica ? '<span class="tag pub">internet + LAN</span>' : '<span class="tag priv">solo LAN</span>'}</td>
      <td class="num">${s.n}</td><td class="muted chico">${esc(fmt.fecha(s.indexado_en))}</td></tr>`).join('');
    el.querySelector('#ultimas').innerHTML = d.ultimas.map(u => `<tr><td><span class="tag off">${esc(u.tipo)}</span></td><td><b>${esc(u.titulo)}</b><div class="muted chico"><code>${esc(u.url)}</code></div></td></tr>`).join('')
      || '<tr><td class="muted">El índice está vacío</td></tr>';
  }
  await cargar();
}
