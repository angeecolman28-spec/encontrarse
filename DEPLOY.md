# Publicar Encontrarse en Cloudflare

Todo vive en **un solo Worker** (`encontrarse`), creado desde el repo de GitHub:

| Parte | Archivo |
|---|---|
| Configuración | `wrangler.jsonc` |
| Sitio estático | la raíz del repo (lo que no se publica está en `.assetsignore`) |
| Rutas `/api/*` | `src/index.js` |
| Sincronización de calendarios + Telegram | `src/sync.js` |
| Almacén de fechas | KV `encontrarse-disponibilidad` |

El cron corre dentro del mismo Worker cada 30 minutos.

---

## 1. Crear el Worker desde el repo

Panel de Cloudflare → **Compute** → **Workers** → **Create** → **Import a repository**.

- Repositorio: `angeecolman28-spec/encontrarse`
- Project name: `encontrarse`
- Build command: **vacío**
- Deploy command: `npx wrangler deploy` (viene por defecto)

Deploy. Cloudflare lee `wrangler.jsonc`, sube el sitio, publica las rutas y registra el cron.

Queda en `https://encontrarse.<tu-subdominio>.workers.dev`.

## 2. Cargar los secretos

En el Worker → **Settings** → **Variables and Secrets** → Add, tipo **Secret**:

| Nombre | Valor |
|---|---|
| `FEEDS` | El JSON de abajo |
| `TELEGRAM_TOKEN` | El token de @BotFather |
| `TELEGRAM_CHAT_ID` | El chat donde avisar |
| `REFRESH_KEY` | Una clave inventada, larga |

El KV ya queda vinculado por `wrangler.jsonc`: no hay que tocarlo a mano.

### El JSON de FEEDS

```json
{
  "casa-ohana": {
    "nombre": "Ohana",
    "fuentes": {
      "airbnb": "https://www.airbnb.com/calendar/ical/XXXX.ics?s=XXXX",
      "booking": "https://ical.booking.com/v1/export?t=XXXX",
      "calendar": "https://calendar.google.com/calendar/ical/XXXX/private-XXXX/basic.ics"
    }
  },
  "casa-dos-amores": { "nombre": "Dos Amores", "fuentes": {} },
  "casa-solale": { "nombre": "Solale", "fuentes": {} }
}
```

Las claves (`casa-ohana`, etc.) tienen que coincidir con los `id` de cada ficha en `index.html`.

**Los enlaces `.ics` son direcciones secretas:** quien las tenga ve tus fechas bloqueadas. Por eso van como secreto y nunca en el repositorio.

### De dónde salen los enlaces .ics

Hay que sacar un enlace por casa y por plataforma. Los nombres de los menús
cambian cada tanto, pero el camino es siempre el mismo.

**Airbnb** (desde la computadora, no desde la app)

1. Entrar como anfitriona → **Calendario**.
2. Elegir el anuncio arriba a la izquierda.
3. En la columna de la derecha: **Disponibilidad** → **Sincronizar calendarios**
   (o "Conectar con otro sitio web").
4. **Exportar calendario** → copiar el enlace.

Queda algo así: `https://www.airbnb.com/calendar/ical/24905547.ics?s=...`

**Booking.com** (Extranet)

1. Entrar a admin.booking.com y elegir la propiedad.
2. **Tarifas y disponibilidad** → **Sincronización de calendarios**
   (a veces figura como "Calendar sync" o "Conectividad iCal").
3. En **Exportar calendario**, copiar el enlace de la unidad/habitación.

Queda algo así: `https://ical.booking.com/v1/export?t=...`

Si el menú no aparece, la propiedad todavía no tiene la sincronización iCal
habilitada: se pide por el chat de soporte de la Extranet.

**Google Calendar** (para las reservas directas, las de WhatsApp)

1. Crear **una agenda por casa** (Otras agendas → + → Crear agenda nueva).
2. Abrirla en **Configuración y uso compartido**.
3. Bajar hasta **Integrar calendario** → copiar **Dirección secreta en formato iCal**.

Queda algo así:
`https://calendar.google.com/calendar/ical/.../private-.../basic.ics`

Ojo: la agenda tarda unas horas en reflejar cambios recientes en el .ics. Para
una reserva directa de último momento conviene bloquearla también a mano en
Airbnb o Booking.

### Que las plataformas se bloqueen entre ellas

El sitio solo *muestra* las fechas. Para que una reserva de Booking no se pueda
volver a vender en Airbnb, cada plataforma tiene que importar los calendarios de
las otras, en la misma pantalla donde se exporta:

- En Airbnb, **Importar calendario**: pegar el de Booking y el de Google.
- En Booking, **Importar calendario**: pegar el de Airbnb y el de Google.

Es decir: cada enlace se pega dos veces, una en el `FEEDS` del Worker y otra en
la otra plataforma.

### Probar un enlace antes de cargarlo

Pegarlo en el navegador: si descarga un archivo de texto que empieza con
`BEGIN:VCALENDAR`, sirve. Si pide iniciar sesión o da error, está mal copiado.

## 3. Telegram

1. Escribirle a **@BotFather** → `/newbot` → guarda el token.
2. Escribirle `/start` al bot nuevo.
3. Abrir `https://api.telegram.org/bot<TOKEN>/getUpdates` y buscar `"chat":{"id":...}`.
4. Cargar token y chat id como secretos.

Para un grupo: agregar el bot al grupo y usar el id del grupo (empieza con `-100`).

## 4. Dominio propio

Worker → **Settings** → **Domains & Routes** → **Add** → Custom domain → `encontrarse.uy`.

## 5. Probar

| URL | Qué tiene que devolver |
|---|---|
| `/api/refresh?key=TU_REFRESH_KEY` | `{"ok":true,"casas":4,...}` |
| `/api/disponibilidad` | El JSON con las fechas ocupadas |
| `/api/health` | Hace cuántos minutos se actualizó y el estado de cada calendario |

En la web, el calendario de cada casa deja de decir "Datos de ejemplo".

Los registros en vivo están en **Observability → Logs** del Worker.

---

## Notas

- **Mientras no haya datos:** la web usa `assets/data/disponibilidad-ejemplo.json` y avisa en pantalla que son de ejemplo. Cuando `/api/disponibilidad` devuelve casas, ese archivo deja de usarse (se puede borrar).
- **Cada push a `main`** republica el sitio automáticamente.
- **`_headers`** (cabeceras de seguridad) y `404.html` se aplican solos.
- **Costo:** dentro del plan gratuito. El cron escribe 48 veces por día contra un tope de 1.000.
