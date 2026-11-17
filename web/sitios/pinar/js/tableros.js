/* Pinar — tableros guardados en localStorage.
   Todo acceso a localStorage va envuelto en try/catch: si el navegador no deja
   guardar (modo privado, archivo local bloqueado, etc.), los tableros funcionan
   igual durante la visita, pero no se conservan. */
(function () {
  'use strict';

  var CLAVE = 'pinar.tableros.v1';
  var datos = null;
  var persistente = null;
  var oyentes = [];

  function probarAlmacenamiento() {
    if (persistente !== null) return persistente;
    try {
      var prueba = '__pinar_prueba__';
      window.localStorage.setItem(prueba, '1');
      window.localStorage.removeItem(prueba);
      persistente = true;
    } catch (e) {
      persistente = false;
    }
    return persistente;
  }

  function validar(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.filter(function (t) {
      return t && typeof t.id === 'string' && typeof t.nombre === 'string' && Array.isArray(t.pines);
    }).map(function (t) {
      return {
        id: t.id,
        nombre: t.nombre.slice(0, 60),
        pines: t.pines.filter(function (s) { return typeof s === 'string'; }),
        creado: typeof t.creado === 'number' ? t.creado : Date.now()
      };
    });
  }

  function cargar() {
    if (datos) return datos;
    datos = [];
    try {
      var texto = window.localStorage.getItem(CLAVE);
      if (texto) datos = validar(JSON.parse(texto));
    } catch (e) {
      datos = [];
    }
    return datos;
  }

  function guardar() {
    var ok = false;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(datos));
      ok = true;
    } catch (e) {
      persistente = false;
    }
    oyentes.forEach(function (fn) {
      try { fn(); } catch (e) { /* un oyente roto no frena a los demás */ }
    });
    return ok;
  }

  function nuevoId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function buscar(id) {
    var lista = cargar();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  var Tableros = {
    disponible: probarAlmacenamiento,

    lista: function () {
      return cargar().slice();
    },

    obtener: buscar,

    crear: function (nombre) {
      nombre = String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (!nombre) return null;
      var lista = cargar();
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].nombre.toLowerCase() === nombre.toLowerCase()) return lista[i];
      }
      var tablero = { id: nuevoId(), nombre: nombre, pines: [], creado: Date.now() };
      lista.push(tablero);
      guardar();
      return tablero;
    },

    borrar: function (id) {
      var lista = cargar();
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) {
          lista.splice(i, 1);
          guardar();
          return true;
        }
      }
      return false;
    },

    contiene: function (id, slug) {
      var t = buscar(id);
      return !!t && t.pines.indexOf(slug) !== -1;
    },

    agregar: function (id, slug) {
      var t = buscar(id);
      if (!t || t.pines.indexOf(slug) !== -1) return false;
      t.pines.unshift(slug);
      guardar();
      return true;
    },

    quitar: function (id, slug) {
      var t = buscar(id);
      if (!t) return false;
      var pos = t.pines.indexOf(slug);
      if (pos === -1) return false;
      t.pines.splice(pos, 1);
      guardar();
      return true;
    },

    alternar: function (id, slug) {
      return this.contiene(id, slug) ? (this.quitar(id, slug), false) : (this.agregar(id, slug), true);
    },

    tablerosCon: function (slug) {
      return cargar().filter(function (t) { return t.pines.indexOf(slug) !== -1; });
    },

    totalGuardados: function () {
      var vistos = {};
      cargar().forEach(function (t) { t.pines.forEach(function (s) { vistos[s] = true; }); });
      return Object.keys(vistos).length;
    },

    alCambiar: function (fn) {
      if (typeof fn === 'function') oyentes.push(fn);
    }
  };

  // Si otra pestaña modifica los tableros, recargamos.
  try {
    window.addEventListener('storage', function (e) {
      if (e.key === CLAVE) {
        datos = null;
        oyentes.forEach(function (fn) { try { fn(); } catch (err) { /* nada */ } });
      }
    });
  } catch (e) { /* nada */ }

  window.PinarTableros = Tableros;
})();
