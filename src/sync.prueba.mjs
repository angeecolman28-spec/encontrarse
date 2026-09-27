/**
 * Prueba del parseo de calendarios
 * ---------------------------------------------------------------------------
 * Se corre a mano desde la raiz del proyecto:
 *
 *   node src/sync.prueba.mjs
 *
 * No entra en el bundle del Worker: solo lo importa este archivo, y la carpeta
 * src esta excluida en .assetsignore, asi que tampoco se publica.
 *
 * Lo que cuida: que una agenda compartida por varias casas reparta bien los
 * eventos segun el titulo, que la ultima noche sea la vispera de la salida, y
 * que un evento mal escrito se detecte en vez de pasar en silencio.
 */

import { readFileSync } from "node:fs";

/* las funciones internas no se exportan: se agregan al vuelo para la prueba */
const src = readFileSync(new URL("./sync.js", import.meta.url), "utf8")
  + "\nexport { eventosDeIcal, eventosCrudos, coincide, fuenteConfig, normalizar };\n";
const mod = await import("data:text/javascript;base64," + Buffer.from(src, "utf8").toString("base64"));

/* fechas relativas a hoy: la prueba no caduca */
function dia(offsetDias) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDias);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function iso(compacto) {
  return compacto.slice(0, 4) + "-" + compacto.slice(4, 6) + "-" + compacto.slice(6);
}

/* una agenda unica para las tres casas, como la exportaria Google */
const ics = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",

  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:" + dia(10), "DTEND;VALUE=DATE:" + dia(13),
  "SUMMARY:Ohana - Martin\\, 4 personas", "END:VEVENT",

  /* en minusculas */
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:" + dia(20), "DTEND;VALUE=DATE:" + dia(22),
  "SUMMARY:solale - Ana", "END:VEVENT",

  /* con tildes de mas y espacios dobles */
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:" + dia(30), "DTEND;VALUE=DATE:" + dia(31),
  "SUMMARY:Dós  Amóres - Pedro", "END:VEVENT",

  /* titulo plegado en dos lineas, como hace iCal con los largos */
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:" + dia(40), "DTEND;VALUE=DATE:" + dia(42),
  "SUMMARY:Oha", " na - reserva con titulo largo", "END:VEVENT",

  /* cancelado: no bloquea */
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:" + dia(50), "DTEND;VALUE=DATE:" + dia(52),
  "SUMMARY:Ohana - cancelada", "STATUS:CANCELLED", "END:VEVENT",

  /* el error caro: no nombra ninguna casa */
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:" + dia(60), "DTEND;VALUE=DATE:" + dia(62),
  "SUMMARY:Reserva Juan", "END:VEVENT",

  /* del pasado: fuera de la ventana */
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20200101", "DTEND;VALUE=DATE:20200105",
  "SUMMARY:Ohana - vieja", "END:VEVENT",

  "END:VCALENDAR"
].join("\r\n");

const alias = {
  ohana: mod.fuenteConfig({ url: "x", contiene: "Ohana" }).alias,
  dosAmores: mod.fuenteConfig({ url: "x", contiene: "Dos Amores" }).alias,
  solale: mod.fuenteConfig({ url: "x", contiene: ["Solale", "Sol Ale"] }).alias
};

let fallas = 0;
function chequear(titulo, obtenido, esperado) {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    console.log("  ok     " + titulo);
  } else {
    fallas++;
    console.log("  FALLA  " + titulo + "\n         esperaba " + b + "\n         obtuvo   " + a);
  }
}

chequear("Ohana se queda con lo suyo, incluido el titulo plegado",
  mod.eventosDeIcal(ics, alias.ohana),
  [[iso(dia(10)), iso(dia(12))], [iso(dia(40)), iso(dia(41))]]);

chequear("el filtro ignora mayusculas",
  mod.eventosDeIcal(ics, alias.solale),
  [[iso(dia(20)), iso(dia(21))]]);

chequear("el filtro ignora tildes y espacios de mas",
  mod.eventosDeIcal(ics, alias.dosAmores),
  [[iso(dia(30)), iso(dia(30))]]);

chequear("sin filtro entran todos los vigentes, menos el cancelado y el viejo",
  mod.eventosDeIcal(ics, []).length, 5);

chequear("el evento que no nombra casa se detecta",
  mod.eventosCrudos(ics)
    .filter(function (e) { return !mod.coincide(e.titulo, [].concat(alias.ohana, alias.dosAmores, alias.solale)); })
    .map(function (e) { return e.titulo; }),
  ["Reserva Juan"]);

chequear("una url suelta sigue funcionando igual que antes",
  mod.fuenteConfig("https://x.ics"), { url: "https://x.ics", alias: [] });

chequear("la ultima noche es la vispera de la salida",
  mod.eventosDeIcal(ics, alias.ohana)[0][1], iso(dia(12)));

console.log(fallas ? "\n" + fallas + " prueba(s) fallaron" : "\ntodo en orden");
process.exit(fallas ? 1 : 0);
