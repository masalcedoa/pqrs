# 14 — Coexistencia local de los proyectos PQRS y FRAUDE

Esta guía describe cómo levantar, detener y alternar entre los dos proyectos
de la máquina de desarrollo sin que choquen puertos, containers, volúmenes ni procesos Next.js.

> **No se elimina nada del proyecto FRAUDE.** Solo se mueve el frontend a `:3001`
> para liberar `:3000` para PQRS (Next.js).

---

## 1. Mapa de puertos

| Puerto  | Proyecto | Servicio                          | Notas |
|--------:|----------|-----------------------------------|-------|
|   3000  | PQRS     | Next.js dev (`npm run dev`)       | Único en :3000 |
|   3001  | FRAUDE   | Frontend (container `fraude-frontend`) | Override `${FRAUDE_FRONTEND_PORT:-3001}` |
|     80  | FRAUDE   | Caddy reverse proxy               | Solo si arrancas FRAUDE |
|    443  | FRAUDE   | Caddy TLS                         | Solo si arrancas FRAUDE |
|   8000  | FRAUDE   | API FastAPI (`fraude-api`)        | |
|   5432  | FRAUDE   | PostgreSQL (`fraude-postgres`)    | bind 127.0.0.1 |
|  16379  | FRAUDE   | Redis (`fraude-redis`)            | bind 127.0.0.1 |
|   9000  | FRAUDE   | MinIO S3 API                      | bind 127.0.0.1 |
|   9001  | FRAUDE   | MinIO consola web                 | bind 127.0.0.1 |
|  54321  | PQRS     | Supabase Kong (API)               | |
|  54322  | PQRS     | PostgreSQL Supabase               | |
|  54323  | PQRS     | Studio                            | |
|  54324  | PQRS     | Inbucket / Mailpit                | |

**Conflictos eliminados:**
- `:3000` antes era usado por `fraude-frontend`. Ahora va a `:3001`.
- `:5432` (FRAUDE Postgres) y `:54322` (Supabase Postgres) ya estaban separados.
- Networks y volúmenes están prefijados por proyecto y no se cruzan.

---

## 2. Scripts disponibles

Todos viven en `C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\`.

| Script                  | Qué hace                                         |
|-------------------------|--------------------------------------------------|
| `start-pqrs.ps1`        | Sube Supabase local + Next.js dev en :3000      |
| `stop-pqrs.ps1`         | Mata Next.js y baja Supabase (conserva datos)   |
| `start-fraude.ps1`      | `docker compose up -d` con `FRAUDE_FRONTEND_PORT=3001` |
| `stop-fraude.ps1`       | `docker compose stop` (conserva datos)          |
| `status-projects.ps1`   | Reporte consolidado de containers, puertos y URLs |

Ejecución típica (desde cualquier ruta):

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\status-projects.ps1
```

Si quieres atajos, agrega al perfil PowerShell (`$PROFILE`):

```powershell
function pqrs-start  { & "C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\start-pqrs.ps1" }
function pqrs-stop   { & "C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\stop-pqrs.ps1" }
function fraude-start{ & "C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\start-fraude.ps1" }
function fraude-stop { & "C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\stop-fraude.ps1" }
function proy-status { & "C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\status-projects.ps1" }
```

---

## 3. Casos de uso

### 3.1 Trabajar solo en PQRS
```powershell
fraude-stop      # opcional, libera recursos
pqrs-start
```
URLs:
- App: http://localhost:3000
- Studio: http://localhost:54323
- Inbucket: http://localhost:54324
- Admin: `admin@pqrs.local` / `PQRS-Admin-2026!`

### 3.2 Trabajar solo en FRAUDE
```powershell
pqrs-stop        # opcional
fraude-start
```
URLs:
- Frontend: http://localhost:3001
- API: http://localhost:8000/docs
- MinIO: http://localhost:9001

### 3.3 Ambos al tiempo
```powershell
pqrs-start
fraude-start
proy-status
```
PQRS queda en `:3000`, FRAUDE en `:3001`. No hay solape.

### 3.4 Cambiar de proyecto rápido
```powershell
pqrs-stop
fraude-start
```
Los datos persisten porque los volúmenes Docker no se borran (`docker compose stop`, no `down -v`).

---

## 4. Qué cambió respecto al estado anterior

1. `reper-tool-v2/docker-compose.yml` — servicio `frontend` ahora expone
   `${FRAUDE_FRONTEND_PORT:-3001}:80` (antes era `3000:80`). Sin la variable,
   por defecto va a `3001`.
2. `05-PQRS/.env.local` — `CRON_SECRET` quedó en `12345678901234567890123456789012`.
3. 5 scripts PowerShell nuevos en `05-PQRS/scripts/`.

No se tocó:
- Arquitectura de ninguno de los dos proyectos.
- Bases de datos, volúmenes, imágenes ni containers críticos.
- `package.json`, `supabase/config.toml` ni el código de aplicación de PQRS.

---

## 5. Troubleshooting

### Puerto 3000 ocupado al arrancar PQRS
`start-pqrs.ps1` detecta si `fraude-frontend` está usando `:3000` y lo detiene.
Si lo ocupa otro proceso (Node huérfano, Docker WSL relay), revisa con:
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
```

### Supabase no arranca: error `functions[verify_jwt]`
Configuración legacy en `supabase/config.toml`. La sintaxis válida en CLI ≥ 2.x
es `[functions.<nombre>] verify_jwt = false`, no `[functions] verify_jwt = false`.
El `config.toml` de PQRS ya está migrado.

### Container `fraude-frontend` se reinicia en `:3000`
Tiene `restart: unless-stopped`. Si lo paras con `docker stop` se queda detenido,
pero un `docker start fraude-frontend` o `docker compose up` lo vuelve a subir.
Para asegurar que use `:3001`, exporta la variable antes:
```powershell
$env:FRAUDE_FRONTEND_PORT = 3001; docker compose up -d
```
O simplemente usa `start-fraude.ps1` que lo hace por ti.

### Docker Desktop apagado
Todos los scripts comprueban `docker info` y abortan con mensaje claro si no responde.

### Conflicto de Postgres (5432 vs 54322)
No hay. FRAUDE Postgres queda en `:5432` (bind a `127.0.0.1`), Supabase en
`:54322`. Son procesos distintos en containers separados.

### Reset duro de un proyecto (sin tocar el otro)
- PQRS: `cd 05-PQRS && npx supabase db reset` (recarga migraciones; **borra datos**).
- FRAUDE: `cd .../reper-tool-v2 && docker compose down` (sin `-v` no borra volúmenes).

### Liberar todos los containers y volver al estado limpio (sin perder datos)
```powershell
pqrs-stop
fraude-stop
docker ps -a    # debe verse "Exited" en todos los containers de ambos stacks
```

---

## 6. Referencias internas

- `docs/12-DESPLIEGUE-Y-PRUEBAS.md` — pruebas E2E del stack PQRS.
- `docs/13-CHECKLIST-PRODUCCION.md` — pasos antes de Vercel + Supabase Cloud.
- `docs/14-RUNBOOK-LOCAL.md` — runbook detallado para PQRS local.
