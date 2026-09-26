/**
 * Sincronizacion de calendarios
 * ---------------------------------------------------------------------------
 * Baja los iCal de cada casa (Airbnb, Booking y Google Calendar), los combina
 * en un JSON con las fechas ocupadas, lo guarda en KV y avisa por Telegram
 * cuando algo cambia. Lo llama el cron definido en wrangler.jsonc.
 *
 * Secretos que espera:
 *   FEEDS             JSON con las casas y sus calendarios
 *   TELEGRAM_TOKEN    token de @BotFather
 *   TELEGRAM_CHAT_ID  chat o grupo donde avisar
 *
 * Formato de FEEDS:
 * {
 *   "casa-la-viuda": {
 *     "nombre": "Casa La Viuda",
 *     "fuentes": {
 *       "airbnb":   "https://www.airbnb.com/calendar/ical/....ics",
 *       "booking":  "https://ical.booking.com/v1/export?t=....",
 *       "calendar": "https://calendar.google.com/calendar/ical/..../basic.ics"
 *     }
 *   }
 * }
 *
 * Claves en KV:
 *   disponibilidad  lo que lee la web (solo fechas, sin datos de huespedes)
 *   estado          uso interno: rangos por fuente y contador de fallas
 */

const KEY_PUBLICA = "disponibilidad";
const KEY_ESTADO = "estado";
const MESES_ADELANTE = 18;
const FALLAS_PARA_AVISAR = 3;
const TIMEOUT_MS = 8000;

export async function sincronizar(env) {
  const feeds = JSON.parse(env.FEEDS || "{}");
  if (!Object.keys(feeds).length) {
    return { ok: false, motivo: "falta el secreto FEEDS" };
  }

  const estado = JSON.parse((await env.DISPO.get(KEY_ESTADO)) || "{}");
  const previo = JSON.parse((await env.DISPO.get(KEY_PUBLICA)) || "null");

  const casas = {};
  const avisos = [];
  const fuentesEstado = estado.fuentes || {};

  for (const [id, casa] of Object.entries(feeds)) {
    const rangosPorFuente = {};
    const fuentes = {};

    for (const [fuente, url] of Object.entries(casa.fuentes || {})) {
      const clave = id + "|" + fuente;
      const guardado = fuentesEstado[clave] || {};
      try {
        const texto = await bajar(url);
        rangosPorFuente[fuente] = eventosDeIcal(texto);
        fuentes[fuente] = { estado: "ok", rangos: rangosPorFuente[fuente].length };
        if (guardado.fallas >= FALLAS_PARA_AVISAR) {
          avisos.push("✅ " + (casa.nombre || id) + ": el calendario de " + fuente + " volvió a responder.");
        }
        fuentesEstado[clave] = { fallas: 0, rangos: rangosPorFuente[fuente], ok: new Date().toISOString() };
      } catch (error) {
        /* si una fuente falla se reusan sus fechas anteriores: nunca se
           publica un calendario vacio que parezca "todo libre" */
        const fallas = (guardado.fallas || 0) + 1;
        rangosPorFuente[fuente] = guardado.rangos || [];
        fuentes[fuente] = { estado: "error", desde: guardado.ok || null };
        fuentesEstado[clave] = { fallas: fallas, rangos: rangosPorFuente[fuente], ok: guardado.ok || null };
        if (fallas === FALLAS_PARA_AVISAR) {
          avisos.push("⚠️ " + (casa.nombre || id) + ": el calendario de " + fuente + " no responde (" + String(error).slice(0, 80) + ").");
        }
      }
    }

    const ocupado = unir([].concat(...Object.values(rangosPorFuente)));
    casas[id] = { nombre: casa.nombre || id, ocupado: ocupado, fuentes: fuentes };
  }

  const publico = { estado: "ok", actualizado: new Date().toISOString(), casas: casas };
  await env.DISPO.put(KEY_PUBLICA, JSON.stringify(publico));
  await env.DISPO.put(KEY_ESTADO, JSON.stringify({ fuentes: fuentesEstado }));

  const cambios = diferencias(previo, publico);
  const mensajes = avisos.concat(cambios);
  if (mensajes.length) await avisar(env, mensajes.join("\n\n"));

  return { ok: true, casas: Object.keys(casas).length, cambios: cambios.length, avisos: avisos.length };
}

