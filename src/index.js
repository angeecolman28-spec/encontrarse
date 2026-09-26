/**
 * encontrarse — Worker del sitio
 * ---------------------------------------------------------------------------
 * Hace tres cosas:
 *   1. Sirve el sitio estatico (binding ASSETS).
 *   2. Responde /api/disponibilidad con las fechas ocupadas guardadas en KV.
 *   3. Cada 30 minutos (cron) baja los calendarios y avisa por Telegram.
 *
 * Bindings y secretos en wrangler.jsonc y en el panel de Cloudflare.
 */

import { sincronizar, resumenEstado } from "./sync.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/disponibilidad") {
      return disponibilidad(env);
    }

    if (url.pathname === "/api/refresh") {
      if (!env.REFRESH_KEY || url.searchParams.get("key") !== env.REFRESH_KEY) {
        return json({ error: "clave invalida" }, 401);
      }
      return json(await sincronizar(env));
    }

    if (url.pathname === "/api/health") {
      return json(await resumenEstado(env));
    }

    /* cualquier otra cosa es el sitio: html, css, js, fotos */
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sincronizar(env));
  }
};

async function disponibilidad(env) {
  let raw = null;
  try {
    if (env.DISPO) raw = await env.DISPO.get("disponibilidad");
  } catch (e) {
    raw = null;
  }

  return new Response(raw || JSON.stringify({ estado: "sin-datos", casas: {} }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      /* 5 minutos en el borde: el cron actualiza cada 30 */
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex"
    }
  });
}

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
