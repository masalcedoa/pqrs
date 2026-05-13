-- 0013_workflow.sql
-- Motor BPM: definiciones, timeline, comentarios, aprobaciones.

create table if not exists workflow_definitions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id),  -- null = catálogo global
  name        text not null,
  version     int  not null,
  is_active   boolean not null default true,
  body        jsonb not null,                     -- estados, transiciones, reglas
  created_by  uuid references users_profile(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name, version)
);

create type timeline_event as enum (
  'created','transition','assignment','comment','attachment',
  'reminder','ai_suggestion','notification','approval_request',
  'approval_decision','order_created','order_updated','overdue','reopened'
);

create table if not exists case_timeline (
  id         bigserial primary key,
  case_id    uuid not null references pqrs_cases(id) on delete cascade,
  org_id     uuid references organizations(id),
  event_type timeline_event not null,
  actor_id   uuid references users_profile(id),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_timeline_case on case_timeline(case_id, created_at);
create index if not exists ix_timeline_org  on case_timeline(org_id, created_at desc);
create index if not exists ix_timeline_type on case_timeline(event_type, created_at desc);

create type approval_decision as enum ('pendiente','aprobado','rechazado');

create table if not exists case_approvals (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references pqrs_cases(id) on delete cascade,
  org_id        uuid references organizations(id),
  required_role user_role not null,
  reason        text,
  decision      approval_decision not null default 'pendiente',
  decided_by    uuid references users_profile(id),
  decision_note text,
  created_by    uuid references users_profile(id),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create index if not exists ix_approvals_case on case_approvals(case_id);
create index if not exists ix_approvals_pending on case_approvals(decision)
  where decision = 'pendiente';

create table if not exists case_comments (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references pqrs_cases(id) on delete cascade,
  org_id      uuid references organizations(id),
  author_id   uuid references users_profile(id),
  is_internal boolean not null default true,
  body        text not null,
  mentions    uuid[],                            -- usuarios mencionados
  created_at  timestamptz not null default now()
);

create index if not exists ix_comments_case on case_comments(case_id, created_at);

-- Recordatorios programados (vencimiento, reposición, etc.)
create table if not exists case_reminders (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references pqrs_cases(id) on delete cascade,
  org_id      uuid references organizations(id),
  fire_at     timestamptz not null,
  kind        text not null,                      -- 'due_soon','reposition_window','sspd_window'
  payload     jsonb default '{}'::jsonb,
  fired_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists ix_reminders_fire on case_reminders(fire_at)
  where fired_at is null;

------------------------------------------------------------
-- Seed: definición de workflow PQRS por defecto (global)
------------------------------------------------------------
insert into workflow_definitions(org_id, name, version, body)
values (null, 'pqrs_default', 1, jsonb_build_object(
  'initial','radicado',
  'terminal', jsonb_build_array('cerrado','vencido'),
  'transitions', jsonb_build_array(
    jsonb_build_object('from','radicado','to','en_validacion',
      'roles_allowed', jsonb_build_array('agente','analista','supervisor','admin'),
      'auto_side_effects', jsonb_build_array('notify_acknowledgement')),
    jsonb_build_object('from','en_validacion','to','clasificado',
      'roles_allowed', jsonb_build_array('agente','analista','supervisor','admin'),
      'requires_fields', jsonb_build_array('type','category')),
    jsonb_build_object('from','clasificado','to','asignado',
      'roles_allowed', jsonb_build_array('supervisor','admin','agente'),
      'requires_fields', jsonb_build_array('assigned_unit_id')),
    jsonb_build_object('from','asignado','to','en_analisis',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin')),
    jsonb_build_object('from','en_analisis','to','pendiente_informacion',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin'),
      'auto_side_effects', jsonb_build_array('notify_request_info')),
    jsonb_build_object('from','pendiente_informacion','to','en_analisis',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin','agente')),
    jsonb_build_object('from','en_analisis','to','orden_generada',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin'),
      'auto_side_effects', jsonb_build_array('create_work_order')),
    jsonb_build_object('from','orden_generada','to','en_visita_tecnica',
      'roles_allowed', jsonb_build_array('tecnico','supervisor','admin')),
    jsonb_build_object('from','en_visita_tecnica','to','en_analisis',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin','tecnico')),
    jsonb_build_object('from','en_analisis','to','en_revision_comercial',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin')),
    jsonb_build_object('from','en_revision_comercial','to','en_analisis',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin')),
    jsonb_build_object('from','en_analisis','to','en_revision_juridica',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin','juridico')),
    jsonb_build_object('from','en_revision_juridica','to','en_analisis',
      'roles_allowed', jsonb_build_array('juridico','supervisor','admin')),
    jsonb_build_object('from','en_analisis','to','respuesta_proyectada',
      'roles_allowed', jsonb_build_array('analista','supervisor','admin','juridico'),
      'requires_fields', jsonb_build_array('resolution_text')),
    jsonb_build_object('from','respuesta_proyectada','to','notificado',
      'roles_allowed', jsonb_build_array('supervisor','admin'),
      'requires_approval','supervisor',
      'auto_side_effects', jsonb_build_array('dispatch_response','schedule_reposition_window')),
    jsonb_build_object('from','notificado','to','resuelto',
      'roles_allowed', jsonb_build_array('supervisor','admin')),
    jsonb_build_object('from','notificado','to','en_recurso_reposicion',
      'roles_allowed', jsonb_build_array('ciudadano','agente','analista','admin'),
      'rules', jsonb_build_array('within_reposition_window')),
    jsonb_build_object('from','en_recurso_reposicion','to','respuesta_proyectada',
      'roles_allowed', jsonb_build_array('juridico','supervisor','admin')),
    jsonb_build_object('from','en_recurso_reposicion','to','en_apelacion',
      'roles_allowed', jsonb_build_array('juridico','admin')),
    jsonb_build_object('from','en_apelacion','to','escalado_sspd',
      'roles_allowed', jsonb_build_array('juridico','admin'),
      'auto_side_effects', jsonb_build_array('sspd_webhook')),
    jsonb_build_object('from','resuelto','to','cerrado',
      'roles_allowed', jsonb_build_array('supervisor','admin')),
    jsonb_build_object('from','escalado_sspd','to','cerrado',
      'roles_allowed', jsonb_build_array('juridico','admin'))
  )
))
on conflict do nothing;
