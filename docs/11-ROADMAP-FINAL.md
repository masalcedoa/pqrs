# 11 — Roadmap final consolidado

Estado real del repositorio tras esta entrega. Marca `[x]` lo completado, `[~]` lo cimentado pendiente de cierre, `[ ]` lo que queda por hacer.

## Fundación

- [x] Esqueleto Next.js + Tailwind + TS (fase previa).
- [x] Migraciones SQL 0001–0011 (fase previa).
- [x] Migraciones SQL 0012–0020 (multitenant, workflow, WO v2, RAG, notif v2, security, documental, PBI enterprise, RLS multitenant).
- [x] Tests Vitest configurados con cobertura.
- [x] CI GitHub Actions (lint + typecheck + test + build).
- [x] CD: migraciones Supabase + Vercel.

## Multitenant

- [x] Tablas `organizations`, `org_members`, `plans`.
- [x] Retrofit `org_id` en tablas operativas + índices.
- [x] Helpers `current_org_id()`, `fn_user_in_org()`, `fn_can_bypass_org()`.
- [x] RLS por org en todas las tablas operativas.
- [x] `src/lib/tenant/context.ts` resuelve tenant por subdominio/header/cookie/membresía.
- [x] Branding dinámico vía CSS variables.
- [x] API `POST /api/orgs` para crear organización con admin inicial.
- [ ] Selector de tenant en backoffice (UI).
- [ ] Aplicación de límites de plan (use-case `application/limits.ts`).
- [ ] Subdominios automáticos en Vercel.

## Workflow / BPM Engine

- [x] Tabla `workflow_definitions` versionada + seed por defecto.
- [x] Tablas `case_timeline`, `case_approvals`, `case_comments`, `case_reminders`.
- [x] Motor TS `WorkflowEngine` con validación de transición, fields, roles y reglas.
- [x] Catálogo de reglas (`within_reposition_window`, `has_supervisor_approval`, etc.).
- [x] Side-effects implementados: acuse, request_info, create_work_order, dispatch_response, schedule_reposition_window, sspd_webhook, mark_overdue.
- [x] Caso de uso `transitionCase` con persistencia + timeline + side-effects.
- [x] API `POST /api/pqrs/[id]/transition` y `GET` para listar transiciones disponibles.
- [x] Tests (8 escenarios).
- [ ] Editor visual de workflows (UI admin).
- [ ] Versionado/migración de definiciones en caliente.

## Dashboard operativo enterprise

- [x] KPI grid animado (framer-motion).
- [x] AgingChart (recharts).
- [x] ProductivityChart 30 días (snapshot histórico).
- [x] SlaHeatmap por área × causal.
- [x] CaseQueueTable (TanStack Table) con sort + filter.
- [x] WorkOrderMap por municipios (clusters textuales).
- [x] Tabs (cola / SLA / órdenes).
- [x] Detalle PQRS con timeline, comentarios, órdenes, aprobaciones, panel de transición.
- [ ] Reemplazar WorkOrderMap por Leaflet/MapLibre real.
- [ ] Exportación PDF del dashboard.

## Órdenes internas

- [x] Migración `0014_work_orders_v2.sql` con geo, checklist, signature, fotos.
- [x] Plantillas de checklist por tipo de OT (seed).
- [x] API `POST /api/work-orders` con plantilla automática por tipo.
- [x] Página listado `/ordenes`.
- [ ] Página detalle OT con checklist interactivo + captura de foto + firma.
- [ ] App móvil técnico (PWA).
- [ ] Geolocalización en captura.

## IA avanzada

- [x] RAG migrations (`0015_rag_enhanced.sql`): corpora, full-text, índices trigram, `fn_rag_hybrid_search`.
- [x] Chunker (`chunkText`) con secciones.
- [x] Embedder (`embedBatch`, `embedOne`).
- [x] Retriever híbrido + bitácora `rag_query_log`.
- [x] Definición de tools (`crear_radicado`, `validar_cuenta`, ...).
- [x] Clasificador multi-label con riesgo regulatorio y de fraude.
- [x] Evaluador de fraude (`assessFraud`).
- [x] Guardrails: prompt-injection + PII masking + abuse_signals.
- [ ] Ingestor de documentos normativos (Edge Function `ingest-rag`).
- [ ] Tool-routing en `/api/ai/chat` (function calling completo).
- [ ] Memoria conversacional persistida por sesión.

## Seguridad

- [x] Migración `0017_security.sql`: rate_limit_buckets, abuse_signals, encrypted_documents, pii_patterns.
- [x] Middleware Next.js con cabeceras WAF (CSP, HSTS, etc.).
- [x] Rate limit token bucket en Postgres.
- [x] Función `recordAbuse`.
- [ ] Cifrado simétrico real de documentos sensibles con KMS.
- [ ] Tests RLS por rol (suite automatizada).
- [ ] SIEM forwarding de `audit_log` + `abuse_signals`.

## Notificaciones

- [x] Plantillas multicanal (`notification_templates`) + seed.
- [x] Cola con `attempts`, `locked_until`, `scheduled_at`, backoff exponencial.
- [x] Tabla `notification_attempts` para trazabilidad.
- [x] Dispatcher con providers Email (Resend), WhatsApp (Meta), SMS (stub).
- [x] Endpoint cron `/api/notifications/dispatch` (5 min).
- [ ] Push notifications (web push API).
- [ ] Webhooks de delivery/read receipts.

## Power BI

- [x] 21 vistas SQL ya existentes (fase previa).
- [x] Snapshots históricos diarios (`pbi_snapshots_daily`).
- [x] Vistas aging + SLA por causal.
- [x] Función `fn_pbi_snapshot` + cron diario.
- [x] Endpoint signed-token `/api/powerbi/[metric]` (JSON) y `/api/powerbi/export` (CSV).
- [ ] Exportación Parquet (requiere worker externo o Supabase Functions con DuckDB).
- [ ] Power BI Embedded con SSO Azure AD.

## Documental

- [x] `document_versions`, `ocr_jobs`, `generated_pdfs`.
- [ ] Generador real de PDFs (puppeteer/playwright en Edge runtime no soportado → usar @react-pdf/renderer en Node runtime).
- [ ] Worker OCR (Tesseract o Vision API).
- [ ] Firma electrónica certificada (integración con proveedor PSE).

## DevOps

- [x] Dockerfile multi-stage.
- [x] docker-compose con Supabase Postgres local.
- [x] CI: lint + typecheck + test + build.
- [x] CD: migraciones Supabase + Vercel.
- [x] `vercel.json` con 3 crons.
- [x] Logger estructurado JSON-line.
- [ ] OpenTelemetry instrumentation completa.
- [ ] Dashboards Grafana.

## Métricas de aceptación (definidas como objetivo)

- TMR ≤ 10 días hábiles.
- % casos vencidos < 2%.
- % efectividad respuesta (sin recurso) ≥ 90%.
- Adopción IA radicación ≥ 50%.
- p95 API < 400ms; p95 chat IA < 4s.
- Disponibilidad mensual ≥ 99.9%.
