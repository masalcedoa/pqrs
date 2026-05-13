# 12 — Despliegue y pruebas

Guía paso-a-paso para Windows PowerShell, con tres entornos: local · Supabase Cloud · Vercel.

---

## 0) Prerequisitos

| Herramienta             | Versión mínima | Verificación               |
|-------------------------|----------------|----------------------------|
| Node.js                 | 20 (probado 24)| `node --version`           |
| npm                     | 10             | `npm --version`            |
| Docker Desktop          | 24             | `docker info` (en running) |
| Supabase CLI            | 2.x            | `npx supabase --version`   |
| Vercel CLI (opcional)   | 32+            | `npx vercel --version`     |

> ⚠️ Para el entorno local **Docker Desktop debe estar corriendo** (Supabase local levanta contenedores).

---

## 1) Entorno LOCAL

### 1.1 Instalar y configurar variables

```powershell
cd C:\Users\msalcedo\Documents\sss\projects\05-PQRS
npm install
# .env.local ya viene generado con valores de Supabase local. Edítalo si necesitas:
notepad .env.local
npm run check:env
```

### 1.2 Levantar Supabase local

```powershell
# Asegúrate de tener Docker Desktop abierto
npx supabase start
```

La primera vez baja imágenes (~2 GB). Cuando termine imprime:

```
         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
        anon key: eyJhbGciOi...
service_role key: eyJhbGciOi...
```

**Copia esas dos keys a `.env.local`** (sobrescriben las de ejemplo). El URL de DB y API ya coinciden con los defaults.

### 1.3 Aplicar migraciones 0001..0021

`supabase start` ya aplicó las migraciones en orden. Para forzar reset:

```powershell
npm run db:reset    # destruye datos + replay 0001..0021
```

### 1.4 Crear admin y organización inicial

```powershell
npm run seed:admin
# o personalizado:
npm run seed:admin -- --email=admin@empresa.co --slug=empresa-a --name="Empresa A S.A. E.S.P."
```

Salida esperada:

```
✔ Usuario creado: <uuid>
✔ users_profile (admin)
✔ Organización creada: <uuid>
✔ membresía admin

Usar para login:
  email:    admin@pqrs.local
  password: PQRS-Admin-2026!
```

### 1.5 Arrancar la app

```powershell
npm run dev
```

URL esperada: `http://localhost:3000`.

### 1.6 Pruebas funcionales (manuales)

| Flujo                                | URL                                           | Resultado esperado |
|--------------------------------------|-----------------------------------------------|---------------------|
| Home                                 | http://localhost:3000/                        | 200, links a radicar / login |
| Radicar (form + chat IA)             | http://localhost:3000/radicar                 | Form y chat mock visibles |
| Crear PQRS                           | rellenar form → Radicar                       | Aparece `PQRS-YYYY-NNNNNNN` |
| Login admin                          | http://localhost:3000/login                   | Magic link (revisar inbucket http://localhost:54324) o password si lo activas |
| Dashboard                            | http://localhost:3000/dashboard               | KPIs, gráficos, cola |
| Detalle de un PQRS                   | http://localhost:3000/pqrs/[id]               | Timeline + comentarios + panel de transición |
| Transición                           | botón en el detalle                           | Estado cambia, aparece evento en timeline |
| Crear orden                          | `POST /api/work-orders` (curl)                | Devuelve `OT-YYYY-NNNNNNN` |
| Power BI sin token                   | http://localhost:3000/api/powerbi/por_tipo    | 401 |
| Power BI con token (admin debe crear api_key) | header `x-api-token`                | 200 con datos |

### 1.7 Smoke test automatizado

Con `npm run dev` levantado en otra terminal:

```powershell
npm run smoke
```

Salida esperada (todos OK):

```
• GET /  → 200 ... OK
• GET /radicar → 200 ... OK
• POST /api/pqrs ... OK
• POST /api/ai/chat (mock o real) ... OK
• GET /api/powerbi/por_tipo sin token → 401 ... OK
Resumen: 5/5 OK
```

### 1.8 Tests unitarios

```powershell
npm test
```

Esperado: `11 passed (workflow engine + guardrails)`.

---

## 2) SUPABASE CLOUD (staging/prod)

