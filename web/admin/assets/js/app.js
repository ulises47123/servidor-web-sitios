// Panel: enrutador por #hash. Cada seccion es un modulo con { titulo, sub, render(el), salir?() }.
import { toast } from './util.js?v=2';

const SECCIONES = {
  resumen:  () => import('./resumen.js?v=2'),
  sitios:   () => import('./sitios.js?v=2'),
  good:     () => import('./good.js?v=2'),
  musica:   () => import('./musica.js?v=2'),
  anime:    () => import('./anime.js?v=2'),
  cuentas:  () => import('./usuarios.js?v=2').then(m => m.cuentas),
  admins:   () => import('./usuarios.js?v=2').then(m => m.admins),
  energia:  () => import('./energia.js?v=2'),
  registro: () => import('./registro.js?v=2'),
};

const $cont = document.getElementById('contenido');
const $tit = document.getElementById('tituloSec');
const $sub = document.getElementById('subSec');
let actual = null;

async function navegar() {
  const nombre = (location.hash.slice(1).split('/')[0]) || 'resumen';
  const cargar = SECCIONES[nombre] || SECCIONES.resumen;
  document.querySelectorAll('.nav-item').forEach(a => {
    const on = a.getAttribute('href') === '#' + nombre;
    a.classList.toggle('activo', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  cerrarMenu();
  try { actual?.salir?.(); } catch { /* nada */ }
  $cont.innerHTML = '<div class="cargando">Cargando…</div>';
  try {
    const mod = await cargar();
    actual = mod;
    $tit.textContent = mod.titulo;
    $sub.textContent = mod.sub || '';
    document.title = `${mod.titulo} · Panel`;
    $cont.innerHTML = '';
    await mod.render($cont, location.hash.slice(1).split('/').slice(1));
  } catch (e) {
    console.error(e);
    $cont.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'aviso error';
    d.textContent = 'No se pudo cargar la sección: ' + e.message;
    $cont.append(d);
  }
}

const side = document.getElementById('side');
const velo = document.getElementById('velo');
function cerrarMenu() { side.classList.remove('abierta'); velo.classList.remove('ver'); }
document.getElementById('btnMenu').addEventListener('click', () => { side.classList.add('abierta'); velo.classList.add('ver'); });
velo.addEventListener('click', cerrarMenu);

window.addEventListener('hashchange', navegar);
window.addEventListener('unhandledrejection', e => toast(e.reason?.message || 'Error', true));
navegar();
