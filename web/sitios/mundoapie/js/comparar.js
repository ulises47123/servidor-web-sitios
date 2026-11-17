/* Mundo a Pie – comparador de países. Usa los datos de js/datos.js. */
(function () {
  "use strict";

  var DATOS = window.MUNDO_A_PIE;
  var selA = document.getElementById("pais-a");
  var selB = document.getElementById("pais-b");
  var form = document.getElementById("form-comparar");
  var boton = document.getElementById("intercambiar");
  var salida = document.getElementById("resultado");
  if (!DATOS || !selA || !selB || !salida) return;

  var porSlug = {};
  DATOS.paises.forEach(function (p) { porSlug[p.slug] = p; });

  function numero(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function decimal(n) {
    var r = Math.round(n * 10) / 10;
    return r.toString().replace(".", ",");
  }

  function el(tag, clase, texto) {
    var nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
  }

  /* Leer ?a=...&b=... de la URL (funciona también abriendo el archivo local). */
  function leerParametros() {
    try {
      var params = new URLSearchParams(window.location.search);
      var a = params.get("a"), b = params.get("b");
      if (a && porSlug[a]) selA.value = a;
      if (b && porSlug[b]) selB.value = b;
      if (a && porSlug[a] && !b && selB.value === a) {
        selB.value = a === "argentina" ? "japon" : "argentina";
      }
    } catch (e) { /* sin parámetros */ }
  }

  function guardarParametros(a, b) {
    try {
      var url = window.location.pathname + "?a=" + encodeURIComponent(a) + "&b=" + encodeURIComponent(b);
      window.history.replaceState(null, "", url);
    } catch (e) { /* algunos navegadores lo bloquean en archivos locales */ }
  }

  /* Fila con dos valores; "modo" decide si se resalta el mayor. */
  function fila(titulo, valA, valB, opciones) {
    opciones = opciones || {};
    var li = el("li", "comp-fila");
    li.appendChild(el("h4", "comp-fila__titulo", titulo));
    var valores = el("div", "comp-fila__valores");
    [[valA, opciones.numA], [valB, opciones.numB]].forEach(function (par, i) {
      var caja = el("div", "comp-valor");
      caja.appendChild(el("p", null, par[0]));
      if (opciones.comparar) {
        var otro = i === 0 ? opciones.numB : opciones.numA;
        var max = Math.max(opciones.numA, opciones.numB) || 1;
        if (par[1] > otro) {
          caja.className += " comp-valor--gana";
          caja.appendChild(el("span", "insignia", opciones.insignia));
        }
        var barra = el("div", "barra");
        barra.setAttribute("aria-hidden", "true");
        var relleno = el("div", "barra__relleno");
        relleno.style.width = Math.max(2, (par[1] / max) * 100) + "%";
        barra.appendChild(relleno);
        caja.appendChild(barra);
      }
      valores.appendChild(caja);
    });
    li.appendChild(valores);
    return li;
  }

  function veces(mayor, menor) {
    var v = mayor / menor;
    if (v < 1.15) return "casi igual";
    if (v < 10) return "unas " + decimal(v) + " veces";
    return "unas " + numero(v) + " veces";
  }

  function render() {
    var a = porSlug[selA.value];
    var b = porSlug[selB.value];
    salida.textContent = "";
    if (!a || !b) return;
    guardarParametros(a.slug, b.slug);

    if (a.slug === b.slug) {
      var aviso = el("p", "vacio", "Elegiste " + a.nombre + " en los dos lados. Cambiá uno de los selectores para comparar.");
      salida.appendChild(aviso);
      return;
    }

    /* Cabecera con enlaces a cada guía */
    var cab = el("div", "comp-cabecera");
    [a, b].forEach(function (p) {
      var col = el("div");
      var h = el("h3");
      var link = el("a", null, p.nombre);
      link.href = "paises/" + p.slug + ".html";
      h.appendChild(link);
      col.appendChild(h);
      col.appendChild(el("p", null, DATOS.continentes[p.continente]));
      cab.appendChild(col);
    });
    salida.appendChild(cab);

    var densA = a.poblacion / a.superficie;
    var densB = b.poblacion / b.superficie;
    var lista = el("ul", "comp-lista");
    var supA = numero(a.superficie) + " km²" + (a.superficie_nota ? " (" + a.superficie_nota + ")" : "");
    var supB = numero(b.superficie) + " km²" + (b.superficie_nota ? " (" + b.superficie_nota + ")" : "");

    lista.appendChild(fila("Capital", a.capital, b.capital));
    lista.appendChild(fila("Población", a.poblacion_txt + " de habitantes", b.poblacion_txt + " de habitantes",
      { comparar: true, numA: a.poblacion, numB: b.poblacion, insignia: "Más poblado" }));
    lista.appendChild(fila("Superficie", supA, supB,
      { comparar: true, numA: a.superficie, numB: b.superficie, insignia: "Más grande" }));
    lista.appendChild(fila("Densidad", decimal(densA) + " hab./km²", decimal(densB) + " hab./km²",
      { comparar: true, numA: densA, numB: densB, insignia: "Más denso" }));
    lista.appendChild(fila("Idioma(s)", a.idiomas, b.idiomas));
    lista.appendChild(fila("Moneda", a.moneda, b.moneda));
    lista.appendChild(fila("Huso horario", a.huso, b.huso));
    lista.appendChild(fila("Se maneja", a.conduccion.toLowerCase(), b.conduccion.toLowerCase()));
    lista.appendChild(fila("Mejor época para viajar", a.epoca, b.epoca));
    lista.appendChild(fila("Clima", a.clima, b.clima));
    lista.appendChild(fila("Enchufes y voltaje", a.enchufes, b.enchufes));
    lista.appendChild(fila("Propinas", a.propinas, b.propinas));
    salida.appendChild(lista);

    /* Resumen en palabras */
    var resumen = el("div", "caja caja--destacada comp-resumen");
    resumen.appendChild(el("h3", null, "En resumen"));
    var ul = el("ul");
    var grande = a.superficie >= b.superficie ? a : b;
    var chico = grande === a ? b : a;
    var vSup = veces(grande.superficie, chico.superficie);
    ul.appendChild(el("li", null, vSup === "casi igual"
      ? a.nombre + " y " + b.nombre + " tienen una superficie parecida."
      : grande.nombre + " es " + vSup + " más grande que " + chico.nombre + "."));

    var poblado = a.poblacion >= b.poblacion ? a : b;
    var menos = poblado === a ? b : a;
    var vPob = veces(poblado.poblacion, menos.poblacion);
    ul.appendChild(el("li", null, vPob === "casi igual"
      ? "Tienen una población parecida."
      : poblado.nombre + " tiene " + vPob + " más habitantes que " + menos.nombre + "."));

    var dif = Math.abs(a.utc - b.utc);
    var adelante = a.utc > b.utc ? a : b;
    ul.appendChild(el("li", null, dif === 0
      ? "Sus capitales comparten la misma hora (sin contar el horario de verano)."
      : "Entre " + a.capital + " y " + b.capital + " hay " + dif + (dif === 1 ? " hora" : " horas") +
        " de diferencia: en " + adelante.capital + " es más tarde (sin contar el horario de verano)."));

    ul.appendChild(el("li", null, a.moneda === b.moneda
      ? "Los dos usan la misma moneda: " + a.moneda + "."
      : "Usan monedas distintas: vas a necesitar " + a.moneda.split(" (")[0].toLowerCase() + " y " + b.moneda.split(" (")[0].toLowerCase() + "."));

    if (a.conduccion !== b.conduccion) {
      ul.appendChild(el("li", null, "Atención si manejás: en " + a.nombre + " se circula " +
        a.conduccion.toLowerCase() + " y en " + b.nombre + " " + b.conduccion.toLowerCase() + "."));
    }
    resumen.appendChild(ul);
    salida.appendChild(resumen);
  }

  if (form) form.addEventListener("submit", function (ev) { ev.preventDefault(); render(); });
  selA.addEventListener("change", render);
  selB.addEventListener("change", render);
  if (boton) {
    boton.addEventListener("click", function () {
      var tmp = selA.value;
      selA.value = selB.value;
      selB.value = tmp;
      render();
    });
  }

  leerParametros();
  render();
})();
