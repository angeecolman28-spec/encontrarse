(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;
  var PENDING = "PENDIENTE";

  /* disponibilidad: se llena mas abajo, pero el formulario ya la consulta */
  var DISPO = null;
  var alDisponer = [];

  window.addEventListener("load", function () {
    document.body.classList.add("loaded");
    setTimeout(function () {
      document.body.classList.add("booted");
    }, 160);
  });

  /* ------------------------------------------------ header y progreso */

  var header = document.querySelector(".header");
  var scrollProgress = document.getElementById("scrollProgress");
  var fab = document.getElementById("waFab");

  function onScrollHeader() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 24);
    if (scrollProgress) {
      var height = document.documentElement.scrollHeight - window.innerHeight;
      var pct = height > 0 ? window.scrollY / height : 0;
      scrollProgress.style.transform = "scaleX(" + pct.toFixed(4) + ")";
    }
    if (fab) {
      fab.classList.toggle("is-in", window.scrollY > window.innerHeight * 0.6 && fabTapado === 0);
    }
  }

  /* El boton flotante se esconde donde ya hay un WhatsApp a mano (bloque de
     reserva, formulario, pie): ahi sobraba y tapaba botones y enlaces. */
  var fabTapado = 0;
  if (fab && "IntersectionObserver" in window) {
    var fabIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var antes = entry.target.getAttribute("data-fab-tapa") === "1";
        if (entry.isIntersecting === antes) return;
        entry.target.setAttribute("data-fab-tapa", entry.isIntersecting ? "1" : "0");
        fabTapado += entry.isIntersecting ? 1 : -1;
      });
      onScrollHeader();
    }, { rootMargin: "0px 0px -80px 0px" });
    document.querySelectorAll(".book, .quote, .footer").forEach(function (el) {
      fabIO.observe(el);
    });
  }

  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  /* ------------------------------------------------------ menu movil */

  var burger = document.querySelector(".burger");
  var overlay = document.getElementById("overlayMenu");
  if (burger && overlay) {
    var menuMain = document.querySelector("main");
    var menuFoot = document.querySelector(".footer");

    var isMenuOpen = function () {
      return document.body.classList.contains("menu-open");
    };

    /* con el menu abierto, lo de atras no se puede tabular ni leer */
    var setBackground = function (off) {
      [menuMain, menuFoot].forEach(function (el) {
        if (!el) return;
        if (off) {
          el.setAttribute("inert", "");
          el.setAttribute("aria-hidden", "true");
        } else {
          el.removeAttribute("inert");
          el.removeAttribute("aria-hidden");
        }
      });
    };

    var openMenu = function () {
      document.body.classList.add("menu-open");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Cerrar menú");
      setBackground(true);
      var first = overlay.querySelector("a");
      if (first) first.focus();
    };

    var closeMenu = function (returnFocus) {
      if (!isMenuOpen()) return;
      document.body.classList.remove("menu-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Abrir menú");
      setBackground(false);
      if (returnFocus) burger.focus();
    };

    burger.addEventListener("click", function () {
      if (isMenuOpen()) {
        closeMenu(true);
      } else {
        openMenu();
      }
    });

    overlay.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu(false);
    });

    window.addEventListener("keydown", function (event) {
      if (!isMenuOpen()) return;
      if (event.key === "Escape") {
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab") return;
      /* el foco circula entre el boton de cerrar y los links del menu */
      var focusables = [burger].concat(Array.prototype.slice.call(overlay.querySelectorAll("a")));
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (focusables.indexOf(document.activeElement) === -1) {
        event.preventDefault();
        first.focus();
      }
    });

    /* si se agranda la ventana con el menu abierto, se cierra solo */
    var wide = window.matchMedia("(min-width: 921px)");
    var onWide = function () {
      if (wide.matches) closeMenu(false);
    };
    if (wide.addEventListener) {
      wide.addEventListener("change", onWide);
    } else if (wide.addListener) {
      wide.addListener(onWide);
    }
  }

  /* --------------------------------------- seccion actual en el menu */

  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav a[href^="#"], .overlay-nav a[href^="#"]')
  );
  if (navLinks.length) {
    var spyTargets = [];
    navLinks.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el && !spyTargets.some(function (t) { return t.id === id; })) {
        spyTargets.push({ id: id, el: el });
      }
    });
    /* las fichas de casas cuentan como parte de "Las casas" */
    var housesBlock = document.querySelector(".houses");
    if (housesBlock && spyTargets.some(function (t) { return t.id === "casas"; })) {
      spyTargets.push({ id: "casas", el: housesBlock });
    }

    var spyCurrent;
    var spyTick = false;
    /* la seccion actual es la que cruza la linea al 40% de la pantalla */
    var updateSpy = function () {
      spyTick = false;
      var line = window.innerHeight * 0.4;
      var current = null;
      spyTargets.forEach(function (t) {
        var r = t.el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) current = t.id;
      });
      if (current === spyCurrent) return;
      spyCurrent = current;
      navLinks.forEach(function (a) {
        if (a.getAttribute("href") === "#" + current) {
          a.setAttribute("aria-current", "true");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    };
    window.addEventListener(
      "scroll",
      function () {
        if (spyTick) return;
        spyTick = true;
        requestAnimationFrame(updateSpy);
      },
      { passive: true }
    );
    window.addEventListener("resize", updateSpy);
    window.addEventListener("load", updateSpy);
    updateSpy();
  }

  /* --------------------------------------------------------- reveals */

  var revealIO = null;

  function setupReveals() {
    var items = document.querySelectorAll("[data-reveal]");
    items.forEach(function (el) {
      var delay = el.getAttribute("data-delay");
      if (delay) el.style.setProperty("--d", delay);
    });
    if (prefersReduced || !hasIO) {
      items.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    revealIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            revealIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach(function (el) {
      revealIO.observe(el);
    });
  }
  setupReveals();

  /* -------------------------------------------------- carga de fotos */

  var imgIO = null;

  function markLoaded(img) {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add("is-loaded");
      return true;
    }
    img.addEventListener("load", function () {
      img.classList.add("is-loaded");
    });
    img.addEventListener("error", function () {
      img.classList.add("is-loaded");
    });
    return false;
  }

  function setupImages() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll(".frame--media img"));
    if (prefersReduced || !hasIO) {
      imgs.forEach(function (img) {
        img.classList.add("is-loaded");
      });
      return;
    }
    imgIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (markLoaded(entry.target)) imgIO.unobserve(entry.target);
        });
      },
      { rootMargin: "200px 0px" }
    );
    imgs.forEach(function (img) {
      imgIO.observe(img);
    });
  }
  setupImages();

  /* ------------------------------------------------ contadores specs */

  /* El HTML trae el valor real (sin JS, lectores de pantalla y buscadores).
     Solo si se va a animar se pone en cero, y cuenta al entrar en pantalla. */
  if (hasIO && !prefersReduced) {
    document.querySelectorAll(".spec-count").forEach(function (el) {
      el.textContent = "0" + (el.getAttribute("data-suffix") || "");
    });
  }

  function animateSpec(el) {
    if (el.getAttribute("data-done") === "1") return;
    el.setAttribute("data-done", "1");
    var target = parseInt(el.getAttribute("data-to"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (prefersReduced) {
      el.textContent = target + suffix;
      return;
    }
    var start = null;
    var dur = 1400;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var specIO = null;
  if (hasIO) {
    specIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          specIO.unobserve(entry.target);
          animateSpec(entry.target);
        });
      },
      { threshold: 0.4 }
    );
    document.querySelectorAll(".spec-count").forEach(function (el) {
      specIO.observe(el);
    });
  } else {
    document.querySelectorAll(".spec-count").forEach(animateSpec);
  }

  /* ==================================================================
     Casas: una visible por vez, pero con URL propia y compartible.
     ================================================================== */

  var panels = Array.prototype.slice.call(document.querySelectorAll(".house-panel"));
  var houseIds = panels.map(function (p) {
    return p.id;
  });
  var switchLinks = Array.prototype.slice.call(
    document.querySelectorAll("[data-house-switch] a[data-house]")
  );
  var cardLinks = Array.prototype.slice.call(
    document.querySelectorAll("[data-casas-grid] a[data-house]")
  );

  /* Al mostrar un panel que estaba oculto, los observers nunca lo vieron:
     hay que revelar el contenido y disparar los contadores a mano. */
  function activatePanel(panel) {
    panel.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("in");
      if (revealIO) revealIO.unobserve(el);
    });
    panel.querySelectorAll(".frame--media img").forEach(function (img) {
      if (markLoaded(img) && imgIO) imgIO.unobserve(img);
    });
    /* Se vuelven a observar para que cuenten al entrar en pantalla,
       no al mostrarse el panel: animateSpec ya trae su propio candado. */
    panel.querySelectorAll(".spec-count").forEach(function (el) {
      if (specIO) {
        specIO.unobserve(el);
        specIO.observe(el);
      } else {
        animateSpec(el);
      }
    });
    var gal = panel.querySelector("[data-gallery]");
    if (gal && gal.syncGallery) gal.syncGallery();
  }

  function showHouse(id) {
    if (houseIds.indexOf(id) === -1) return false;
    panels.forEach(function (panel) {
      var on = panel.id === id;
      panel.classList.toggle("active", on);
      if (on) activatePanel(panel);
    });
    switchLinks.forEach(function (a) {
      var on = a.getAttribute("data-house") === id;
      a.classList.toggle("is-on", on);
      /* con siete casas la barra se desliza en el celular: la pestaña
         activa se centra (solo en horizontal, sin mover la pagina) */
      if (on && a.parentNode.scrollWidth > a.parentNode.clientWidth) {
        var nav = a.parentNode;
        var rNav = nav.getBoundingClientRect();
        var rA = a.getBoundingClientRect();
        nav.scrollLeft += rA.left - rNav.left - (rNav.width - rA.width) / 2;
      }
    });
    return true;
  }

  function syncFromHash(scrollToIt) {
    var id = (location.hash || "").replace("#", "");
    if (!id || houseIds.indexOf(id) === -1) return;
    showHouse(id);
    /* Al entrar por un link directo el panel estaba oculto, asi que el
       navegador no pudo desplazarse solo. Ademas Chrome restaura la posicion
       anterior al terminar de cargar, asi que hay que repetirlo despues. */
    if (scrollToIt === true) {
      var panel = document.getElementById(id);
      if (!panel) return;
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      var jump = function () {
        panel.scrollIntoView({ behavior: "instant", block: "start" });
      };
      requestAnimationFrame(jump);
      window.addEventListener("load", function () {
        requestAnimationFrame(jump);
      });
    }
  }

  function goToHouse(id) {
    if (!showHouse(id)) return;
    if (location.hash !== "#" + id) {
      if (window.history && history.pushState) {
        history.pushState(null, "", "#" + id);
      } else {
        location.hash = id;
      }
    }
    var panel = document.getElementById(id);
    if (panel) {
      panel.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth", block: "start" });
    }
  }

  switchLinks.concat(cardLinks).forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.getAttribute("data-house");
      if (!id || houseIds.indexOf(id) === -1) return;
      event.preventDefault();
      goToHouse(id);
    });
  });

  window.addEventListener("hashchange", function () {
    syncFromHash(false);
  });
  window.addEventListener("popstate", function () {
    syncFromHash(false);
  });
  syncFromHash(true);

  /* ------------------------------------------------------- galerias */

  document.querySelectorAll("[data-gallery]").forEach(function (gal) {
    var track = gal.querySelector("[data-gallery-track]");
    var nav = gal.querySelector("[data-gallery-nav]");
    if (!track || !nav) return;

    var items = Array.prototype.slice.call(track.children);
    if (items.length < 2) return;

    var dots = Array.prototype.slice.call(nav.querySelectorAll(".gallery-dot"));
    var arrows = Array.prototype.slice.call(nav.querySelectorAll(".gallery-arrow"));
    nav.hidden = false;

    function current() {
      var mid = track.scrollLeft + track.clientWidth / 2;
      var best = 0;
      var bestDist = Infinity;
      items.forEach(function (item, i) {
        var center = item.offsetLeft + item.offsetWidth / 2;
        var dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    }

    function sync() {
      var i = current();
      dots.forEach(function (d, j) {
        d.classList.toggle("is-on", j === i);
      });
      arrows.forEach(function (a) {
        var dir = parseInt(a.getAttribute("data-dir"), 10);
        a.disabled = dir < 0 ? i === 0 : i === items.length - 1;
      });
    }

    function goTo(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      var item = items[i];
      track.scrollTo({
        left: item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2,
        behavior: prefersReduced ? "instant" : "smooth"
      });
    }

    dots.forEach(function (d) {
      d.addEventListener("click", function () {
        goTo(parseInt(d.getAttribute("data-go"), 10));
      });
    });

    arrows.forEach(function (a) {
      a.addEventListener("click", function () {
        goTo(current() + parseInt(a.getAttribute("data-dir"), 10));
      });
    });

    var raf = null;
    track.addEventListener(
      "scroll",
      function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          sync();
          raf = null;
        });
      },
      { passive: true }
    );
    window.addEventListener("resize", sync);

    gal.syncGallery = sync;
    sync();
  });

  /* ------------------------------------ reputacion: Airbnb y Booking

     Cada ficha tiene data-score="4.92|47" (puntaje|cantidad de resenas) y
     data-url con el enlace al anuncio. Mientras digan PENDIENTE no se
     muestran: nunca se inventa un puntaje. */

  var NOMBRE_PLATAFORMA = { airbnb: "Airbnb", booking: "Booking.com" };

  function textoResenas(cantidad, fuente) {
    var etiqueta = NOMBRE_PLATAFORMA[fuente] || fuente;
    if (!cantidad) return etiqueta;
    var n = parseInt(cantidad, 10);
    if (!isFinite(n)) return etiqueta + " · " + cantidad;
    /* en Booking se llaman comentarios; en Airbnb, resenas */
    var palabra = fuente === "booking"
      ? (n === 1 ? " comentario" : " comentarios")
      : (n === 1 ? " reseña" : " reseñas");
    return etiqueta + " · " + n + palabra;
  }

  function armarChip(el) {
    var score = (el.getAttribute("data-score") || "").trim();
    var url = (el.getAttribute("data-url") || "").trim();
    var hayScore = score && score !== PENDING;
    var hayUrl = url && url !== PENDING;
    /* con puntaje o con enlace alcanza: sin ninguno de los dos no se muestra */
    if (!hayScore && !hayUrl) return false;

    var partes = score.split("|");
    var fuente = el.getAttribute("data-rep") || el.getAttribute("data-rep-badge") || "";

    el.textContent = "";
    if (hayScore) {
      var puntaje = document.createElement("span");
      puntaje.className = "rep-score";
      puntaje.textContent = partes[0].trim();
      el.appendChild(puntaje);
    }

    var detalle = document.createElement("span");
    detalle.className = "rep-detalle";
    detalle.textContent = hayScore ? textoResenas(partes[1], fuente) : "Ver en " + (NOMBRE_PLATAFORMA[fuente] || fuente);
    el.appendChild(detalle);

    if (hayUrl) {
      el.setAttribute("href", url);
    } else if (el.tagName === "A") {
      el.removeAttribute("target");
      el.classList.add("rep-chip--sinlink");
    }
    el.hidden = false;
    return true;
  }

  /* fichas de cada casa */
  document.querySelectorAll("[data-rep-row]").forEach(function (fila) {
    var visibles = 0;
    fila.querySelectorAll("[data-rep]").forEach(function (chip) {
      if (armarChip(chip)) visibles++;
      else chip.remove();
    });
    if (visibles) fila.hidden = false;
  });

  /* insignias generales de la seccion de resenas */
  var insignias = 0;
  document.querySelectorAll("[data-rep-badge]").forEach(function (badge) {
    if (armarChip(badge)) insignias++;
  });

  var repSub = document.querySelector("[data-rep-sub]");
  if (repSub) {
    var texto = (repSub.getAttribute("data-rep-sub") || "").trim();
    if (texto && texto !== PENDING) {
      repSub.textContent = texto;
      repSub.hidden = false;
    }
  }

  /* opiniones: cada cita se muestra solo si dejo de decir PENDIENTE */
  var voces = document.querySelector("[data-voces]");
  if (voces) {
    voces.querySelectorAll("[data-voz]").forEach(function (voz) {
      var quote = voz.querySelector("blockquote");
      if (!quote || quote.textContent.trim() === PENDING) voz.remove();
    });
    var hayCitas = !!voces.querySelector("[data-voz]");
    if (!hayCitas) voces.hidden = true;

    var nota = document.querySelector("[data-resenas-nota]");
    if (nota) nota.hidden = hayCitas;

    /* sin citas y sin insignias no hay nada que mostrar */
    var seccion = document.getElementById("resenas");
    if (seccion && !hayCitas && !insignias) seccion.hidden = true;
  }

  /* datos estructurados del FAQ armados desde las preguntas visibles:
     una sola fuente, sin copiar cada respuesta a mano en el <head> */
  var faqItems = document.querySelectorAll(".faq-item");
  if (faqItems.length) {
    var faqData = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: Array.prototype.map.call(faqItems, function (item) {
        var summary = item.querySelector("summary");
        var body = item.querySelector(".faq-body");
        return {
          "@type": "Question",
          name: summary ? summary.textContent.trim() : "",
          acceptedAnswer: { "@type": "Answer", text: body ? body.textContent.trim() : "" }
        };
      })
    };
    var faqLd = document.createElement("script");
    faqLd.type = "application/ld+json";
    faqLd.textContent = JSON.stringify(faqData);
    document.head.appendChild(faqLd);
  }

  /* anfitrion: la tarjeta aparece cuando el nombre deja de decir PENDIENTE */
  var host = document.querySelector("[data-host]");
  if (host) {
    var hostName = host.querySelector("[data-host-name]");
    var hostPhoto = host.querySelector("[data-host-photo]");
    if (hostName && hostName.textContent.trim() !== PENDING) {
      var photoSrc = hostPhoto ? hostPhoto.getAttribute("data-src") : "";
      if (hostPhoto && photoSrc && photoSrc !== PENDING) {
        hostPhoto.src = photoSrc;
        hostPhoto.alt = hostName.textContent.trim();
      } else if (hostPhoto) {
        hostPhoto.parentNode.remove();
      }
      host.hidden = false;
    }
  }

  /* temporada: marca "Es ahora" si el mes actual esta en data-months */
  document.querySelectorAll("[data-season]").forEach(function (block) {
    var months = (block.getAttribute("data-months") || "").split(",").map(Number);
    var now = block.querySelector("[data-season-now]");
    if (now && months.indexOf(new Date().getMonth() + 1) !== -1) {
      now.hidden = false;
      block.classList.add("is-now");
    }
  });

  /* ------------------------------------------- consulta con estimado */

  var quote = document.getElementById("quote");
  if (quote) setupQuote(quote);

  function setupQuote(form) {
    var DAY = 86400000;
    var config = { minNoches: 2, temporadas: [] };
    try {
      var raw = document.getElementById("quote-config");
      if (raw) config = JSON.parse(raw.textContent);
    } catch (e) {}

    var fCasa = form.querySelector("#q-casa");
    var fIn = form.querySelector("#q-llegada");
    var fOut = form.querySelector("#q-salida");
    var fGuests = form.querySelector("#q-huespedes");
    var fPet = form.querySelector("#q-mascota");
    var outTotal = form.querySelector("[data-quote-total]");
    var outDetail = form.querySelector("[data-quote-detail]");
    var outWarn = form.querySelector("[data-quote-warn]");
    var waNumber = form.getAttribute("data-wa");

    /* la capacidad se lee de cada ficha: una sola fuente de datos */
    var houses = {};
    panels.forEach(function (panel) {
      var capacity = 0;
      panel.querySelectorAll(".spec").forEach(function (spec) {
        var label = spec.querySelector(".spec-label");
        var value = spec.querySelector("[data-to]");
        if (label && value && /^hu/i.test(label.textContent.trim())) {
          capacity = parseInt(value.getAttribute("data-to"), 10) || 0;
        }
      });
      houses[panel.id] = { name: panel.getAttribute("aria-label"), capacity: capacity };
    });

    function parseDate(value) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }

    function toISO(d) {
      var mm = String(d.getMonth() + 1);
      var dd = String(d.getDate());
      return d.getFullYear() + "-" + (mm.length < 2 ? "0" : "") + mm + "-" + (dd.length < 2 ? "0" : "") + dd;
    }

    function addDays(d, n) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    }

    function fmtDate(d) {
      return d.toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    }

    /* Las temporadas se escriben como "MM-DD" y pueden cruzar el año
       (26 dic al 31 ene). Sirven para avisar la estadia minima; el precio
       exacto siempre se confirma al responder la consulta. */
    function temporadaDe(d) {
      var mmdd = toISO(d).slice(5);
      var lista = config.temporadas || [];
      for (var i = 0; i < lista.length; i++) {
        var t = lista[i];
        var cruzaAnio = t.desde > t.hasta;
        var dentro = cruzaAnio
          ? (mmdd >= t.desde || mmdd <= t.hasta)
          : (mmdd >= t.desde && mmdd <= t.hasta);
        if (dentro) return t;
      }
      return null;
    }

    function today() {
      var now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    fIn.min = toISO(addDays(today(), 1));

    function read() {
      var s = {
        houseId: fCasa.value,
        house: houses[fCasa.value] || null,
        houseLabel: fCasa.options[fCasa.selectedIndex].text,
        checkIn: parseDate(fIn.value),
        checkOut: parseDate(fOut.value),
        guests: parseInt(fGuests.value, 10) || 0,
        pet: fPet.checked,
        noches: 0,
        temporadas: [],
        minReq: config.minNoches || 1,
        warn: []
      };

      if (s.checkIn && s.checkOut) {
        var count = Math.round((s.checkOut - s.checkIn) / DAY);
        if (count <= 0) {
          s.warn.push("La salida tiene que ser después de la llegada.");
        } else {
          s.noches = count;
          for (var i = 0; i < count; i++) {
            var t = temporadaDe(addDays(s.checkIn, i));
            if (!t) continue;
            s.minReq = Math.max(s.minReq, t.minNoches || 0);
            if (s.temporadas.indexOf(t.nombre) === -1) s.temporadas.push(t.nombre);
          }
          if (count < s.minReq) {
            s.warn.push(
              "Para estas fechas" + (s.temporadas.length ? " (" + s.temporadas.join(" y ") + ")" : "") +
              " la estadía mínima es de " + s.minReq + " noches."
            );
          }
        }
        if (s.checkIn < today()) s.warn.push("La fecha de llegada ya pasó.");
      }

      /* capacidad 0 = todavia sin cargar en la ficha: no se avisa nada */
      if (s.house && s.house.capacity && s.guests > s.house.capacity) {
        s.warn.push(s.house.name + " recibe hasta " + s.house.capacity + " huéspedes.");
      }
      return s;
    }

    function message(s) {
      var lines = ["¡Hola! Quisiera consultar disponibilidad en Encontrarse.", ""];
      lines.push("Casa: " + (s.house ? s.houseLabel : "cualquiera que esté libre"));
      if (s.noches) {
        lines.push("Llegada: " + fmtDate(s.checkIn));
        lines.push("Salida: " + fmtDate(s.checkOut) + " (" + s.noches + (s.noches === 1 ? " noche)" : " noches)"));
      } else {
        lines.push("Fechas: todavía flexibles");
      }
      if (s.guests) lines.push("Huéspedes: " + s.guests);
      if (s.pet) lines.push("Viajamos con mascota");
      return lines.join("\n");
    }

    function render() {
      var s = read();
      fGuests.max = s.house && s.house.capacity ? s.house.capacity : 6;

      if (!s.noches) {
        outTotal.textContent = "Elegí las fechas y te confirmamos el total.";
        outDetail.hidden = true;
      } else {
        outTotal.textContent = s.noches + (s.noches === 1 ? " noche" : " noches") +
          " · del " + fmtDate(s.checkIn) + " al " + fmtDate(s.checkOut);

        var partes = [];
        if (s.temporadas.length) partes.push(s.temporadas.join(" y "));
        if (s.house) {
          if (!conectada(s.houseId)) partes.push("consultanos la disponibilidad");
          else partes.push(hayChoque(s.houseId, fIn.value, fOut.value) ? "figura ocupada" : "figura libre");
        } else {
          var candidatas = Object.keys(houses).filter(function (id) {
            return (!s.guests || !houses[id].capacity || houses[id].capacity >= s.guests) && conectada(id);
          });
          var libres = candidatas.filter(function (id) {
            return !hayChoque(id, fIn.value, fOut.value);
          });
          partes.push(textoLibres(libres, candidatas));
        }
        outDetail.textContent = partes.join(" · ");
        outDetail.hidden = false;
      }

      var alertas = s.warn.concat(avisoDisponibilidad(s.houseId, fIn.value, fOut.value));
      outWarn.textContent = alertas.join(" ");
      outWarn.hidden = !alertas.length;

      return s;
    }

    fIn.addEventListener("change", function () {
      var checkIn = parseDate(fIn.value);
      if (!checkIn) return render();
      fOut.min = toISO(addDays(checkIn, 1));
      var checkOut = parseDate(fOut.value);
      if (!checkOut || checkOut <= checkIn) fOut.value = toISO(addDays(checkIn, config.minNoches || 2));
      render();
    });

    [fCasa, fOut, fGuests, fPet].forEach(function (el) {
      el.addEventListener("change", render);
      el.addEventListener("input", render);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var s = render();
      if (s.checkIn && s.checkOut && !s.noches) {
        fOut.focus();
        return;
      }
      var url = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(message(s));
      /* con "noopener" window.open siempre devuelve null: se corta a mano */
      var win = window.open(url, "_blank");
      if (win) {
        win.opener = null;
      } else {
        location.href = url;
      }
    });

    /* el enlace de cada ficha deja esa casa elegida */
    document.querySelectorAll("[data-quote-house]").forEach(function (link) {
      link.addEventListener("click", function () {
        fCasa.value = link.getAttribute("data-quote-house");
        render();
      });
    });

    render();
    /* al llegar la disponibilidad se vuelve a dibujar el resumen */
    alDisponer.push(render);
  }

  /* ==================================================================
     Disponibilidad: fechas ocupadas en Airbnb, Booking y la agenda
     propia. Las trae /api/disponibilidad (Worker + KV en Cloudflare);
     si esa ruta no existe todavia, usa el archivo de ejemplo.
     ================================================================== */

  var MESES_LARGOS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"
  ];
  var MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
  var DIAS = ["L", "M", "M", "J", "V", "S", "D"];

  function isoDe(d) {
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" : "") + mm + "-" + (dd.length < 2 ? "0" : "") + dd;
  }

  function isoHoy() {
    return isoDe(new Date());
  }

  function isoMas(iso, dias) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2] + dias);
    return isoDe(d);
  }

  function legible(iso) {
    var p = iso.split("-");
    return Number(p[2]) + " de " + MESES_LARGOS[Number(p[1]) - 1];
  }

  function ocupadoEn(casaId, iso) {
    if (!DISPO || !DISPO.casas[casaId]) return false;
    var rangos = DISPO.casas[casaId].ocupado || [];
    for (var i = 0; i < rangos.length; i++) {
      if (iso >= rangos[i][0] && iso <= rangos[i][1]) return true;
    }
    return false;
  }

  /* Una casa sin ningun calendario cargado no esta "libre": no sabemos nada
     de ella. Hay que distinguirla de la que si esta conectada y no tiene
     reservas, o el sitio afirmaria disponibilidad que nadie verifico. */
  function conectada(casaId) {
    var casa = DISPO && DISPO.casas ? DISPO.casas[casaId] : null;
    return !!(casa && casa.fuentes && Object.keys(casa.fuentes).length);
  }

  /* las noches ocupadas van de la llegada al dia anterior a la salida */
  function nochesOcupadas(casaId, entradaIso, salidaIso) {
    if (!DISPO || !entradaIso || !salidaIso || salidaIso <= entradaIso) return [];
    var sucias = [];
    for (var iso = entradaIso; iso < salidaIso; iso = isoMas(iso, 1)) {
      if (ocupadoEn(casaId, iso)) sucias.push(iso);
      if (sucias.length > 60) break;
    }
    return sucias;
  }

  function hayChoque(casaId, entradaIso, salidaIso) {
    return nochesOcupadas(casaId, entradaIso, salidaIso).length > 0;
  }

  function primeraLibre(casaId, desdeIso, tope) {
    var iso = desdeIso;
    for (var i = 0; i < (tope || 365); i++) {
      if (!ocupadoEn(casaId, iso)) return iso;
      iso = isoMas(iso, 1);
    }
    return null;
  }

  function textoLibres(libres, candidatas) {
    if (!DISPO || !candidatas.length) return " Elegí una para ver el detalle.";
    if (!libres.length) return " Ninguna figura libre esas fechas: escribinos igual y vemos alternativas.";
    if (libres.length === candidatas.length) return " Todas figuran libres esas fechas.";
    var nombres = libres.map(function (id) {
      return DISPO.casas[id] ? DISPO.casas[id].nombre : id;
    });
    return " Libres esas fechas: " + nombres.join(", ") + ".";
  }

  function avisoDisponibilidad(casaId, entradaIso, salidaIso) {
    if (!DISPO || !casaId || !entradaIso || !salidaIso) return [];
    var sucias = nochesOcupadas(casaId, entradaIso, salidaIso);
    if (!sucias.length) return [];
    var libre = primeraLibre(casaId, sucias[sucias.length - 1]);
    var texto = sucias.length === 1
      ? "La noche del " + legible(sucias[0]) + " figura ocupada."
      : sucias.length + " de esas noches figuran ocupadas (desde el " + legible(sucias[0]) + ").";
    if (libre) texto += " La casa se libera el " + legible(libre) + ".";
    return [texto + " Escribinos igual: coordinamos otras fechas."];
  }

  function haceCuanto(iso) {
    var minutos = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!isFinite(minutos) || minutos < 0) return "recién";
    if (minutos < 60) return "hace " + minutos + " min";
    var horas = Math.round(minutos / 60);
    if (horas < 24) return "hace " + horas + (horas === 1 ? " hora" : " horas");
    var dias = Math.round(horas / 24);
    return "hace " + dias + (dias === 1 ? " día" : " días");
  }

  /* ------------------------------------------------ calendario por casa */

  function pintarCalendario(caja, casaId, offset) {
    var hoy = isoHoy();
    var base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + offset);
    var anio = base.getFullYear();
    var mes = base.getMonth();

    caja.textContent = "";

    var head = document.createElement("div");
    head.className = "cal-head";

    var antes = document.createElement("button");
    antes.type = "button";
    antes.className = "cal-nav";
    antes.setAttribute("aria-label", "Mes anterior");
    antes.textContent = "‹";
    antes.disabled = offset === 0;
    antes.addEventListener("click", function () {
      pintarCalendario(caja, casaId, offset - 1);
    });

    var titulo = document.createElement("p");
    titulo.className = "cal-title";
    titulo.textContent = MESES_LARGOS[mes] + " " + anio;

    var luego = document.createElement("button");
    luego.type = "button";
    luego.className = "cal-nav";
    luego.setAttribute("aria-label", "Mes siguiente");
    luego.textContent = "›";
    luego.disabled = offset >= 14;
    luego.addEventListener("click", function () {
      pintarCalendario(caja, casaId, offset + 1);
    });

    head.appendChild(antes);
    head.appendChild(titulo);
    head.appendChild(luego);
    caja.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "cal-grid";
    DIAS.forEach(function (d) {
      var celda = document.createElement("span");
      celda.className = "cal-dow";
      celda.textContent = d;
      celda.setAttribute("aria-hidden", "true");
      grid.appendChild(celda);
    });

    var primero = new Date(anio, mes, 1);
    var hueco = (primero.getDay() + 6) % 7;
    for (var h = 0; h < hueco; h++) {
      var vacio = document.createElement("span");
      vacio.className = "cal-day cal-day--empty";
      grid.appendChild(vacio);
    }

    var enMes = new Date(anio, mes + 1, 0).getDate();
    var ocupadas = 0;
    for (var dia = 1; dia <= enMes; dia++) {
      var iso = isoDe(new Date(anio, mes, dia));
      var celdaDia = document.createElement("span");
      celdaDia.className = "cal-day";
      celdaDia.textContent = String(dia);
      if (iso < hoy) {
        celdaDia.classList.add("is-past");
      } else if (ocupadoEn(casaId, iso)) {
        celdaDia.classList.add("is-busy");
        celdaDia.title = "Ocupado";
        ocupadas++;
      } else {
        celdaDia.classList.add("is-free");
        celdaDia.title = "Libre";
      }
      if (iso === hoy) celdaDia.classList.add("is-today");
      grid.appendChild(celdaDia);
    }
    caja.appendChild(grid);

    var resumen = document.createElement("p");
    resumen.className = "cal-msg";
    resumen.textContent = ocupadas
      ? ocupadas + (ocupadas === 1 ? " noche ocupada" : " noches ocupadas") + " en " + MESES_LARGOS[mes]
      : "Mes completo libre";
    caja.appendChild(resumen);

    var pie = document.createElement("p");
    pie.className = "cal-foot";
    pie.textContent = DISPO.estado === "ejemplo"
      ? "Datos de ejemplo: todavía sin conectar Airbnb y Booking."
      : "Airbnb y Booking, " + haceCuanto(DISPO.actualizado) + " · se confirma por WhatsApp.";
    caja.appendChild(pie);
  }

  function pintarCalendarios() {
    document.querySelectorAll("[data-cal]").forEach(function (caja) {
      var casaId = caja.getAttribute("data-cal");
      if (!DISPO || !DISPO.casas[casaId] || !conectada(casaId)) {
        caja.textContent = "";
        var msg = document.createElement("p");
        msg.className = "cal-msg";
        msg.textContent = "Todavía sin conectar con Airbnb y Booking: escribinos y te confirmamos las fechas.";
        caja.appendChild(msg);
        return;
      }
      pintarCalendario(caja, casaId, 0);
    });
  }

  /* --------------------------------- estado en la tabla comparativa */

  function pintarChips() {
    document.querySelectorAll("[data-disp]").forEach(function (chip) {
      if (!DISPO) return;
      var casaId = chip.getAttribute("data-disp");
      if (!DISPO.casas[casaId]) return;
      if (!conectada(casaId)) {
        chip.classList.remove("disp--libre", "disp--pocas", "disp--completa");
        chip.textContent = "Consultanos las fechas";
        return;
      }

      var hoy = isoHoy();
      var sucias = 0;
      for (var i = 0; i < 30; i++) {
        if (ocupadoEn(casaId, isoMas(hoy, i))) sucias++;
      }
      chip.classList.remove("disp--libre", "disp--pocas", "disp--completa");
      if (!sucias) {
        chip.classList.add("disp--libre");
        chip.textContent = "Libre los próximos 30 días";
        return;
      }
      chip.classList.add(sucias < 20 ? "disp--pocas" : "disp--completa");
      if (ocupadoEn(casaId, hoy)) {
        var libre = primeraLibre(casaId, hoy);
        chip.textContent = libre
          ? "Ocupada hasta el " + Number(libre.split("-")[2]) + " " + MESES_CORTOS[Number(libre.split("-")[1]) - 1]
          : "Ocupada";
      } else {
        var libres30 = 30 - sucias;
        chip.textContent = "Quedan fechas · " + libres30 + (libres30 === 1 ? " noche libre" : " noches libres") + " este mes";
      }
    });
  }

  function aplicarDisponibilidad(data) {
    DISPO = data;
    pintarCalendarios();
    pintarChips();
    alDisponer.forEach(function (fn) {
      fn();
    });
  }

  (function cargarDisponibilidad() {
    var usable = function (data) {
      return data && data.casas && Object.keys(data.casas).length;
    };
    fetch("/api/disponibilidad", { headers: { accept: "application/json" } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (usable(data)) return data;
        /* todavia sin Worker conectado: se muestra el ejemplo */
        return fetch("assets/data/disponibilidad-ejemplo.json").then(function (res) {
          return res.ok ? res.json() : null;
        });
      })
      .then(function (data) {
        if (usable(data)) aplicarDisponibilidad(data);
        else pintarCalendarios();
      })
      .catch(function () {
        pintarCalendarios();
      });
  })();

  /* ---------------------------------------------------- mapa de la costa */

  /* Dos encuadres del mismo dibujo: la costa entera en escritorio y el tramo
     Punta del Diablo - Chuy en el celular, donde el mapa completo seria
     ilegible. Los rotulos de cada encuadre se alternan por CSS. */
  var mapSvg = document.querySelector(".mapa-svg");
  if (mapSvg && mapSvg.getAttribute("data-view-zoom")) {
    var viewFull = mapSvg.getAttribute("data-view-full");
    var viewZoom = mapSvg.getAttribute("data-view-zoom");
    var small = window.matchMedia("(max-width: 920px)");
    var setView = function () {
      mapSvg.setAttribute("viewBox", small.matches ? viewZoom : viewFull);
    };
    setView();
    if (small.addEventListener) {
      small.addEventListener("change", setView);
    } else if (small.addListener) {
      small.addListener(setView);
    }
  }

  /* ------------------------------------------------------- parallax */

  var parallaxSections = document.querySelectorAll("[data-parallax-section]");
  if (!prefersReduced && parallaxSections.length && hasIO) {
    var actives = new Map();
    var ticking = false;

    function applyParallax() {
      ticking = false;
      parallaxSections.forEach(function (section) {
        var el = section.querySelector("[data-parallax]");
        if (!el || !actives.get(section)) return;
        var rect = section.getBoundingClientRect();
        var depth = parseFloat(el.getAttribute("data-parallax")) || 0.18;
        var progress =
          (rect.top + rect.height / 2 - window.innerHeight / 2) /
          (window.innerHeight / 2 + rect.height / 2);
        var shift = progress * depth * rect.height;
        el.style.transform = "translate3d(0, " + shift.toFixed(1) + "px, 0)";
      });
    }

    function onScrollParallax() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyParallax);
      }
    }

    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          actives.set(entry.target, entry.isIntersecting);
          if (entry.isIntersecting) onScrollParallax();
        });
      },
      { rootMargin: "20% 0px 20% 0px" }
    );

    parallaxSections.forEach(function (section) {
      actives.set(section, false);
      sectionObserver.observe(section);
    });

    window.addEventListener("scroll", onScrollParallax, { passive: true });
    window.addEventListener("resize", onScrollParallax);
    onScrollParallax();
  }
})();
