# 01 — Arquitectura funcional y técnica

## 1. Objetivos de arquitectura

- Cumplir el marco normativo colombiano de servicios públicos domiciliarios de energía (Ley 142/94, CREG 108/97, lineamientos SSPD).
- Soportar canales múltiples de radicación: portal, chat IA, WhatsApp, email, telefónico y presencial.
- Garantizar el control de **términos legales** (default 15 días hábiles, parametrizable por causal y por existencia de visita técnica).
- Trazabilidad completa: cada cambio de estado y cada interacción con IA quedan auditados.
- Aislamiento por rol vía **RLS de Supabase**.
- Reportería abierta a **Power BI** sin acoplar la lógica operativa.

## 2. Capas

### 2.1 Presentación (Next.js 14 App Router)

- **Portal público** (`/radicar`, `/consultar/[radicado]`): formulario guiado + chat IA embebido.
- **Backoffice** (`/dashboard`, `/pqrs`, `/ordenes`, `/expedientes`, `/notificaciones`, `/admin`): por rol.
- **Dashboards KPI** con datos en vivo.
- Renderizado híbrido: SSR para portal público (SEO + accesibilidad), RSC + Client Components en backoffice.

### 2.2 Aplicación (API Routes + Edge Functions)

Servicios lógicos:

| Servicio              | Responsabilidad                                                              |
|-----------------------|------------------------------------------------------------------------------|
| `pqrs-service`        | CRUD de casos, transiciones de estado, validaciones de negocio.              |
| `classification`      | Clasificar tipo, categoría, causal, prioridad (vía IA + reglas).             |
| `legal-terms`         | Calcular fecha límite, días hábiles, alertas de vencimiento.                 |
| `work-orders`         | Creación, asignación y cierre de órdenes internas.                           |
| `notifications`       | Email, WhatsApp, SMS con plantillas.                                         |
| `ai-agent`            | Orquesta chat, RAG, tools y generación de borradores de respuesta.          |
| `audit`               | Registro inmutable de cambios.                                               |
| `powerbi`             | Endpoints REST autenticados con tokens API key.                              |
| `ingest-rag`          | Procesa documentos normativos, hace chunking + embeddings.                   |

### 2.3 IA

- **Modelo principal**: `claude-opus-4-7` (clasificación crítica, redacción jurídica).
- **Modelo de bajo costo**: `claude-haiku-4-5` (chat ciudadano, extracción de entidades).
- **Embeddings**: OpenAI `text-embedding-3-small` (configurable) → `pgvector`.
- **RAG**: tabla `knowledge_base_chunks` con `embedding vector(1536)`, índice `ivfflat` o `hnsw`.
- **Tools del agente** (function calling):
  - `crear_radicado(payload)`
  - `validar_cuenta(numero_cuenta)`
  - `consultar_estado_caso(radicado)`
  - `sugerir_clasificacion(texto)`
  - `sugerir_orden_interna(case_id)`
  - `consultar_normativa(consulta, top_k)`
  - `redactar_respuesta(case_id, template_id?)`
- Cada interacción se registra en `ai_interactions` con prompt, respuesta, modelo, tokens, costo estimado, latencia y referencia al caso.

### 2.4 Datos

- PostgreSQL 15+ administrado por Supabase.
- 20 tablas principales + catálogos de festivos colombianos + enums.
- **Triggers**:
  - cálculo automático de `fecha_limite` al crear o reclasificar caso;
  - `audit_log` genérico vía trigger por tabla;
  - actualización de `updated_at`;
  - generación de número de radicado (formato `PQRS-YYYY-NNNNNNN`).
- **Vistas materializadas** para los 19 KPI de Power BI con refresco programado.

### 2.5 Integraciones

- **Email**: Resend o AWS SES (plantillas en `response_templates`).
- **WhatsApp**: Meta Cloud API o Twilio.
- **SSPD**: webhook saliente con payload normalizado al escalar caso (parametrizable; placeholder hasta que se publiquen credenciales reales).
- **Sistema de facturación legacy**: lectura vía vista/endpoint para validar cuenta, dirección, medidor y consumo.
- **Power BI**: vía API REST o ODBC directo a Supabase con usuario de solo lectura.

## 3. Roles y RLS

| Rol         | Alcance de lectura                            | Alcance de escritura                                |
|-------------|-----------------------------------------------|-----------------------------------------------------|
| ciudadano   | solo sus propios casos (`customer_id = self`) | crear caso, agregar mensaje/adjunto a sus casos     |
| agente      | casos en cola de su área                      | clasificar, registrar mensaje, transferir           |
| analista    | casos asignados a su unidad                   | analizar, crear orden, proyectar respuesta          |
| supervisor  | todos los casos de su unidad                  | reasignar, aprobar respuestas, decidir recursos     |
| juridico    | casos con clasificación jurídica o recurso    | dictamen, recurso, escalamiento SSPD                |
| tecnico     | órdenes técnicas asignadas                    | actualizar `work_order_updates`                     |
| admin       | todo                                          | todo, incluyendo plantillas y términos              |
| auditor     | todo (lectura)                                | nada                                                |

## 4. Seguridad

- RLS en cada tabla con políticas por `auth.uid()` y rol (claim en JWT).
- Encriptación TLS y en reposo (Supabase).
- Tokens API Power BI con `api_keys` (tabla con `hash` + `scope` + `expires_at`).
- Adjuntos en Storage con URLs firmadas (TTL 5–15 min).
- Cumplimiento Ley 1581/2012 (Habeas Data Colombia): consentimiento explícito al radicar, política de retención, derecho de supresión.

## 5. Despliegue

- **Vercel**: dos entornos (`preview` por PR, `production` por `main`).
- **Supabase**: project ref por entorno; migraciones versionadas en `supabase/migrations`.
- **Edge Functions** para tareas largas o sensibles (notificaciones masivas, ingest RAG).
- **Cron** (Vercel Cron o `pg_cron`): cálculo diario de vencimientos, refresco de vistas materializadas, recordatorios.

## 6. Observabilidad

- Logs de aplicación en Vercel + Supabase logs.
- Métricas IA: tokens, latencia y costo por interacción (en `ai_interactions`).
- Alertas operativas: porcentaje de casos próximos a vencer (umbral configurable).
