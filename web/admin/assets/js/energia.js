import { api, modal, toast, intentar } from './util.js?v=2';

export const titulo = 'Energía';
export const sub = 'Pantalla física y apagado del servidor';

export async function render(el) {
  el.innerHTML = `<div class="aviso">Solo disponible desde la red privada. El apagado es inmediato y hay que volver a encender la máquina a mano.</div>
    <div class="grid g2">
      <div class="card"><h3>🖥️ Pantalla física</h3><p class="muted" style="margin-bottom:14px">Estado: <b id="est">consultando…</b></p>
        <div class="fila"><button class="btn" id="on">☀️ Encender</button><button class="btn ghost" id="off">🌑 Apagar</button></div></div>
      <div class="card"><h3>🔌 Apagar servidor</h3><p class="muted" style="margin-bottom:14px">Se cortan Good, los sitios, el túnel y este panel.</p>
        <button class="btn peligro" id="apagar">Apagar servidor…</button></div>
    </div>`;
  const estado = async () => {
    try { const r = await api('servidor', 'energia', { accion: 'pantalla-estado' }); el.querySelector('#est').textContent = r.salida.trim() === '0' ? 'Encendida' : 'Apagada'; }
    catch (e) { el.querySelector('#est').textContent = e.message; }
  };
  el.querySelector('#on').onclick = e => intentar(async () => { await api('servidor', 'energia', { accion: 'pantalla-on' }); toast('Pantalla encendida'); estado(); }, e.currentTarget);
  el.querySelector('#off').onclick = e => intentar(async () => { await api('servidor', 'energia', { accion: 'pantalla-off' }); toast('Pantalla apagada'); estado(); }, e.currentTarget);
  el.querySelector('#apagar').onclick = () => modal({
    titulo: 'Apagar el servidor', aceptar: 'Apagar', peligro: true,
    cuerpo: '<p class="muted" style="margin-bottom:10px">Para confirmar escribí <b>APAGAR</b>.</p><div class="campo"><input name="c" autocomplete="off" required aria-label="Confirmación"></div>',
    alEnviar: async f => { await api('servidor', 'energia', { accion: 'apagar', confirmar: f.c.value }); toast('Apagando el servidor…'); },
  });
  estado();
}
