# 08 — Workflow / BPM Engine

## Decisión

Las transiciones del expediente PQRS se modelan como un **grafo declarativo** persistido en `workflow_definitions(version, body jsonb)`. El motor en TS lo interpreta y aplica validaciones e *side-effects*. Esto permite que **jurídico** o **operaciones** ajusten el flujo (por ejemplo: nuevos pasos para causales específicas) sin redeploys.

## Vocabulario

- **Estado** (`pqrs_status`): nodo del grafo.
- **Transición**: arista dirigida `from → to`, con:
  - `roles_allowed`: roles que pueden ejecutarla.
  - `requires_approval`: rol que debe aprobar.
  - `requires_fields`: campos del caso que deben estar completos.
  - `auto_side_effects`: acciones automáticas (`create_work_order`, `notify`, `schedule_reminder`, etc.).
  - `rules`: reglas adicionales evaluadas en TS (predicados sobre el caso).
- **Definición**: conjunto de transiciones + estado inicial + estados terminales + reglas globales.

## Ejemplo de definición (extracto)

```json
{
  "name": "pqrs_default",
  "version": 1,
  "initial": "radicado",
  "terminal": ["cerrado", "vencido"],
  "transitions": [
    {
      "from": "radicado",
      "to": "en_validacion",
      "roles_allowed": ["agente","analista","supervisor","admin"],
      "auto_side_effects": ["notify_acknowledgement"]
    },
    {
      "from": "en_validacion",
      "to": "clasificado",
      "roles_allowed": ["agente","analista","supervisor","admin"],
      "requires_fields": ["type","category"]
    },
    {
      "from": "clasificado",
      "to": "asignado",
      "roles_allowed": ["supervisor","admin"],
      "requires_fields": ["assigned_unit_id"]
    },
    {
      "from": "en_analisis",
      "to": "orden_generada",
      "roles_allowed": ["analista","supervisor","admin"],
      "auto_side_effects": ["create_work_order"]
    },
    {
      "from": "respuesta_proyectada",
      "to": "notificado",
      "roles_allowed": ["supervisor","admin"],
      "requires_approval": "supervisor",
      "auto_side_effects": ["dispatch_response","schedule_reposition_window"]
    },
    {
      "from": "notificado",
      "to": "en_recurso_reposicion",
      "roles_allowed": ["ciudadano","agente","analista"],
      "rules": ["within_reposition_window"]
    },
    {
      "from": "en_recurso_reposicion",
      "to": "en_apelacion",
      "roles_allowed": ["juridico","admin"]
    },
    {
      "from": "en_apelacion",
      "to": "escalado_sspd",
      "roles_allowed": ["juridico","admin"],
      "auto_side_effects": ["sspd_webhook"]
    }
  ]
}
```

El conjunto completo cubre los 18 estados ya definidos en `pqrs_status`.

## Validaciones de la transición

El motor (`engine.applyTransition`) recibe `(caseSnapshot, toStatus, actor, context)` y ejecuta en orden:

1. ¿Existe transición `from → to` en la definición activa?
2. ¿`actor.role` está en `roles_allowed`?
3. ¿`requires_fields` están todos completos?
4. ¿`requires_approval` cumplido? (consulta `case_approvals`)
5. Reglas TS evaluadas (`within_reposition_window`, `not_terminal`, etc.).
6. Si todo pasa: persiste cambio + escribe `case_timeline` + dispara side-effects.

## Side-effects soportados

| Side-effect                  | Acción                                                          |
|------------------------------|-----------------------------------------------------------------|
| `notify_acknowledgement`     | Cola `notifications` con plantilla `GEN-ACUSE`.                 |
| `create_work_order`          | Crea OT inferida (categoría + `requires_visit`).                |
| `dispatch_response`          | Envía notificación con la respuesta proyectada.                 |
| `schedule_reposition_window` | Inserta recordatorio a 5 días hábiles para vencimiento recurso. |
| `sspd_webhook`               | Encola envío saliente al endpoint SSPD configurado.             |
| `mark_overdue`               | Cambia status a `vencido` y notifica supervisor.                |

## Bitácora

Toda transición exitosa escribe:

- `pqrs_status_history` (compat con lo existente).
- `case_timeline` (event_type=`transition`, payload con from/to/by/reason).

## Reglas TS (registry)

Las reglas se registran en `src/lib/workflow/rules.ts` como predicados puros:

```ts
type Rule = (ctx: WorkflowContext) => RuleResult;
```

El motor solo conoce los nombres; las definiciones se cargan al iniciar.
