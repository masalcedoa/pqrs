# 09 — DevOps

## Stack de despliegue

- **Vercel**: hosting de la aplicación Next.js + Vercel Cron.
- **Supabase**: Postgres + Auth + Storage + Edge Functions.
- **GitHub Actions**: CI (lint + typecheck + test + build) y CD (migraciones + deploy).
- **Docker**: imagen multi-stage opcional para self-hosted (`Dockerfile`, `docker-compose.yml`).

## Secrets requeridos en GitHub

| Nombre                    | Uso                                                |
|---------------------------|----------------------------------------------------|
| `SUPABASE_ACCESS_TOKEN`   | CLI Supabase                                       |
| `SUPABASE_PROJECT_REF`    | Project ref del proyecto                           |
| `SUPABASE_DB_PASSWORD`    | Password DB                                        |
| `VERCEL_TOKEN`            | Token Vercel                                       |
| `VERCEL_ORG_ID`           | Org ID Vercel                                      |
| `VERCEL_PROJECT_ID`       | Project ID Vercel                                  |
| `CRON_SECRET`             | Header `x-cron-key` para endpoints de cron          |

## Cron jobs (vercel.json)

| Endpoint                              | Frecuencia       | Función                                            |
|---------------------------------------|------------------|----------------------------------------------------|
| `/api/notifications/dispatch`         | cada 5 min       | Envía notificaciones pendientes con backoff        |
| `/api/jobs/term-calc`                 | 06:00 diario     | Marca vencidos + alerta próximos a vencer          |
| `/api/jobs/snapshot-pbi`              | 01:30 diario     | Genera snapshot diario y refresca MV               |

Todos requieren header `x-cron-key: $CRON_SECRET`.

## Observabilidad

- **Logger estructurado**: `src/infrastructure/observability/logger.ts`. JSON-line a stdout.
- **Sentry** (opcional): `SENTRY_DSN` en env y `withSentryConfig` en `next.config.mjs`.
- **OpenTelemetry**: configurar `OTEL_EXPORTER_OTLP_ENDPOINT` y `@vercel/otel` para spans HTTP.
- **Prometheus**: exponer `/api/metrics` (pendiente; usar `prom-client` cuando se monte gateway).

## Backups

- Supabase ofrece backups diarios automáticos en plan Pro+.
- Adicionalmente, snapshots de la tabla `pbi_snapshots_daily` permiten reconstruir tendencias.
- Para datos de archivo, replicar bucket Storage a S3 vía Edge Function semanal.

## Despliegue manual rápido

```bash
# Aplicar migraciones (con CLI Supabase logueada)
supabase db push

# Deploy a Vercel preview
vercel

# Deploy a producción
vercel --prod
```

## Health checks

`GET /api/health` (pendiente; recomendado: verifica DB ping y modelo IA disponible) → 200 / 503.
