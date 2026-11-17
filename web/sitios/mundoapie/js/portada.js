/* Mundo a Pie – portada: buscador, filtros por continente y destino al azar. */
(function () {
  "use strict";

  var input = document.getElementById("buscador");
  var form = document.getElementById("form-buscar");
  var tarjetas = Array.prototype.slice.call(document.querySelectorAll("#lista-paises .tarjeta"));
  var filtros = Array.prototype.slice.call(document.querySelectorAll(".filtro"));
  var contador = document.getElementById("contador");
  var vacio = document.getElementById("sin-resultados");
  var azar = document.getElementById("azar");
  var filtroActual = "todos";

  function normalizar(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
  }

  function aplicar() {
    var palabras = normalizar(input ? input.value : "").split(/\s+/).filter(Boolean);
    var visibles = 0;
    tarjetas.forEach(function (t) {
      var okCont = filtroActual === "todos" || t.getAttribute("data-continente") === filtroActual;
      var texto = t.getAttribute("data-texto") || "";
      var okTexto = palabras.every(function (p) { return texto.indexOf(p) !== -1; });
      var mostrar = okCont && okTexto;
      t.hidden = !mostrar;
      if (mostrar) visibles++;
    });
    if (contador) contador.textContent = visibles === 1 ? "1 país" : visibles + " países";
    if (vacio) vacio.hidden = visibles !== 0;
  }

  if (form) {
    form.addEventListener("submit", function (ev) { ev.preventDefault(); aplicar(); });
  }
  if (input) input.addEventListener("input", aplicar);

  filtros.forEach(function (boton) {
    boton.addEventListener("click", function () {
      filtroActual = boton.getAttribute("data-filtro");
      filtros.forEach(function (b) { b.setAttribute("aria-pressed", b === boton ? "true" : "false"); });
      aplicar();
    });
  });

  if (azar) {
    azar.addEventListener("click", function () {
      var enlaces = document.querySelectorAll("#lista-paises .tarjeta__titulo a");
      if (!enlaces.length) return;
      var elegido = enlaces[Math.floor(Math.random() * enlaces.length)];
      window.location.href = elegido.getAttribute("href");
    });
  }

  aplicar();
})();
