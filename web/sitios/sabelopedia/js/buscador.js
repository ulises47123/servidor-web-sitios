/* Sabelopedia — buscador interno de la portada.
   Filtra el índice de js/datos.js por título, resumen y categoría. */
(function () {
  "use strict";

  var datos = window.SABELOPEDIA;
  var form = document.getElementById("form-busqueda");
  var input = document.getElementById("q");
  var zona = document.getElementById("resultados");
  var lista = document.getElementById("resultados-lista");
  var estado = document.getElementById("resultados-estado");
  var limpiar = document.getElementById("limpiar-busqueda");
  if (!datos || !form || !input || !zona || !lista || !estado) return;

  var categorias = {};
  datos.categorias.forEach(function (c) { categorias[c.slug] = c; });

  function normalizar(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ\s]/g, " ");
  }

  var indice = datos.articulos.map(function (a) {
    var cat = categorias[a.categoria] || { nombre: "" };
    return {
      articulo: a,
      titulo: normalizar(a.titulo),
      resumen: normalizar(a.resumen),
      categoria: normalizar(cat.nombre),
      todo: normalizar([a.titulo, a.resumen, cat.nombre, a.claves].join(" "))
    };
  });

  function buscar(consulta) {
    var terminos = normalizar(consulta).split(/\s+/).filter(function (t) { return t.length > 0; });
    if (!terminos.length) return null;
    return indice
      .filter(function (item) {
        return terminos.every(function (t) { return item.todo.indexOf(t) !== -1; });
      })
      .map(function (item) {
        var puntos = 0;
        terminos.forEach(function (t) {
          if (item.titulo.indexOf(t) !== -1) puntos += 10;
          if (item.categoria.indexOf(t) !== -1) puntos += 4;
          if (item.resumen.indexOf(t) !== -1) puntos += 2;
        });
        return { item: item, puntos: puntos };
      })
      .sort(function (x, y) {
        return y.puntos - x.puntos || x.item.articulo.titulo.localeCompare(y.item.articulo.titulo, "es");
      })
      .map(function (r) { return r.item.articulo; });
  }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }

  function mostrar(consulta) {
    var resultados = buscar(consulta);
    lista.textContent = "";
    if (resultados === null) {
      zona.hidden = true;
      estado.textContent = "";
      return;
    }
    zona.hidden = false;
    var limpia = consulta.trim();
    if (!resultados.length) {
      estado.textContent = "No encontramos artículos para «" + limpia + "».";
      var li = crear("li", "sin-resultados");
      li.appendChild(crear("p", "", "Probá con otra palabra, revisá cómo está escrita o explorá las categorías más abajo."));
      lista.appendChild(li);
      return;
    }
    estado.textContent = resultados.length === 1
      ? "1 artículo encontrado para «" + limpia + "»."
      : resultados.length + " artículos encontrados para «" + limpia + "».";
    resultados.forEach(function (a) {
      var cat = categorias[a.categoria] || { nombre: "", emoji: "" };
      var li = document.createElement("li");
      var enlace = crear("a", "resultado cat-" + a.categoria);
      enlace.href = "articulos/" + a.slug + ".html";
      var emoji = crear("span", "resultado-emoji", a.emoji);
      emoji.setAttribute("aria-hidden", "true");
      enlace.appendChild(emoji);
      enlace.appendChild(crear("span", "resultado-titulo", a.titulo));
      enlace.appendChild(crear("span", "resultado-cat", cat.nombre));
      enlace.appendChild(crear("span", "resultado-resumen", a.resumen));
      li.appendChild(enlace);
      lista.appendChild(li);
    });
  }

  function actualizarUrl(consulta) {
    try {
      var url = window.location.pathname + (consulta ? "?q=" + encodeURIComponent(consulta) : "");
      window.history.replaceState(null, "", url);
    } catch (e) { /* en algunos navegadores con file:// no se permite */ }
  }

  var espera = null;
  input.addEventListener("input", function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      mostrar(input.value);
      actualizarUrl(input.value.trim());
    }, 150);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(espera);
    mostrar(input.value);
    actualizarUrl(input.value.trim());
    if (!zona.hidden) {
      var primero = lista.querySelector("a");
      if (primero) primero.focus();
    }
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && input.value) {
      input.value = "";
      mostrar("");
      actualizarUrl("");
    }
  });

  if (limpiar) {
    limpiar.addEventListener("click", function () {
      input.value = "";
      mostrar("");
      actualizarUrl("");
      input.focus();
    });
  }

  // Búsqueda que llega desde el formulario de otras páginas (?q=...).
  var inicial = "";
  try {
    inicial = new URLSearchParams(window.location.search).get("q") || "";
  } catch (e) {
    var m = /[?&]q=([^&]*)/.exec(window.location.search);
    if (m) inicial = decodeURIComponent(m[1].replace(/\+/g, " "));
  }
  if (inicial) {
    input.value = inicial;
    mostrar(inicial);
  }
})();
