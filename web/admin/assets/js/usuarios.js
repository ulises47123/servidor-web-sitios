import { api, esc, fmt, modal, confirmar, toast, intentar, YO } from './util.js?v=2';

/* ------------------------------------------------------------------ cuentas */
export const cuentas = {
  titulo: 'Cuentas',
  sub: 'Usuarios de TS_LINE y AniNube (una misma cuenta sirve para los dos)',
  async render(el) {
    el.innerHTML = `<div class="fila" style="margin-bottom:16px"><button class="btn" id="nueva">＋ Nueva cuenta</button></div>
      <div class="card"><div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Estado</th><th class="num">Me gusta</th><th class="num">Playlists</th><th class="num">Mi lista</th><th>Último ingreso</th><th></th></tr></thead><tbody id="t"></tbody></table></div></div>`;
    const cargar = async () => {
      const { cuentas: l } = await api('usuarios', 'cuentas');
      const $t = el.querySelector('#t');
      $t.innerHTML = l.length ? l.map(c => `<tr data-id="${c.id}"><td><b>${esc(c.usuario)}</b><div class="muted chico">desde ${esc(fmt.fecha(c.creado))}</div></td>
        <td>${+c.activa ? '<span class="tag pub">activa</span>' : '<span class="tag off">desactivada</span>'}</td>
        <td class="num">${c.likes}</td><td class="num">${c.listas}</td><td class="num">${c.en_lista}</td><td class="muted chico">${esc(fmt.fecha(c.ultimo_login))}</td>
        <td><div class="acciones"><button class="btn ghost chico" data-pass>Contraseña</button>
          <button class="btn ghost chico" data-act>${+c.activa ? 'Desactivar' : 'Activar'}</button><button class="btn peligro chico" data-del>🗑️</button></div></td></tr>`).join('')
        : '<tr><td colspan="7"><div class="vacio">No hay cuentas. Creá una para poder entrar a TS_LINE y AniNube.</div></td></tr>';
      $t.querySelectorAll('tr[data-id]').forEach(tr => {
        const c = l.find(x => x.id == tr.dataset.id);
        tr.querySelector('[data-pass]').onclick = () => modal({
          titulo: `Nueva contraseña para ${c.usuario}`,
          cuerpo: '<div class="campo"><label for="np">Contraseña (mínimo 6)</label><input id="np" name="np" type="password" minlength="6" required autocomplete="new-password"></div>',
          alEnviar: async f => { await api('usuarios', 'cuenta_pass', { id: c.id, pass: f.np.value }); toast('Contraseña cambiada'); },
        });
        tr.querySelector('[data-act]').onclick = e => intentar(async () => { await api('usuarios', 'cuenta_activa', { id: c.id, activa: !+c.activa }); cargar(); }, e.currentTarget);
        tr.querySelector('[data-del]').onclick = async () => {
          if (!await confirmar('Borrar cuenta', `Se borra <b>${esc(c.usuario)}</b> con sus playlists, me gusta, Mi lista y progreso.`, { aceptar: 'Borrar' })) return;
          intentar(async () => { await api('usuarios', 'cuenta_borrar', { id: c.id }); toast('Cuenta borrada'); cargar(); });
        };
      });
    };
    el.querySelector('#nueva').onclick = () => modal({
      titulo: 'Nueva cuenta', aceptar: 'Crear',
      cuerpo: `<div class="campo"><label for="nu">Usuario (3 a 32: letras, números, _ . -)</label><input id="nu" name="nu" required pattern="[A-Za-z0-9_.\\-]{3,32}" autocomplete="off"></div>
        <div class="campo"><label for="np">Contraseña (mínimo 6)</label><input id="np" name="np" type="password" minlength="6" required autocomplete="new-password"></div>`,
      alEnviar: async f => { await api('usuarios', 'cuenta_crear', { usuario: f.nu.value, pass: f.np.value }); toast('Cuenta creada'); cargar(); },
    });
    await cargar();
  },
};

