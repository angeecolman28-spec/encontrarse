# Publicar Encontrarse en Cloudflare

Tres piezas:

| Pieza | Qué hace |
|---|---|
| **Pages** `encontrarse` | Sirve el sitio y la ruta `/api/disponibilidad` |
| **Worker** `encontrarse-sync` | Cada 30 min baja los calendarios, guarda en KV y avisa por Telegram |
| **KV** `encontrarse-disponibilidad` | El JSON compartido entre los dos |

Pages no puede correr tareas programadas: por eso el cron vive en un Worker aparte.

---

## 1. Subir el proyecto a GitHub

En la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Sitio Encontrarse"
git branch -M main
git remote add origin https://github.com/USUARIO/encontrarse.git
git push -u origin main
```

`.gitignore` ya deja afuera la guía de marca en PDF (22 MB) y los archivos de trabajo local.

## 2. Crear el proyecto en Pages

**Workers & Pages → Create → Pages → Connect to Git**, elegir el repo y configurar:

- Framework preset: **None**
- Build command: **vacío**
- Build output directory: **`/`**

Es un sitio estático: no hay nada que compilar. Cada push a `main` publica; las otras ramas generan vistas previas.

En **Custom domains** agregar `encontrarse.uy`.

El archivo `_headers` (cabeceras de seguridad) y `404.html` funcionan automáticamente.

## 3. Crear el almacén KV

**Storage & Databases → KV → Create namespace**, nombre `encontrarse-disponibilidad`. Anotar el ID.

Vincularlo al proyecto de Pages: **Settings → Bindings → Add → KV namespace**

- Variable name: `DISPO`
- KV namespace: `encontrarse-disponibilidad`

Después de agregar el binding hay que volver a publicar (Deployments → Retry deployment) para que la función lo vea.

## 4. Crear el Worker

**Workers & Pages → Create → Worker**, nombre `encontrarse-sync`. Editar y pegar el contenido de [`worker/sync.js`](worker/sync.js). Deploy.

Después, en **Settings** del Worker:

**Bindings → KV namespace**
- Variable name: `DISPO` → `encontrarse-disponibilidad`

**Variables and Secrets** (todas como *Secret*, encriptadas):

| Nombre | Valor |
|---|---|
| `FEEDS` | El JSON de abajo |
| `TELEGRAM_TOKEN` | El token de @BotFather |
| `TELEGRAM_CHAT_ID` | El chat donde avisar |
| `REFRESH_KEY` | Una clave inventada, larga |

**Trigger Events → Cron Triggers → Add**: `*/30 * * * *`

### El JSON de FEEDS

```json
{
  "casa-la-viuda": {
    "nombre": "Casa La Viuda",
    "fuentes": {
      "airbnb": "https://www.airbnb.com/calendar/ical/XXXX.ics?s=XXXX",
      "booking": "https://ical.booking.com/v1/export?t=XXXX",
      "calendar": "https://calendar.google.com/calendar/ical/XXXX/private-XXXX/basic.ics"
    }
  },
  "casa-playa-grande": { "nombre": "Casa Playa Grande", "fuentes": { } },
  "casa-del-pueblo": { "nombre": "Casa del Pueblo", "fuentes": { } },
  "casa-dunas-chuy": { "nombre": "Casa Dunas", "fuentes": { } }
}
```

Las claves (`casa-la-viuda`, etc.) tienen que coincidir con los `id` de cada ficha en `index.html`.

**Importante:** estos enlaces son direcciones secretas. Quien las tenga ve tus fechas bloqueadas. Por eso van como secreto del Worker y nunca en el repositorio.

### De dónde salen los enlaces

- **Airbnb:** Calendario → la casa → Disponibilidad → Sincronizar calendarios → Exportar calendario.
- **Booking:** Extranet → Tarifas y disponibilidad → Sincronización de calendarios → Exportar.
- **Google Calendar:** una agenda por casa → Configuración de la agenda → Integrar calendario → Dirección secreta en formato iCal.

En Google se anotan las reservas directas (las de WhatsApp). Esa misma agenda conviene importarla en Airbnb y en Booking para que también bloqueen.

## 5. Telegram

1. Escribirle a **@BotFather** → `/newbot` → guarda el token.
2. Escribirle `/start` al bot nuevo.
3. Abrir `https://api.telegram.org/bot<TOKEN>/getUpdates` y buscar `"chat":{"id":...}`.
4. Cargar token y chat id como secretos del Worker.

Para un grupo: agregar el bot al grupo y usar el id del grupo (empieza con `-100`).

## 6. Probar

```
https://encontrarse-sync.<tu-subdominio>.workers.dev/refresh?key=TU_REFRESH_KEY
```

Devuelve cuántas casas procesó. Después:

```
https://encontrarse.uy/api/disponibilidad
```

Tiene que mostrar el JSON con las fechas. En la web, el calendario de cada casa deja de decir "Datos de ejemplo".

- `/health` en el Worker dice hace cuánto se actualizó.
- Los registros en vivo están en **Observability → Logs** del Worker.

## Mientras no esté conectado

La web usa `assets/data/disponibilidad-ejemplo.json` y avisa en pantalla que son datos de ejemplo. Cuando `/api/disponibilidad` devuelve casas, ese archivo deja de usarse (se puede borrar).

## Notas

- `worker/sync.js` queda publicado en `https://encontrarse.uy/worker/sync.js`. No tiene secretos, pero si preferís que no se vea, el Worker puede vivir en otro repositorio.
- Costo: todo dentro del plan gratuito. El cron escribe 48 veces por día contra un tope de 1.000.
