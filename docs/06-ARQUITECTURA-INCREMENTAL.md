# 06 — Arquitectura incremental (Fase 2 del producto)

Este documento describe lo que se añade encima de las fases 1–4 ya entregadas. **No** reemplaza los documentos `01..05`; los extiende.

## Cambios estructurales

### 1. Multitenant

- Se introduce el agregado `organizations` y la relación `org_members(user_id, org_id, role)`.
- **Toda** tabla operativa adquiere `org_id uuid not null references organizations(id)`.
- RLS se reescribe (`0020_rls_multitenant.sql`) para que `auth.uid()` solo vea filas de sus organizaciones (`current_org_id()`).
- El JWT incluye un claim `org_id` (selección de tenant activo).
- El portal público radica en una org concreta (la resuelve por subdominio o por slug en la URL).

### 2. Workflow engine

- Se reemplazan las transiciones implícitas (hard-coded en triggers) por un motor declarativo:
  - `workflow_definitions(version, body_jsonb)` — un grafo de estados, transiciones y reglas.
  - `case_timeline` — eventos (transición, comentario, asignación, recordatorio, IA, vencimiento) por caso.
  - `case_approvals` — aprobaciones requeridas (supervisor, jurídico) antes de ciertas transiciones.
- El motor (`src/lib/workflow/engine.ts`) valida invariantes por rol y dispara *side-effects* (notificaciones, órdenes).

### 3. Arquitectura DDD-light

```
src/
├── domain/                # entidades, value objects, eventos del dominio
│   ├── pqrs/              # PqrsCase, Radicado, ServiceAccountRef, statuses
│   ├── work-order/        # WorkOrder, OrderType, OrderStatus
│   ├── workflow/          # WorkflowDefinition, Transition, Rule
│   ├── tenant/            # Organization, Membership
│   └── shared/            # Result, AppError, DomainEvent
├── application/           # casos de uso, puertos
│   ├── pqrs/use-cases/
│   ├── work-order/use-cases/
│   ├── workflow/services/
│   └── ports/             # interfaces de repos y servicios
├── infrastructure/        # adaptadores
│   ├── supabase/          # repos concretos, mappers
│   ├── tenant/            # tenant context, branding
│   ├── notifications/     # providers email, wa, sms
│   ├── observability/     # logger, telemetría
│   └── ai/                # cliente Claude/OpenAI, rag
└── interfaces/            # entry points (rutas y componentes Next.js)
    ├── api/               # /api routes lo importan
    ├── pages/             # /app/(dashboard) lo importa
    └── components/
```

Las rutas `src/app/**` y los componentes `src/components/**` siguen existiendo (Next.js los exige donde están) y consumen casos de uso de `src/application` a través de los puertos.

## Frontera de consistencia

- **Una transacción Supabase = una operación del dominio.** Si un caso de uso necesita mutar varias tablas, lo hace vía función Postgres `rpc` o en una sola llamada al cliente con `supabase.rpc('fn_*')`.
- Los eventos (`case_timeline.event_type`) son la única fuente de verdad histórica. Reportes y auditoría parten de allí.

## Observabilidad

- Logger estructurado (`src/infrastructure/observability/logger.ts`) con JSON por línea.
- Telemetría OpenTelemetry opcional (env `OTEL_EXPORTER_OTLP_ENDPOINT`).
- Sentry para errores de cliente y server.
- Métricas Prometheus expuestas vía `/api/metrics` para scraping interno.

## Seguridad incremental

- Middleware Next.js fija cabeceras WAF (CSP, HSTS, COOP, COEP, Referrer-Policy).
- Rate limiting (token bucket en memoria + Redis opcional).
- Guardrails IA: detección de prompt-injection y masking PII antes de enviar a modelo.
- Tabla `abuse_signals` registra intentos sospechosos.

## Multitenant — branding

- `organizations.branding jsonb` con: logo URL, paleta, dominio, plantillas por defecto, idioma.
- El layout raíz lee el branding del tenant activo y aplica colores vía variables CSS en `:root`.
