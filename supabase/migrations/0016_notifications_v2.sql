-- 0016_notifications_v2.sql
-- Plantillas multi-canal, cola robusta con reintentos y tracking.

create table if not exists notification_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id),
  code        text not null,
  name        text not null,
  channel     notification_channel not null,
  subject     text,                              -- aplica a email
  body        text not null,                     -- markdown / texto con {{vars}}
  variables   text[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code, channel)
);

-- Agregar campos de tracking a notifications
alter table notifications
  add column if not exists template_id  uuid references notification_templates(id),
  add column if not exists payload      jsonb default '{}'::jsonb,
  add column if not exists scheduled_at timestamptz default now(),
  add column if not exists locked_until timestamptz,
  add column if not exists last_error   text;

create table if not exists notification_attempts (
  id              bigserial primary key,
  notification_id uuid not null references notifications(id) on delete cascade,
  org_id          uuid references organizations(id),     -- requerido por RLS multitenant en 0020
  attempted_at    timestamptz not null default now(),
  status          notification_status not null,
  provider        text,
  provider_response jsonb,
  latency_ms      int
);

create index if not exists ix_notif_scheduled on notifications(scheduled_at)
  where status = 'pendiente';

------------------------------------------------------------
-- Seed plantillas básicas multicanal
------------------------------------------------------------
insert into notification_templates(org_id, code, name, channel, subject, body, variables) values
  (null, 'ACUSE_RECIBO', 'Acuse de recibo (email)', 'email', 'Acuse de recibo PQRS {{radicado}}',
   $$Estimado/a {{nombre}},

Confirmamos la recepción de su PQRS con radicado **{{radicado}}** el día {{fecha}}.
Daremos respuesta dentro del término legal de {{dias}} días hábiles.

Atentamente,
{{empresa}}$$,
   array['radicado','nombre','fecha','dias','empresa']),

  (null, 'ACUSE_RECIBO', 'Acuse de recibo (WhatsApp)', 'whatsapp', null,
   'Hola {{nombre}}, confirmamos recepción de su PQRS {{radicado}}. Le responderemos en {{dias}} días hábiles. — {{empresa}}',
   array['radicado','nombre','dias','empresa']),

  (null, 'RESPUESTA_NOTIFICADA', 'Respuesta notificada (email)', 'email', 'Respuesta a su PQRS {{radicado}}',
   $$Estimado/a {{nombre}},

Hemos resuelto su PQRS {{radicado}}. Adjuntamos la respuesta. Si no está de acuerdo, puede interponer **recurso de reposición y subsidiario de apelación** dentro de los 5 días hábiles siguientes a esta notificación.

Atentamente,
{{empresa}}$$,
   array['radicado','nombre','empresa']),

  (null, 'PROXIMO_VENCER', 'Próximo a vencer (email)', 'email', 'PQRS {{radicado}} próxima a vencer',
   'El caso {{radicado}} asignado a {{analista}} vence el {{fecha_limite}}. Revíselo.',
   array['radicado','analista','fecha_limite'])
on conflict do nothing;
