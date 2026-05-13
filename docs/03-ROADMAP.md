# 03 — Roadmap por fases (backlog)

## Fase 0 — Fundación (Sprint 0–1, ~2 sem)

- [x] Esqueleto Next.js + Tailwind + TS.
- [x] Migraciones SQL iniciales (extensiones, enums, núcleo, PQRS, workflow, IA/auditoría, índices, triggers, vistas Power BI, RLS, seeds).
- [ ] Crear proyecto Supabase (dev/prod) y aplicar migraciones.
- [ ] Configurar Auth (email magic link, recuperación, OAuth opcional).
- [ ] Configurar buckets de Storage: `pqrs-adjuntos`, `respuestas`, `normativa`.
- [ ] Variables de entorno en Vercel y secretos en Supabase.

## Fase 1 — Radicación ciudadana (Sprint 2–3, ~3 sem)

- [x] Portal público (`/radicar`) con formulario completo.
- [x] Chat IA público con clasificación automática.
- [x] API `POST /api/pqrs` con clasificación IA + creación de caso.
- [ ] Consulta de radicado por correo + número (`/consultar/[radicado]`).
- [ ] Adjuntos en Storage con URL firmadas.
- [ ] Acuse de recibo por email/WhatsApp.

## Fase 2 — Backoffice operativo (Sprint 4–6, ~5 sem)

- [x] Dashboard con KPIs principales.
- [ ] Listado y detalle de PQRS con filtros y paginación.
- [ ] Bandejas por área y por usuario.
- [ ] Reasignación y cambios de estado con motivo obligatorio.
- [ ] Notas internas vs. mensajes al ciudadano.
- [ ] Tareas internas (`pqrs_tasks`) con checklist por causal.
- [ ] Plantillas de respuesta + redacción asistida IA.
- [ ] Aprobación supervisor antes de notificar.

## Fase 3 — Órdenes internas y técnico (Sprint 7–8, ~4 sem)

- [ ] Creación de órdenes (revisión facturación, visita técnica, inspección medidor, suspensión, reconexión, revisión lectura, ajuste comercial, análisis jurídico).
- [ ] App móvil web responsive para técnico (cuaderno de visita).
- [ ] Subida de evidencias fotográficas geolocalizadas.
- [ ] Cierre de orden alimenta la respuesta al usuario.

## Fase 4 — Recursos y SSPD (Sprint 9–10, ~3 sem)

- [ ] Flujo de recurso de reposición y subsidiario de apelación.
- [ ] Cálculo automático de términos para interposición.
- [ ] Generación del expediente exportable para SSPD.
- [ ] Webhook saliente a SSPD (placeholder a configurar).

## Fase 5 — RAG y agente IA avanzado (Sprint 11–12, ~3 sem)

- [ ] Ingesta de normativa (Ley 142/94, CREG 108/97, resoluciones SSPD, CCU, manuales internos).
- [ ] Chunking + embeddings → `knowledge_base_chunks`.
- [ ] Tool `consultar_normativa` para el agente.
- [ ] Aprendizaje supervisado a partir de respuestas humanas validadas.

## Fase 6 — Reportería y auditoría (Sprint 13, ~2 sem)

- [x] Vistas SQL para Power BI (19 KPIs).
- [ ] Refresco programado de `mv_powerbi_metrics`.
- [ ] Tablero ejecutivo embebido (Power BI Embedded o iframe).
- [ ] Reportes regulatorios SSPD periódicos.

## Fase 7 — Endurecimiento (Sprint 14, ~2 sem)

- [ ] Pruebas E2E (Playwright) de los flujos críticos.
- [ ] Pruebas de carga.
- [ ] Revisión RLS por rol con casos negativos.
- [ ] Política de retención de datos personales (Ley 1581).
- [ ] DRP/Backups verificados.

## Indicadores objetivo

- TMR (tiempo medio de respuesta) ≤ 10 días hábiles.
- % casos vencidos < 2%.
- % casos resueltos sin recurso (efectividad) ≥ 90%.
- Adopción IA en radicación: ≥ 50% de PQRS por canal portal con chat.
