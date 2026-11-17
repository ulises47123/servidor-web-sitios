import { api, esc, fmt } from './util.js?v=2';

export const titulo = 'Registro';
export const sub = 'Auditoría: quién hizo qué y desde dónde';

export async function render(el) {
  el.innerHTML = `<div class="card"><div class="fila" style="margin-bottom:12px">
      <div class="campo" style="margin:0"><label for="b">Buscar (detalle, usuario o IP)</label><input id="b" type="search"></div>
      <div class="campo" style="margin:0;flex:0 0 240px"><label for="ev">Evento</label><select id="ev"><option value="">Todos</option></select></div></div>
    <div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Usuario</th><th>IP</th><th>Detalle</th></tr></thead><tbody id="t"></tbody></table></div>
    <div class="fila" style="justify-content:space-between;margin-top:12px"><span class="muted chico" id="info"></span>
      <span class="fila"><button class="btn ghost chico" id="ant">← Anterior</button><button class="btn ghost chico" id="sig">Siguiente →</button></span></div></div>`;
  let pagina = 0, timer, eventosCargados = false;
  const cargar = async () => {
    const d = await api('servidor', 'registro', { buscar: el.querySelector('#b').value, evento: el.querySelector('#ev').value, pagina });
    if (!eventosCargados) {
      el.querySelector('#ev').insertAdjacentHTML('beforeend', d.eventos.map(e => `<option>${esc(e)}</option>`).join(''));
      eventosCargados = true;
    }
    el.querySelector('#t').innerHTML = d.filas.map(f => `<tr><td class="muted chico" style="white-space:nowrap">${esc(fmt.fecha(f.fecha))}</td>
      <td><b class="${/fallido|bloqueado|csrf/.test(f.evento) ? 'tag err' : ''}">${esc(f.evento)}</b></td><td>${esc(f.usuario)}</td><td class="muted chico">${esc(f.ip)}</td><td class="chico">${esc(f.detalle)}</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Sin resultados</td></tr>';
    const desde = d.total ? pagina * 50 + 1 : 0;
    el.querySelector('#info').textContent = `${desde}–${Math.min(d.total, (pagina + 1) * 50)} de ${d.total}`;
    el.querySelector('#ant').disabled = pagina === 0;
    el.querySelector('#sig').disabled = (pagina + 1) * 50 >= d.total;
  };
  el.querySelector('#b').oninput = () => { clearTimeout(timer); timer = setTimeout(() => { pagina = 0; cargar(); }, 300); };
  el.querySelector('#ev').onchange = () => { pagina = 0; cargar(); };
  el.querySelector('#ant').onclick = () => { pagina--; cargar(); };
  el.querySelector('#sig').onclick = () => { pagina++; cargar(); };
  await cargar();
}
