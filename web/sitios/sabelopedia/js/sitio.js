/* Sabelopedia — comportamiento común a todas las páginas. */
(function () {
  "use strict";

  var datos = window.SABELOPEDIA;
  var raiz = document.body.getAttribute("data-raiz") || "";
  var actual = document.body.getAttribute("data-articulo") || "";

  // "Artículo al azar": elige un artículo distinto del actual.
  function articuloAlAzar() {
    var lista = datos.articulos.filter(function (a) { return a.slug !== actual; });
    return lista[Math.floor(Math.random() * lista.length)];
  }

  if (datos && datos.articulos && datos.articulos.length) {
    var enlaces = document.querySelectorAll("[data-azar]");
    Array.prototype.forEach.call(enlaces, function (el) {
      el.addEventListener("click", function (e) {
        var a = articuloAlAzar();
        if (!a) return;
        e.preventDefault();
        window.location.href = raiz + "articulos/" + a.slug + ".html";
      });
    });
  }
})();
