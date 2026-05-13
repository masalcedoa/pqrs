# 07 — Multitenant SaaS

## Estrategia

- Modelo elegido: **shared database, shared schema, discriminator column** (`org_id`).
- Aislamiento garantizado por RLS basada en `org_members.user_id = auth.uid()`.
- Cada request resuelve un `current_org_id` que se setea en GUC `app.current_org` para que las funciones RLS lo lean (sin depender solo del JWT, para permitir cambio de tenant en runtime).

## Resolución del tenant activo

Prioridad:

1. Subdominio (`empresa-a.app.com` → `slug = empresa-a`).
2. Header `x-org` (clientes internos / Power BI).
3. Cookie `app_org` (selector de tenant en backoffice).
4. Si el usuario es miembro de **una sola** org, esa.

Si nada resuelve y la ruta no es pública, se devuelve `403`.

## Planes (tabla `plans`)

| Plan        | Casos/mes | Usuarios | RAG MB | IA tokens/mes | Power BI | Soporte |
|-------------|-----------|----------|--------|----------------|----------|---------|
| Starter     | 500       | 5        | 50     | 1M             | sí       | email   |
| Pro         | 5.000     | 25       | 500    | 10M            | sí       | email + chat |
| Enterprise  | ilimitado | ilimitado| 5GB    | negociado      | sí + dedicated | telefónico |

Los límites se chequean en `application/limits.ts` antes de ejecutar el caso de uso.

## Branding

`organizations.branding` JSON:

```json
{
  "logo_url": "https://...",
  "primary_color": "#1f6feb",
  "primary_color_dark": "#13469a",
  "domain": "empresa-a.app.com",
  "support_email": "pqrs@empresa-a.co",
  "default_lang": "es",
  "legal": {
    "razon_social": "Empresa A S.A. E.S.P.",
    "nit": "900.123.456-1",
    "ccu_url": "https://empresa-a.co/ccu.pdf"
  }
}
```

El layout principal lee este JSON server-side y aplica:

```css
:root {
  --brand: <primary_color>;
  --brand-dark: <primary_color_dark>;
}
```

## Onboarding de un tenant

1. POST `/api/orgs` (rol `superadmin`) — crea organización, plan y dominio.
2. Crea `org_members` para el primer admin.
3. Carga plantillas y términos legales por defecto (clonados del catálogo global).
4. Crea bucket lógico (prefijo `org/<id>/...` dentro de los buckets compartidos).
5. (Opcional) configura provider de notificaciones por org.

## Cross-tenant (super-admin)

- Rol `superadmin` puede leer todas las orgs (sin `org_id` filtro) **solo** desde rutas `/admin/*`.
- La función RLS `fn_can_bypass_org()` devuelve `true` cuando `current_setting('app.bypass_org','t') = 'true'`. Solo el service role lo activa con autorización explícita.
