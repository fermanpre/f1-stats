(function () {
  var boton = document.querySelector('.boton-tema');
  if (!boton) return;
  var guardado = localStorage.getItem('f1-tema');
  if (guardado) document.documentElement.setAttribute('data-theme', guardado);
  boton.addEventListener('click', function () {
    var actual = document.documentElement.getAttribute('data-theme');
    var siguiente = actual === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', siguiente);
    localStorage.setItem('f1-tema', siguiente);
  });
})();

(function () {
  var botones = document.querySelectorAll('.opcion-idioma');
  if (!botones.length) return;
  function aplicarIdioma(idioma) {
    document.documentElement.setAttribute('data-lang', idioma);
    document.querySelectorAll('[data-placeholder-es]').forEach(function (campo) {
      var atributo = idioma === 'en' || idioma === 'fr' ? 'data-placeholder-' + idioma : 'data-placeholder-es';
      campo.setAttribute('placeholder', campo.getAttribute(atributo));
    });
    botones.forEach(function (boton) {
      boton.classList.toggle('activa', boton.getAttribute('data-lang-opcion') === idioma);
    });
  }
  var guardado = localStorage.getItem('f1-idioma') || 'en';
  aplicarIdioma(guardado);
  botones.forEach(function (boton) {
    boton.addEventListener('click', function () {
      var idioma = boton.getAttribute('data-lang-opcion');
      localStorage.setItem('f1-idioma', idioma);
      aplicarIdioma(idioma);
    });
  });
})();

(function () {
  var botones = document.querySelectorAll('.opcion-vista-indice');
  if (!botones.length) return;
  function aplicarVista(vista) {
    document.documentElement.setAttribute('data-vista-indice', vista);
    botones.forEach(function (boton) {
      boton.classList.toggle('activa', boton.getAttribute('data-vista-opcion') === vista);
    });
  }
  var guardado = localStorage.getItem('f1-vista-indice') || 'tarjetas';
  aplicarVista(guardado);
  botones.forEach(function (boton) {
    boton.addEventListener('click', function () {
      var vista = boton.getAttribute('data-vista-opcion');
      localStorage.setItem('f1-vista-indice', vista);
      aplicarVista(vista);
    });
  });
})();

(function () {
  var filtro = document.querySelector('.filtro input');
  if (!filtro) return;
  filtro.addEventListener('input', function () {
    var termino = filtro.value.trim().toLowerCase();
    document.querySelectorAll('table.filtrable tbody tr').forEach(function (fila) {
      fila.style.display = fila.textContent.toLowerCase().includes(termino) ? '' : 'none';
    });
  });
})();

