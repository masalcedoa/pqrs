# 14 — Runbook local (estabilización DevOps)

Verificado funcionando en Windows 11 + Docker Desktop + Supabase CLI 2.98.2.

## Diagnóstico ejecutado

| Componente             | Resultado | Acción aplicada |
|------------------------|-----------|-----------------|
| `supabase/config.toml` | ✖ sintaxis 1.x del bloque `[functions]` | Reescrito a sintaxis 2.x; bloque `[functions]` eliminado y reemplazado por `[edge_runtime]` deshabilitado |
| Migración `0005_tables_workflow.sql` | ✖ `coalesce(enum::text, '')` en índice rompe `IMMUTABLE` | Usar `NULLS NOT DISTINCT` (PG15+) |
| Migración `0016_notifications_v2.sql` | ✖ seed sin columna `name` NOT NULL | Agregada columna `name` al INSERT |
| Migración `0016_notifications_v2.sql` | ✖ `notification_attempts` sin `org_id` | Agregada columna `org_id` |
| Migración `0019_powerbi_enterprise.sql` | ✖ `FILTER` después de cast | Parentesar y cast al resultado |
| Migración `0020_rls_multitenant.sql` | ✖ trigger `trg_set_org_id` lanza excepción que rompe inserts secundarios | Migración `0022_trigger_fixes.sql`: trigger no lanza excepción |
| Kong (gateway) | ✖ cachea IP vieja del Auth al reiniciar | `docker restart supabase_kong_pqrs-energia` |
| `/api/pqrs` (público) | ⚠ creaba casos con `org_id=null` | Helper `resolvePublicOrg(req, sb)` con prioridad header/subdomain/única-org |

## Sintaxis vieja vs. nueva (config.toml)

| 1.x (rompe en 2.x) | 2.x (correcto) |
|---|---|
| `[functions]`<br>`verify_jwt = false` | `[functions.mi-funcion]`<br>`verify_jwt = false`<br>(o **omitir el bloque** si no hay funciones) |
| (implícito) | `[edge_runtime]`<br>`enabled = false`<br>`policy = "oneshot"` |

Si añades una función edge:

```toml
[functions.notify-dispatcher]
verify_jwt = false
import_map = "./supabase/functions/notify-dispatcher/deno.json"
```

## Comandos ejecutables (verificados)

```powershell
# Toolchain
node --version              # 24.15.0
npm --version               # 11.12.1
npx supabase --version      # 2.98.2
docker info | findstr Server # 28.3.2

# Arrancar
cd C:\Users\msalcedo\Documents\sss\projects\05-PQRS
npx supabase start
npx supabase status

# Aplicar / resetear migraciones
npx supabase db reset       # (re)aplica 0001..0022 en orden

# Sembrar admin + org
npm run seed:admin
#   email:    admin@pqrs.local
#   password: PQRS-Admin-2026!

# App
npm run dev
# si el puerto 3000 está ocupado, arranca en 3001

# Smoke test
$env:SMOKE_BASE_URL = "http://localhost:3001"  # si fue 3001
npm run smoke

# Apagar
npx supabase stop
```

## Validación final ejecutada (todos OK)

| Check | Comando | Resultado |
|---|---|---|
| Config TOML parsea | `npx supabase status` | ✔ |
| Postgres + 22 migraciones | `npx supabase db reset` | ✔ |
| Auth, Storage, Realtime, Studio, Mailpit healthy | `docker ps --filter "name=supabase"` | ✔ 9 contenedores `(healthy)` |
| API REST accesible | `curl /rest/v1/` | ✔ |
| Auth admin reachable | `curl /auth/v1/health` | HTTP 200 |
| seed:admin idempotente | `npm run seed:admin` | ✔ admin@pqrs.local + org `demo` creados |
| Smoke test app | `npm run smoke` | ✔ 5/5 |
| Crear PQRS vía API pública | `POST /api/pqrs` | ✔ `PQRS-2026-0000002` con org_id ligado |
| Trigger numeración | DB | ✔ `PQRS-YYYY-NNNNNNN` y `OT-YYYY-NNNNNNN` |
| Trigger status_history | DB | ✔ inserción inicial + transición registradas |
| Crear orden de trabajo | DB | ✔ `OT-2026-0000001` |
| Buckets Storage | DB `storage.buckets` | ✔ `pqrs-adjuntos`, `respuestas`, `normativa` (privados) |
| Power BI con token | `curl -H "x-api-token: ..." /api/powerbi/por_tipo` | ✔ `{"metric":"por_tipo","rows":[{"tipo":"reclamo","total":2}]}` |
| Power BI sin token | `curl /api/powerbi/por_tipo` | ✔ 401 |