export async function resumenEstado(env) {
  const raw = await env.DISPO.get(KEY_PUBLICA);
  if (!raw) return { estado: "sin-datos" };
  const data = JSON.parse(raw);
  const minutos = Math.round((Date.now() - Date.parse(data.actualizado)) / 60000);
  const fuentes = {};
  for (const [id, casa] of Object.entries(data.casas || {})) {
    fuentes[id] = Object.entries(casa.fuentes || {}).map(function (f) {
      return f[0] + ":" + f[1].estado;
    }).join(" ");
  }
  return { estado: "ok", actualizado: data.actualizado, hace_minutos: minutos, fuentes: fuentes };
}

async function bajar(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "encontrarse-sync/1.0" },
    cf: { cacheTtl: 0 }
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

/* ------------------------------------------------------------------ iCal */

/* Devuelve rangos [primeraNoche, ultimaNoche] en formato YYYY-MM-DD.
   En iCal DTEND es el dia de salida, que no se duerme: por eso se resta uno. */
function eventosDeIcal(texto) {
  const lineas = desdoblar(texto);
  const rangos = [];
  let dentro = false;
  let inicio = null;
  let fin = null;
  let cancelado = false;

  for (const linea of lineas) {
    if (linea === "BEGIN:VEVENT") {
      dentro = true;
      inicio = fin = null;
      cancelado = false;
      continue;
    }
    if (!dentro) continue;
    if (linea === "END:VEVENT") {
      if (!cancelado && inicio && fin) {
        const ultima = sumarDias(fin, -1);
        if (ultima >= inicio) rangos.push([inicio, ultima]);
      }
      dentro = false;
      continue;
    }
    if (linea.startsWith("STATUS:") && linea.includes("CANCELLED")) cancelado = true;
    if (linea.startsWith("DTSTART")) inicio = fecha(linea);
    if (linea.startsWith("DTEND")) fin = fecha(linea);
  }

  const desde = sumarDias(hoy(), -1);
  const hasta = sumarMeses(hoy(), MESES_ADELANTE);
  return rangos.filter(function (r) {
    return r[1] >= desde && r[0] <= hasta;
  });
}

/* las lineas largas del iCal siguen en la siguiente, con un espacio adelante */
function desdoblar(texto) {
  return texto.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function fecha(linea) {
  const valor = linea.slice(linea.indexOf(":") + 1).trim();
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(valor);
  return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
}

/* ------------------------------------------------------------ utilidades */

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(iso, dias) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function sumarMeses(iso, meses) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
}

/* junta rangos que se pisan o que quedan pegados */
function unir(rangos) {
  const orden = rangos.slice().sort(function (a, b) {
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  const salida = [];
  for (const rango of orden) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && rango[0] <= sumarDias(ultimo[1], 1)) {
      if (rango[1] > ultimo[1]) ultimo[1] = rango[1];
    } else {
      salida.push([rango[0], rango[1]]);
    }
  }
  return salida;
}

/* --------------------------------------------------------------- avisos */

function diferencias(previo, actual) {
  if (!previo || !previo.casas) return [];
  const mensajes = [];

  for (const [id, casa] of Object.entries(actual.casas)) {
    const antes = (previo.casas[id] || {}).ocupado || [];
    const clave = function (r) { return r[0] + "/" + r[1]; };
    const antesSet = new Set(antes.map(clave));
    const ahoraSet = new Set(casa.ocupado.map(clave));

    const nuevos = casa.ocupado.filter(function (r) { return !antesSet.has(clave(r)); });
    const liberados = antes.filter(function (r) { return !ahoraSet.has(clave(r)); });

    for (const r of nuevos) {
      mensajes.push("🟢 Reservado — " + casa.nombre + "\n" + textoRango(r) + " (" + noches(r) + ")");
    }
    for (const r of liberados) {
      mensajes.push("🔵 Se liberó — " + casa.nombre + "\n" + textoRango(r) + " (" + noches(r) + ")");
    }
  }
  return mensajes;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

function textoRango(r) {
  const salida = sumarDias(r[1], 1);
  return legible(r[0]) + " al " + legible(salida);
}

function legible(iso) {
  const p = iso.split("-");
  return Number(p[2]) + " " + MESES[Number(p[1]) - 1] + " " + p[0];
}

function noches(r) {
  const dias = Math.round((Date.parse(r[1]) - Date.parse(r[0])) / 86400000) + 1;
  return dias + (dias === 1 ? " noche" : " noches");
}

async function avisar(env, texto) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch("https://api.telegram.org/bot" + env.TELEGRAM_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: texto,
        disable_web_page_preview: true
      })
    });
  } catch (e) {
    /* que un aviso falle no puede romper la sincronizacion */
  }
}