(function () {
  var svg = document.getElementById('grafico-vueltas-svg');
  var elementoDatos = document.getElementById('datos-vueltas-json');
  var figura = document.querySelector('.grafico-piloto');
  var tooltip = document.getElementById('tooltip-grafico');
  if (!svg || !elementoDatos) return;
  var datosPilotos = JSON.parse(elementoDatos.textContent);
  var tituloGrafico = document.getElementById('titulo-grafico-piloto');
  var botonesRecorte = document.querySelectorAll('.opcion-recorte-grafico');
  var CATEGORIAS_RECORTE_TODAS = ['boxes', 'safety_car', 'vsc', 'bandera_roja'];
  var categoriasRecorte = new Set();
  var pilotoActual = null;

  // Tooltip propio en vez de <title> nativo de SVG: el nativo tarda casi un
  // segundo en aparecer (y en algunos navegadores no llega a mostrarse), asi
  // que aqui se dibuja al instante con un div posicionado junto al cursor,
  // via delegacion de eventos en el <svg> (los puntos se regeneran en cada
  // dibujarGrafico, delegar evita tener que re-enganchar listeners cada vez).
  if (tooltip) {
    svg.addEventListener('mousemove', function (evento) {
      var objetivo = evento.target;
      var texto = objetivo.getAttribute && objetivo.getAttribute('data-tooltip');
      if (!texto) {
        tooltip.classList.add('oculto');
        return;
      }
      tooltip.textContent = texto;
      tooltip.style.left = (evento.clientX + 14) + 'px';
      tooltip.style.top = (evento.clientY + 14) + 'px';
      tooltip.classList.remove('oculto');
    });
    svg.addEventListener('mouseleave', function () {
      tooltip.classList.add('oculto');
    });
  }

  function formatearTiempoJs(segundos) {
    var minutos = Math.floor(segundos / 60);
    var seg = segundos - minutos * 60;
    var segTexto = seg.toFixed(3);
    if (seg < 10) { segTexto = '0' + segTexto; }
    return minutos + ':' + segTexto;
  }

  function estaExcluidoPorFiltro(punto) {
    // punto = [vuelta, tiempo, boxes, safety_car, vsc, bandera_roja] (ver
    // datos_grafico en generar_paginas.py). Una vuelta puede pertenecer a
    // mas de una categoria a la vez (p.ej. una parada en boxes durante un
    // VSC) - basta con que UNA de sus categorias este marcada para
    // recortar.
    return (categoriasRecorte.has('boxes') && punto[2])
      || (categoriasRecorte.has('safety_car') && punto[3])
      || (categoriasRecorte.has('vsc') && punto[4])
      || (categoriasRecorte.has('bandera_roja') && punto[5]);
  }

  function categoriasDePunto(punto) {
    var claves = [];
    if (punto[2]) claves.push('boxes');
    if (punto[3]) claves.push('safety_car');
    if (punto[4]) claves.push('vsc');
    if (punto[5]) claves.push('bandera_roja');
    return claves;
  }

  function dibujarGrafico(numero) {
    var piloto = datosPilotos[numero];
    if (!piloto) return;
    pilotoActual = numero;
    if (figura) { figura.classList.remove('oculto'); }
    var puntos = piloto.vueltas;
    var vueltasNums = puntos.map(function (p) { return p[0]; });
    var tiempos = puntos.map(function (p) { return p[1]; });
    var vMin = Math.min.apply(null, vueltasNums);
    var vMax = Math.max.apply(null, vueltasNums);
    var tMin = Math.min.apply(null, tiempos);
    var tMaxReal = Math.max.apply(null, tiempos);
    if (vMin === vMax) { vMax = vMin + 1; }

    var puntosIncluidos = puntos.filter(function (p) { return !estaExcluidoPorFiltro(p); });
    var tiemposIncluidos = puntosIncluidos.map(function (p) { return p[1]; });
    var hayRecorte = categoriasRecorte.size > 0 && tiemposIncluidos.length > 0 && tiemposIncluidos.length < puntos.length;
    // Techo = la vuelta mas lenta que NO pertenece a ninguna categoria
    // actualmente marcada para recortar, con un 3% de margen - las vueltas
    // de esas categorias se dibujan fuera de escala arriba en vez de
    // desaparecer del grafico.
    var tMax = hayRecorte ? Math.max.apply(null, tiemposIncluidos) * 1.03 : tMaxReal;
    if (tMin === tMax) { tMax = tMin + 1; }

    var izq = 46, der = 10, arr = hayRecorte ? 24 : 10, abj = 28;
    var anchoTotal = 640, altoTotal = 220;
    var anchoPlot = anchoTotal - izq - der;
    var altoPlot = altoTotal - arr - abj;

    function x(vuelta) { return izq + (vuelta - vMin) / (vMax - vMin) * anchoPlot; }
    function y(tiempo) { return arr + (1 - (tiempo - tMin) / (tMax - tMin)) * altoPlot; }
    function yRecortada(tiempo) { return Math.max(arr + 6, y(tiempo)); }

    var idioma = document.documentElement.getAttribute('data-lang') || 'en';
    var puntosSvg = puntos.map(function (p) { return x(p[0]).toFixed(1) + ',' + yRecortada(p[1]).toFixed(1); }).join(' ');

    var svgInterno = '';
    var numTicksY = 4;
    for (var i = 0; i <= numTicksY; i++) {
      var valor = tMin + (tMax - tMin) * i / numTicksY;
      var yy = y(valor).toFixed(1);
      svgInterno += '<line x1="' + izq + '" x2="' + (anchoTotal - der) + '" y1="' + yy + '" y2="' + yy + '" class="grafico-gridline"></line>';
      svgInterno += '<text x="' + (izq - 6) + '" y="' + yy + '" class="grafico-etiqueta" text-anchor="end" dominant-baseline="middle">' + valor.toFixed(1) + '</text>';
    }

    var pasoX = (vMax - vMin) > 30 ? 5 : ((vMax - vMin) > 15 ? 2 : 1);
    for (var v = vMin; v <= vMax; v += pasoX) {
      svgInterno += '<text x="' + x(v).toFixed(1) + '" y="' + (altoTotal - 8) + '" class="grafico-etiqueta" text-anchor="middle">' + v + '</text>';
    }

    var etiquetasEjeX = { es: 'Vuelta', en: 'Lap', fr: 'Tour' };
    var etiquetasEjeY = { es: 'Segundos', en: 'Seconds', fr: 'Secondes' };
    var etiquetasVuelta = { es: 'Vuelta ', en: 'Lap ', fr: 'Tour ' };
    var etiquetasCategoria = {
      es: { boxes: 'boxes', safety_car: 'Safety Car', vsc: 'VSC', bandera_roja: 'bandera roja' },
      en: { boxes: 'pit stop', safety_car: 'Safety Car', vsc: 'VSC', bandera_roja: 'red flag' },
      fr: { boxes: 'stands', safety_car: 'Safety Car', vsc: 'VSC', bandera_roja: 'drapeau rouge' }
    };
    var etiquetaEjeX = etiquetasEjeX[idioma] || etiquetasEjeX.en;
    var etiquetaEjeY = etiquetasEjeY[idioma] || etiquetasEjeY.en;
    var etiquetaVuelta = etiquetasVuelta[idioma] || etiquetasVuelta.en;
    var etiquetasCategoriaIdioma = etiquetasCategoria[idioma] || etiquetasCategoria.en;
    var ejeYx = izq - 34, ejeYy = arr + altoPlot / 2;

    svgInterno += '<polyline points="' + puntosSvg + '" class="grafico-linea"></polyline>';

    puntos.forEach(function (p) {
      var esRecortado = hayRecorte && p[1] > tMax;
      var px = x(p[0]).toFixed(1);
      var py = yRecortada(p[1]).toFixed(1);
      var clase = esRecortado ? 'grafico-punto-recortado' : 'grafico-punto';
      var radio = esRecortado ? 3 : 2.5;
      var claves = categoriasDePunto(p);
      var sufijoCategoria = claves.length
        ? ' (' + claves.map(function (c) { return etiquetasCategoriaIdioma[c]; }).join(', ') + ')'
        : '';
      var textoTooltip = etiquetaVuelta + p[0] + ': ' + formatearTiempoJs(p[1]) + sufijoCategoria;
      svgInterno += '<circle cx="' + px + '" cy="' + py + '" r="' + radio + '" class="' + clase + '" data-tooltip="' + textoTooltip + '"></circle>';
    });

    if (hayRecorte) {
      var ultimoLabelX = -Infinity;
      puntos.forEach(function (p) {
        if (p[1] > tMax) {
          var pxLabel = x(p[0]);
          // Si el siguiente pico queda demasiado cerca en horizontal del
          // anterior, se omite su etiqueta de texto (el punto y su tooltip
          // al pasar el ratón siguen mostrando el valor exacto) para que no
          // se solapen dos números.
          if (pxLabel - ultimoLabelX > 20) {
            svgInterno += '<text x="' + pxLabel.toFixed(1) + '" y="' + (arr - 4) + '" class="grafico-etiqueta-recorte" text-anchor="middle">' + p[1].toFixed(1) + '</text>';
            ultimoLabelX = pxLabel;
          }
        }
      });
      svgInterno += '<line x1="' + (izq - 5) + '" x2="' + (izq + 3) + '" y1="' + (arr + 10) + '" y2="' + (arr + 4) + '" class="grafico-quiebre-eje"></line>';
      svgInterno += '<line x1="' + (izq - 5) + '" x2="' + (izq + 3) + '" y1="' + (arr + 15) + '" y2="' + (arr + 9) + '" class="grafico-quiebre-eje"></line>';
    }

    svgInterno += '<text x="' + ejeYx + '" y="' + ejeYy + '" class="grafico-etiqueta-eje" transform="rotate(-90 ' + ejeYx + ' ' + ejeYy + ')" text-anchor="middle">' + etiquetaEjeY + '</text>';
    svgInterno += '<text x="' + (izq + anchoPlot / 2) + '" y="' + (altoTotal - 1) + '" class="grafico-etiqueta-eje" text-anchor="middle">' + etiquetaEjeX + '</text>';
    svg.innerHTML = svgInterno;

    if (tituloGrafico) {
      tituloGrafico.textContent = piloto.codigo + ' \u00b7 ' + piloto.nombre + (piloto.equipo ? ' \u00b7 ' + piloto.equipo : '');
    }

    document.querySelectorAll('tr[data-driver]').forEach(function (fila) {
      fila.classList.toggle('seleccionada', fila.getAttribute('data-driver') === String(numero));
    });
  }

  document.querySelectorAll('.nombre-piloto-clicable').forEach(function (enlace) {
    enlace.addEventListener('click', function (evento) {
      evento.preventDefault();
      dibujarGrafico(enlace.getAttribute('data-driver'));
    });
  });

  document.querySelectorAll('.opcion-idioma').forEach(function (boton) {
    boton.addEventListener('click', function () {
      if (pilotoActual !== null) dibujarGrafico(pilotoActual);
    });
  });

  function actualizarBotonesRecorte() {
    botonesRecorte.forEach(function (boton) {
      var categoria = boton.getAttribute('data-categoria');
      var activa = categoria === 'todas'
        ? CATEGORIAS_RECORTE_TODAS.every(function (c) { return categoriasRecorte.has(c); })
        : categoriasRecorte.has(categoria);
      boton.classList.toggle('activo', activa);
    });
  }

  botonesRecorte.forEach(function (boton) {
    boton.addEventListener('click', function () {
      var categoria = boton.getAttribute('data-categoria');
      if (categoria === 'todas') {
        var todasActivas = CATEGORIAS_RECORTE_TODAS.every(function (c) { return categoriasRecorte.has(c); });
        CATEGORIAS_RECORTE_TODAS.forEach(function (c) {
          if (todasActivas) { categoriasRecorte.delete(c); } else { categoriasRecorte.add(c); }
        });
      } else if (categoriasRecorte.has(categoria)) {
        categoriasRecorte.delete(categoria);
      } else {
        categoriasRecorte.add(categoria);
      }
      actualizarBotonesRecorte();
      if (pilotoActual !== null) dibujarGrafico(pilotoActual);
    });
  });
})();