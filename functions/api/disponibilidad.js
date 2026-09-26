/**
 * GET /api/disponibilidad
 * Devuelve el JSON que dejo el Worker encontrarse-sync en KV.
 * Solo fechas ocupadas por casa: ningun dato de huespedes.
 *
 * Binding necesario en el proyecto de Pages: KV namespace con nombre DISPO.
 */
export async function onRequestGet({ env }) {
  const vacio = { estado: "sin-datos", casas: {} };

  let raw = null;
  try {
    if (env.DISPO) raw = await env.DISPO.get("disponibilidad");
  } catch (e) {
    raw = null;
  }

  return new Response(raw || JSON.stringify(vacio), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      /* 5 minutos en el borde: el Worker actualiza cada 30 */
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex"
    }
  });
}
