// Good: sugerencias (busquedas recientes + titulos del indice), teclado y "/" para enfocar.
(() => {
  const $q = document.getElementById('q');
  const $caja = document.getElementById('caja');
  const $lista = document.getElementById('sugerencias');
  if (!$q || !$lista) return;
  const form = $q.form;
  const CLAVE = 'good_recientes';
  let sel = -1, items = [], timer = null, pedido = 0;

  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { return []; } };
  const guardar = a => { try { localStorage.setItem(CLAVE, JSON.stringify(a.slice(0, 8))); } catch { /* sin almacenamiento */ } };

  form.addEventListener('submit', e => {
    const v = $q.value.trim();
    if (!v) { e.preventDefault(); $q.focus(); return; }
    guardar([v, ...leer().filter(x => x !== v)]);
  });

  function pintar(recientes, remotas) {
    $lista.textContent = '';
    items = [...recientes.map(t => ({ t, rec: true })), ...remotas.filter(t => !recientes.includes(t)).map(t => ({ t, rec: false }))].slice(0, 9);
    sel = -1;
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'sug-' + i;
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = it.rec ? '↺' : '⌕';
      const tx = document.createElement('span'); tx.className = 'txt'; tx.textContent = it.t;
      li.append(ic, tx);
      if (it.rec) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Quitar';
        b.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); guardar(leer().filter(x => x !== it.t)); actualizar(); });
        li.append(b);
      }
      li.addEventListener('mousedown', e => { e.preventDefault(); $q.value = it.t; form.requestSubmit(); });
      $lista.append(li);
    });
    const ver = items.length > 0 && document.activeElement === $q;
    $lista.classList.toggle('ver', ver);
    $caja.classList.toggle('abierta', ver);
    $q.setAttribute('aria-expanded', String(ver));
    $q.removeAttribute('aria-activedescendant');
  }

  function actualizar() {
    const v = $q.value.trim().toLowerCase();
    const rec = leer().filter(x => x.toLowerCase().includes(v)).slice(0, 4);
    pintar(rec, []);
    clearTimeout(timer);
    if (v.length < 2) return;
    timer = setTimeout(async () => {
      const n = ++pedido;
      try {
        const r = await fetch('/good/sugerir.php?q=' + encodeURIComponent(v), { credentials: 'same-origin' });
        const d = await r.json();
        if (n === pedido && document.activeElement === $q) pintar(rec, d.sugerencias || []);
      } catch { /* sin sugerencias */ }
    }, 150);
  }

  function cerrar() { $lista.classList.remove('ver'); $caja.classList.remove('abierta'); $q.setAttribute('aria-expanded', 'false'); }

  $q.addEventListener('focus', actualizar);
  $q.addEventListener('input', actualizar);
  $q.addEventListener('blur', () => setTimeout(cerrar, 100));
  $q.addEventListener('keydown', e => {
    if (e.key === 'Escape') { cerrar(); return; }
    if (!$lista.classList.contains('ver') || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = items.length + 1;
      sel = ((sel + 1) + (e.key === 'ArrowDown' ? 1 : -1) + n) % n - 1;
      [...$lista.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === sel)));
      if (sel >= 0) { $q.value = items[sel].t; $q.setAttribute('aria-activedescendant', 'sug-' + sel); }
      else $q.removeAttribute('aria-activedescendant');
    }
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === '/' && t !== $q && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
      e.preventDefault(); $q.focus(); $q.select();
    }
  });
})();
