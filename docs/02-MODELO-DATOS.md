# 02 — Modelo de datos

## Diagrama lógico

```
                       ┌────────────────┐
                       │  users_profile │ (auth.users.id PK)
                       └───────┬────────┘
                               │
                               │ creado_por / asignado_a
                               ▼
┌────────────┐   ┌────────────────────┐   ┌──────────────────────┐
│ customers  │──<│  pqrs_cases         │>──│ pqrs_classifications │
└─────┬──────┘   │  (radicado único)   │   └──────────────────────┘
      │          │                     │
      │          ├────< pqrs_messages   │
      │          ├────< pqrs_attachments│
      │          ├────< pqrs_status_history
      │          ├────< pqrs_tasks      │
      │          ├────< work_orders ─< work_order_updates
      │          ├────< notifications   │
      │          └────< ai_interactions │
      │
      ▼
┌──────────────────┐   ┌────────┐
│ service_accounts │──<│ meters │
└──────────────────┘   └────────┘

Catálogos:
  legal_terms · response_templates · regulatory_documents
  knowledge_base_chunks (con embedding vector)
  holidays_co · api_keys · audit_log · powerbi_metrics (mview)
```

## Tablas

### users_profile

Extiende `auth.users` con datos de aplicación.

| Columna       | Tipo              | Notas                                 |
|---------------|-------------------|---------------------------------------|
| id            | uuid PK FK→auth.users | igual a `auth.uid()`              |
| full_name     | text              |                                       |
| document_type | text              | CC, CE, NIT, TI, PA                   |
| document_id   | text              | único                                 |
| phone         | text              |                                       |
| role          | user_role         | enum                                  |
| unit_id       | uuid              | área/unidad organizacional            |
| is_active     | boolean default true |                                    |
| created_at, updated_at | timestamptz |                                  |

### customers

Personas o empresas que pueden radicar PQRS (pueden o no tener `users_profile`).

### service_accounts

Cuenta contrato, dirección de prestación del servicio, tarifa, estrato, municipio.

### meters

Medidor asociado a la cuenta (serial, marca, tipo, fecha instalación).

### pqrs_cases

Encabezado del expediente. Incluye:

- `radicado` (texto único, formato `PQRS-YYYY-NNNNNNN`),
- `customer_id`, `service_account_id`, `meter_id` (nullable),
- `channel`, `type`, `category`, `subcategory`, `causal`,
- `priority`, `status`,
- `assigned_unit_id`, `assigned_to`,
- `received_at`, `legal_term_days`, `due_at`, `closed_at`,
- `summary`, `narrative` (texto libre del ciudadano),
- `metadata jsonb` (datos del canal, IP, user agent, geo),
- `parent_case_id` (para recursos sobre un caso previo).

### pqrs_messages

Mensajes del expediente (ciudadano ↔ empresa), incluye notas internas (`is_internal`).

### pqrs_attachments

Adjuntos en Supabase Storage; guarda `bucket`, `path`, `mime`, `size`, `uploaded_by`.

### pqrs_classifications

Histórico de clasificaciones (auto vs. manual, confianza, modelo).

### pqrs_status_history

Toda transición de estado con motivo y autor.

### pqrs_tasks

Tareas internas asociadas al caso (checklist del analista).

### work_orders

Órdenes operativas con `type` (revisión facturación, visita técnica, etc.), `status`, `due_at`, `assigned_to`.

### work_order_updates

Bitácora de la orden con resultados y adjuntos.

### legal_terms

Catálogo parametrizable de términos legales: `category`, `subcategory`, `causal`, `requires_visit`, `days_business`, `legal_basis` (texto con referencia normativa).

### response_templates

Plantillas de respuesta con variables (`{{cliente.nombre}}`, `{{caso.radicado}}`...).

### regulatory_documents

Documentos normativos cargados: Ley 142/94, CREG 108/97, resoluciones SSPD, CCU, manuales internos.

### knowledge_base_chunks

Chunks vectorizados de los documentos anteriores. `embedding vector(1536)`.

### ai_interactions

Cada llamada a un modelo: prompt, respuesta, modelo, tokens, costo, latencia, `case_id` opcional, `user_id`.

### notifications

Envíos multicanal con estado, intentos, proveedor y respuesta.

### audit_log

Bitácora inmutable: tabla, fila id, operación, payload antes/después, autor, timestamp, ip.

### holidays_co

Días no hábiles colombianos para el cálculo de términos.

### api_keys

Tokens hash de servicios externos (Power BI, integraciones).

### powerbi_metrics

Vista materializada con KPIs agregados para Power BI.

## Convenciones

- Todas las tablas: `id uuid PK default gen_random_uuid()`, `created_at`, `updated_at` con trigger.
- FK con `ON DELETE` controlado (preferentemente `RESTRICT` para datos legales; `CASCADE` solo en hijas operativas como `pqrs_messages`).
- `jsonb` para `metadata` flexible.
- Índices en: `radicado`, `customer_id`, `service_account_id`, `status`, `due_at`, `received_at`, `assigned_to`, `category`, full text en `narrative`.