### 2.1 Crear proyecto

1. https://app.supabase.com → **New project** en la organización destino.
2. Anota: `Project Ref` (algo como `abcdefghijkl`), `Database password`, region cercana a Bogotá (`sa-east-1`).
3. Espera ~2 min hasta que el proyecto esté listo.

### 2.2 Aplicar migraciones

```powershell
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push    # ejecuta 0001..0021 en orden
```

### 2.3 Crear buckets

Las migraciones 0021 ya intentan crear `pqrs-adjuntos`, `respuestas`, `normativa` vía `storage.buckets`. Si la inserción no es permitida por RLS en tu cuenta, créalos manualmente desde Studio → Storage → New bucket (cada uno privado).

### 2.4 Configurar Auth

- Settings → Authentication → Providers → **Email**: activar; configurar SMTP propio en prod (Resend / SES) si no quieres usar el SMTP de Supabase.
- Settings → Authentication → URL Configuration:
  - **Site URL**: `https://app.tu-dominio.co`
  - **Redirect URLs**: `https://app.tu-dominio.co/**`, `http://localhost:3000/**` (dev).
- Activar **Confirm email** en prod (en dev viene desactivado para acelerar).

### 2.5 Verificar RLS

Studio → Database → Tables. Para cada tabla operativa la columna **RLS** debe estar **ON**. Revisar políticas:

```sql
-- Listar políticas activas
select schemaname, tablename, policyname, cmd, qual
from pg_policies where schemaname = 'public' order by tablename;
```

### 2.6 Crear admin y org de producción

```powershell
# Apuntando a Supabase Cloud:
# Sobrescribe NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local con los del proyecto.
npm run seed:admin -- --email=admin@empresa.co --slug=empresa --name="Empresa S.A. E.S.P." --password=<seguro>
```

---

## 3) VERCEL

### 3.1 Conectar repo

1. https://vercel.com → **Add New Project**.
2. Importar el repo GitHub.
3. Framework: **Next.js** (autodetectado).
4. Build command: `npm run build` (default).
5. Output: `.next` (default).

### 3.2 Variables de entorno

En **Settings → Environment Variables** (alcance: Production + Preview):

| Variable                              | Valor                                          | Notas                            |
|---------------------------------------|------------------------------------------------|----------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`            | `https://<ref>.supabase.co`                    | obligatorio                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | `<anon_key>`                                   | obligatorio                      |
| `SUPABASE_SERVICE_ROLE_KEY`           | `<service_role_key>`                           | **secreto**, marcar encrypted    |
| `NEXT_PUBLIC_APP_URL`                 | `https://app.tu-dominio.co`                    | obligatorio                      |
| `APP_URL`                             | `https://app.tu-dominio.co`                    | usado en server                  |
| `APP_TIMEZONE`                        | `America/Bogota`                               |                                  |
| `CRON_SECRET`                         | string largo aleatorio                         | **secreto**                      |
| `ANTHROPIC_API_KEY`                   | `sk-ant-...`                                   | secreto                          |
| `ANTHROPIC_MODEL_PRIMARY`             | `claude-opus-4-7`                              |                                  |
| `ANTHROPIC_MODEL_FAST`                | `claude-haiku-4-5-20251001`                    |                                  |
| `AI_MOCK_MODE`                        | `false`                                        | en prod                          |
| `OPENAI_API_KEY`                      | `sk-...`                                       | secreto                          |
| `OPENAI_EMBEDDING_MODEL`              | `text-embedding-3-small`                       |                                  |
| `RESEND_API_KEY`                      | `re_...`                                       | secreto                          |
| `RESEND_FROM`                         | `"PQRS Energía <pqrs@empresa.co>"`             |                                  |
| `META_WHATSAPP_TOKEN`                 | token Meta                                     | secreto                          |
| `META_WHATSAPP_PHONE_NUMBER_ID`       | id del número                                  |                                  |
| `POWERBI_API_SECRET`                  | string largo aleatorio                         | secreto                          |

### 3.3 Deploy y validación