## Servicios y URLs locales

| Servicio        | URL                                              |
|-----------------|--------------------------------------------------|
| App Next.js     | `http://localhost:3000` (o 3001 si está ocupado) |
| Supabase API    | `http://127.0.0.1:54321`                         |
| Studio          | `http://127.0.0.1:54323`                         |
| Mailpit (era Inbucket) | `http://127.0.0.1:54324`                  |
| Postgres        | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

## Checklist de verificación funcional (manual, vía browser)

Acceder con `admin@pqrs.local / PQRS-Admin-2026!`:

- [ ] **Login** — `http://localhost:3000/login` → magic link en Mailpit (54324) o usar password directo
- [ ] **Dashboard** — `/dashboard` → KPIs cargan (vacíos si no hay snapshots aún)
- [ ] **Radicación PQRS** — `/radicar` → form + chat IA (mock)
- [ ] **Listado de casos** — `/pqrs` → ver PQRS-2026-0000001 y 0000002
- [ ] **Detalle de caso** — `/pqrs/[id]` → timeline, comentarios, panel de transición
- [ ] **Transición de estado** — botón en panel lateral del detalle
- [ ] **Órdenes** — `/ordenes` → ver OT-2026-0000001
- [ ] **Power BI endpoint** — `curl -H "x-api-token: <token>" http://localhost:3000/api/powerbi/por_tipo`
- [ ] **AI chat** — chat box en `/radicar` responde (mock con `AI_MOCK_MODE=true`)

## Si algo falla — checklist de recovery

| Síntoma | Acción |
|---|---|
| `npx supabase start` falla con `decoding failed: 'functions[verify_jwt]'` | El config.toml es de sintaxis 1.x. Aplicar el patch de este documento. |
| `npx supabase start` falla en migración SQL | El log antes de "Stopping containers" muestra el SQL; corregir y `npx supabase db reset`. |
| Auth API devuelve 502 | Kong cachea IP vieja. `docker restart supabase_kong_pqrs-energia`. |
| `npm run seed:admin` falla con `org_id requerido` | Aplicar migración `0022_trigger_fixes.sql`; resetear DB. |
| PQRS creado con `org_id=null` | Asegurar que `src/app/api/pqrs/route.ts` use `resolvePublicOrg()`. |
| Dev arranca en 3001 en vez de 3000 | Otra instancia ocupa 3000. `Get-Process node | Stop-Process -Force` y reintentar; o usar 3001 explícito en `SMOKE_BASE_URL`. |

## Compatibilidad con Supabase Cloud y Vercel

- Las migraciones `0001..0022` se aplican igual en Cloud vía `supabase db push`. **Nada se rompió.**
- Las funciones `fn_set_current_org`, `fn_refresh_pbi_metrics`, `fn_pbi_snapshot` están como `SECURITY DEFINER` con `grant execute` explícito.
- Buckets se crean por config.toml (local) y por SQL en `0021_rpc_helpers.sql` (Cloud).
- Storage RLS: política básica (`authenticated`) en `0021`. Endurecer en prod según necesidad.
- Vercel cron: rutas aceptan `Authorization: Bearer $CRON_SECRET` (que es como Vercel manda) **y** `x-cron-key` (para `curl` manual).

## Archivos modificados en este pase

```
docs/14-RUNBOOK-LOCAL.md                        (nuevo)
supabase/config.toml                            (reescrito para CLI 2.x)
supabase/migrations/0005_tables_workflow.sql    (NULLS NOT DISTINCT)
supabase/migrations/0016_notifications_v2.sql   (columna name + org_id en notification_attempts)
supabase/migrations/0019_powerbi_enterprise.sql (FILTER antes del cast)
supabase/migrations/0022_trigger_fixes.sql      (nuevo: trigger no-raising)
src/app/api/pqrs/route.ts                       (resolvePublicOrg)
scripts/seed-admin.ts                           (mejor logging del error)
```

Sin cambios en RLS, multitenant, modelo de datos ni arquitectura.
