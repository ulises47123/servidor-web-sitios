import { api, esc, fmt } from './util.js?v=2';

export const titulo = 'Resumen';
export const sub = 'Estado del servidor en tiempo real';

let timer = null;

export async function render(el) {
  el.innerHTML = `
  <div class="grid kpi">
    ${['cpu|CPU|⚡', 'ram|Memoria|🧠', 'disco|Disco|💾'].map(x => { const [id, n, ic] = x.split('|'); return `
    <div class="card"><div class="kpi-lbl">${ic} ${n}</div><div class="kpi-val" id="k-${id}">--%</div>
      <div class="barra" id="bb-${id}"><i id="b-${id}"></i></div><div class="sub-barra"><span id="t-${id}"></span></div></div>`; }).join('')}
    <div class="card"><div class="kpi-lbl">🌐 Sitios</div><div class="kpi-val" id="k-sitios">--</div>
      <div class="sub-barra"><span id="t-sitios"></span></div></div>
  </div>
  <div class="grid kpi" style="margin-top:16px" id="contenidoKpi"></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>🔌 Servicios</h3><div class="chips" id="servicios"></div><p class="muted chico" style="margin-top:12px">Encendido hace: <b id="uptime">—</b></p></div>
    <div class="card"><h3>🕑 Actividad reciente <a class="btn ghost chico acciones" href="#registro">Ver todo</a></h3><div class="tabla-wrap"><table><tbody id="actividad"></tbody></table></div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>🗄️ Base de datos <span class="tag sis" id="motor"></span></h3>
    <div class="tabla-wrap"><table><thead><tr><th>Tabla</th><th class="num">Filas aprox.</th><th class="num">Tamaño</th></tr></thead><tbody id="tablas"></tbody></table></div></div>`;

  const pintar = d => {
    for (const [id, o, txt] of [
      ['cpu', d.cpu, d.cpu.carga ? `Carga ${d.cpu.carga.join(' / ')} · ${d.cpu.nucleos} núcleos` : `${d.cpu.nucleos} núcleo(s)`],
      ['ram', d.memoria, `${fmt.bytes(d.memoria.usado_kb * 1024)} de ${fmt.bytes(d.memoria.total_kb * 1024)}`],
      ['disco', d.disco, `${fmt.bytes(d.disco.usado)} de ${fmt.bytes(d.disco.total)}`],
    ]) {
      el.querySelector(`#k-${id}`).textContent = `${o.pct}%`;
      el.querySelector(`#b-${id}`).style.width = `${o.pct}%`;
      el.querySelector(`#bb-${id}`).classList.toggle('alto', o.pct >= 85);
      el.querySelector(`#t-${id}`).textContent = txt;
    }
    el.querySelector('#k-sitios').textContent = d.sitios.activos;
    el.querySelector('#t-sitios').textContent = `${d.sitios.publicos} públicos · ${d.sitios.activos - d.sitios.publicos} privados · ${d.sitios.total} en total`;
    const c = d.contenido;
    el.querySelector('#contenidoKpi').innerHTML = [
      ['🔎', 'Páginas en Good', c.paginas_indexadas, '#good'], ['🎵', 'Canciones', c.canciones, '#musica'],
      ['☁️', 'Series de anime', `${c.series} <small class="muted">(${c.episodios} ep.)</small>`, '#anime'], ['👥', 'Cuentas', c.cuentas, '#cuentas'],
    ].map(([ic, n, v, h]) => `<a class="card" href="${h}" style="text-decoration:none;color:inherit"><div class="kpi-lbl">${ic} ${n}</div><div class="kpi-val">${v}</div></a>`).join('');
    document.getElementById('hostname').textContent = d.hostname;
    el.querySelector('#uptime').textContent = fmt.uptime(d.uptime);
    el.querySelector('#servicios').innerHTML = d.servicios[0]?.conocido
      ? d.servicios.map(s => `<span class="tag ${s.activo ? 'pub' : 'err'}">${s.activo ? '●' : '○'} ${esc(s.nombre)}</span>`).join('')
      : '<span class="muted chico">El estado de servicios solo está disponible en el servidor (OpenRC).</span>';
    el.querySelector('#actividad').innerHTML = d.actividad.length
      ? d.actividad.map(a => `<tr><td class="muted chico" style="white-space:nowrap">${esc(fmt.fecha(a.fecha))}</td><td><b>${esc(a.evento)}</b> <span class="muted">${esc(a.detalle)}</span></td><td class="muted chico">${esc(a.usuario)}</td></tr>`).join('')
      : '<tr><td class="muted">Sin actividad todavía</td></tr>';
  };

  const cargar = async () => { try { pintar(await api('servidor', 'estado')); } catch { /* reintenta */ } };
  await cargar();
  timer = setInterval(cargar, 6000);

  try {
    const b = await api('servidor', 'basedatos');
    el.querySelector('#motor').textContent = b.motor;
    el.querySelector('#tablas').innerHTML = b.tablas.map(t => `<tr><td>${esc(t.nombre)}</td><td class="num">${Number(t.filas).toLocaleString('es')}</td><td class="num">${fmt.bytes(t.bytes)}</td></tr>`).join('');
  } catch (e) { el.querySelector('#tablas').innerHTML = `<tr><td class="muted">${esc(e.message)}</td></tr>`; }
}

export function salir() { clearInterval(timer); }