/* --------------------------------------------------------- administradores */
export const admins = {
  titulo: 'Administradores',
  sub: 'Quién puede entrar a este panel',
  async render(el) {
    el.innerHTML = `<div class="aviso warn">Las contraseñas de administrador deben tener al menos 10 caracteres. Siempre queda al menos un administrador activo.</div>
      <div class="fila" style="margin-bottom:16px"><button class="btn" id="nuevo">＋ Nuevo administrador</button><button class="btn ghost" id="mia">🔑 Cambiar mi contraseña</button></div>
      <div class="card"><div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Estado</th><th>Creado</th><th>Último ingreso</th><th></th></tr></thead><tbody id="t"></tbody></table></div></div>`;
    const passCampos = (actual) => `${actual ? '<div class="campo"><label for="pa">Contraseña actual</label><input id="pa" name="pa" type="password" required autocomplete="current-password"></div>' : ''}
      <div class="campo"><label for="p1">Nueva contraseña (mínimo 10)</label><input id="p1" name="p1" type="password" minlength="10" required autocomplete="new-password"></div>
      <div class="campo"><label for="p2">Repetila</label><input id="p2" name="p2" type="password" minlength="10" required autocomplete="new-password"></div>`;
    const igual = f => { if (f.p1.value !== f.p2.value) { toast('Las contraseñas no coinciden', true); return false; } return true; };
    const cargar = async () => {
      const { admins: l } = await api('usuarios', 'admins');
      const $t = el.querySelector('#t');
      $t.innerHTML = l.map(a => `<tr data-u="${esc(a.usuario)}"><td><b>${esc(a.usuario)}</b>${a.usuario === YO ? ' <span class="tag sis">vos</span>' : ''}</td>
        <td>${+a.activo ? '<span class="tag pub">activo</span>' : '<span class="tag off">desactivado</span>'}</td><td class="muted chico">${esc(fmt.fecha(a.creado))}</td><td class="muted chico">${esc(fmt.fecha(a.ultimo_login))}</td>
        <td>${a.usuario === YO ? '' : `<div class="acciones"><button class="btn ghost chico" data-pass>Contraseña</button><button class="btn ghost chico" data-act>${+a.activo ? 'Desactivar' : 'Activar'}</button><button class="btn peligro chico" data-del>🗑️</button></div>`}</td></tr>`).join('');
      $t.querySelectorAll('tr[data-u]').forEach(tr => {
        const a = l.find(x => x.usuario === tr.dataset.u);
        if (a.usuario === YO) return;
        tr.querySelector('[data-pass]').onclick = () => modal({ titulo: `Contraseña de ${a.usuario}`, cuerpo: passCampos(false),
          alEnviar: async f => { if (!igual(f)) return false; await api('usuarios', 'admin_pass', { usuario: a.usuario, pass: f.p1.value }); toast('Contraseña cambiada'); } });
        tr.querySelector('[data-act]').onclick = e => intentar(async () => { await api('usuarios', 'admin_activo', { usuario: a.usuario, activo: !+a.activo }); cargar(); }, e.currentTarget);
        tr.querySelector('[data-del]').onclick = async () => {
          if (!await confirmar('Borrar administrador', `¿Quitar el acceso de <b>${esc(a.usuario)}</b> al panel?`, { escribir: a.usuario, aceptar: 'Borrar' })) return;
          intentar(async () => { await api('usuarios', 'admin_borrar', { usuario: a.usuario }); toast('Administrador borrado'); cargar(); });
        };
      });
    };
    el.querySelector('#nuevo').onclick = () => modal({ titulo: 'Nuevo administrador', aceptar: 'Crear',
      cuerpo: `<div class="campo"><label for="nu">Usuario</label><input id="nu" name="nu" required pattern="[A-Za-z0-9_.\\-]{3,32}" autocomplete="off"></div>${passCampos(false)}`,
      alEnviar: async f => { if (!igual(f)) return false; await api('usuarios', 'admin_crear', { usuario: f.nu.value, pass: f.p1.value }); toast('Administrador creado'); cargar(); } });
    el.querySelector('#mia').onclick = () => modal({ titulo: 'Cambiar mi contraseña', cuerpo: passCampos(true),
      alEnviar: async f => { if (!igual(f)) return false; await api('usuarios', 'admin_pass', { usuario: YO, actual: f.pa.value, pass: f.p1.value }); toast('Tu contraseña fue cambiada'); } });
    await cargar();
  },
};