1. **Deploy** desde el botón o `git push` a `main`.
2. Verificar logs en `Deployments → <hash> → Build Logs`.
3. Abrir la URL preview.
4. `Settings → Cron Jobs` debe listar 3 cron (vienen de `vercel.json`):

   | Path                            | Schedule    |
   |---------------------------------|-------------|
   | `/api/notifications/dispatch`   | `*/5 * * * *` |
   | `/api/jobs/term-calc`           | `0 6 * * *`   |
   | `/api/jobs/snapshot-pbi`        | `30 1 * * *`  |

   Vercel envía `GET` con `Authorization: Bearer $CRON_SECRET`. El código de cada endpoint acepta ese esquema.

5. **Revisar logs** en `Logs → Functions`. Filtrar por `/api/pqrs`, `/api/ai/chat`, `/api/jobs/*`.

### 3.4 Dominio y subdominios (multitenant)

- **Settings → Domains**: agregar `app.tu-dominio.co` (root del backoffice).
- Para subdominios por tenant: agregar wildcard `*.tu-dominio.co` (requiere certificado wildcard; Vercel lo emite automático).
- El middleware (`src/middleware.ts`) y `src/lib/tenant/context.ts` ya resuelven el tenant por subdominio.

---

## 4) Probar Power BI

### 4.1 Crear API key

Desde SQL Studio (o psql con `SUPABASE_DB_URL`):

```sql
-- Genera el hash de tu token plano (rota cada 90 días).
-- Ejemplo: token plano = 'pbi_2026_XXXX_rotame'
insert into api_keys (org_id, name, hash_sha256, scope, expires_at)
select id, 'Power BI - producción',
       encode(digest('pbi_2026_XXXX_rotame','sha256'),'hex'),
       array['readonly'],
       now() + interval '90 days'
from organizations where slug = 'empresa';
```

### 4.2 Power BI Desktop → conectar

- **Obtener datos → Web → Avanzado**:
  - URL: `https://app.tu-dominio.co/api/powerbi/radicados_mes`
  - Header HTTP: `x-api-token = pbi_2026_XXXX_rotame`
- Para CSV (filtros):
  `https://app.tu-dominio.co/api/powerbi/export?metric=pbi_snapshots_daily&from=2026-01-01&to=2026-12-31`

### 4.3 Métricas disponibles

`radicados_dia`, `radicados_mes`, `radicados_anio`, `por_tipo`, `por_causal`, `por_municipio`, `por_area`, `vencidos`, `por_vencer`, `tiempo_respuesta`, `ordenes_generadas`, `reincidencia`, `reclamos_facturacion`, `reclamos_consumo`, `reclamos_medidor`, `recursos_reposicion`, `apelaciones`, `escalados_sspd`, `efectividad`, `productividad`, `ranking_causales`.

---

## 5) URLs locales esperadas

| Servicio              | URL                                           |
|-----------------------|-----------------------------------------------|
| App Next.js           | http://localhost:3000                         |
| Supabase API          | http://localhost:54321                        |
| Supabase Studio       | http://localhost:54323                        |
| Supabase DB           | `postgresql://postgres:postgres@localhost:54322/postgres` |
| Inbucket (emails)     | http://localhost:54324                        |

---

## 6) Resolución de problemas

| Síntoma                                                | Causa probable                                   | Acción                                            |
|--------------------------------------------------------|--------------------------------------------------|---------------------------------------------------|
| `supabase start` falla con error de Docker             | Docker Desktop no está corriendo                 | Abrir Docker Desktop                              |
| `npm run dev` arranca pero `/api/pqrs` da "fetch failed" | Supabase local no levantado                     | `npx supabase start`                              |
| `seed:admin` falla con `relation organizations does not exist` | Migración 0012 no aplicada                | `npm run db:reset`                                |
| Login no llega magic link                              | Inbucket está en `localhost:54324`               | Abrir esa URL para ver el correo                  |
| Dashboard vacío                                        | Sin snapshots aún                                | Crea casos y corre `POST /api/jobs/snapshot-pbi`  |
| 401 en `/api/jobs/*`                                    | `CRON_SECRET` mal configurado                   | Verificar `.env.local` y header `Authorization: Bearer $CRON_SECRET` |
| `fn_set_current_org does not exist`                     | Migración 0021 no aplicada                       | `supabase db push`                                |
