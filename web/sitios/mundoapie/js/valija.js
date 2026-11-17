/* Mundo a Pie – checklist de valija con estado en localStorage (siempre con try/catch). */
(function () {
  "use strict";

  var CLAVE = "mundoapie-valija-v1";
  var contenedor = document.getElementById("lista-valija");
  var listaPropia = document.getElementById("lista-propia");
  var formAgregar = document.getElementById("form-agregar");
  var inputNuevo = document.getElementById("nuevo-item");
  var botonDesmarcar = document.getElementById("desmarcar");
  var textoProgreso = document.getElementById("progreso-texto");
  var relleno = document.getElementById("progreso-relleno");
  var aviso = document.getElementById("aviso-guardado");
  if (!contenedor) return;

  var estado = { marcados: {}, propios: [] };
  var almacenamientoOk = true;

  function cargar() {
    try {
      var crudo = window.localStorage.getItem(CLAVE);
      if (crudo) {
        var datos = JSON.parse(crudo);
        if (datos && typeof datos === "object") {
          estado.marcados = datos.marcados && typeof datos.marcados === "object" ? datos.marcados : {};
          estado.propios = Array.isArray(datos.propios) ? datos.propios.filter(function (p) {
            return p && typeof p.id === "string" && typeof p.texto === "string";
          }) : [];
        }
      }
    } catch (e) {
      almacenamientoOk = false;
    }
  }

  function guardar() {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      almacenamientoOk = false;
    }
    if (aviso) aviso.hidden = almacenamientoOk;
  }

  function checkboxes() {
    return Array.prototype.slice.call(contenedor.querySelectorAll('input[type="checkbox"][data-id]'));
  }

  function actualizarProgreso() {
    var todos = checkboxes();
    var hechos = todos.filter(function (c) { return c.checked; }).length;
    var total = todos.length;
    if (textoProgreso) {
      textoProgreso.textContent = hechos === total && total > 0
        ? "¡Listo! Tenés las " + total + " cosas en la valija."
        : hechos + " de " + total + " cosas listas";
    }
    if (relleno) relleno.style.width = (total ? (hechos / total) * 100 : 0) + "%";
  }

  function crearItemPropio(item) {
    var li = document.createElement("li");
    li.className = "item-propio";
    var label = document.createElement("label");
    label.className = "check";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("data-id", item.id);
    input.checked = !!estado.marcados[item.id];
    var span = document.createElement("span");
    span.textContent = item.texto;
    label.appendChild(input);
    label.appendChild(span);

    var quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "quitar";
    quitar.textContent = "×";
    quitar.setAttribute("aria-label", "Quitar “" + item.texto + "” de la lista");
    quitar.addEventListener("click", function () {
      estado.propios = estado.propios.filter(function (p) { return p.id !== item.id; });
      delete estado.marcados[item.id];
      li.parentNode.removeChild(li);
      guardar();
      actualizarProgreso();
      if (inputNuevo) inputNuevo.focus();
    });

    li.appendChild(label);
    li.appendChild(quitar);
    return li;
  }

  function pintarPropios() {
    if (!listaPropia) return;
    listaPropia.textContent = "";
    estado.propios.forEach(function (item) { listaPropia.appendChild(crearItemPropio(item)); });
  }

  cargar();
  pintarPropios();
  checkboxes().forEach(function (c) { c.checked = !!estado.marcados[c.getAttribute("data-id")]; });
  if (aviso) aviso.hidden = almacenamientoOk;
  actualizarProgreso();

  contenedor.addEventListener("change", function (ev) {
    var c = ev.target;
    if (!c || c.type !== "checkbox" || !c.hasAttribute("data-id")) return;
    var id = c.getAttribute("data-id");
    if (c.checked) estado.marcados[id] = true; else delete estado.marcados[id];
    guardar();
    actualizarProgreso();
  });

  if (formAgregar && inputNuevo) {
    formAgregar.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var texto = inputNuevo.value.trim().slice(0, 80);
      if (!texto) { inputNuevo.focus(); return; }
      var item = { id: "propio-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), texto: texto };
      estado.propios.push(item);
      listaPropia.appendChild(crearItemPropio(item));
      inputNuevo.value = "";
      inputNuevo.focus();
      guardar();
      actualizarProgreso();
    });
  }

  if (botonDesmarcar) {
    botonDesmarcar.addEventListener("click", function () {
      estado.marcados = {};
      checkboxes().forEach(function (c) { c.checked = false; });
      guardar();
      actualizarProgreso();
    });
  }
})();
