# Supabase Edge Functions

Planeadas (a desarrollar en fases siguientes):

- `term-calc` — recálculo diario de `due_at`, marca de `vencido`/`por_vencer`, envío de alertas. Cron: `0 6 * * *` (06:00 hora Bogotá).
- `refresh-mv` — `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_powerbi_metrics`. Cron: cada hora.
- `notify-dispatch` — toma `notifications` con `status='pendiente'` y las envía por proveedor.
- `ingest-rag` — procesa documentos de bucket `normativa` y genera embeddings en `knowledge_base_chunks`.
- `sspd-escalate` — webhook saliente cuando un caso pasa a `escalado_sspd`.

Cada función usa `SUPABASE_SERVICE_ROLE_KEY` desde secrets de Supabase. **Nunca exponer al cliente.**
