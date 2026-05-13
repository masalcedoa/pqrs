-- 0004_tables_pqrs.sql
-- Núcleo PQRS: casos, mensajes, adjuntos, clasificaciones, historial, tareas

-- Secuencia para numeración consecutiva por año (la generación se hace por trigger)
create table if not exists pqrs_sequences (
  year       int primary key,
  last_value int not null default 0
);

create table if not exists pqrs_cases (
  id                  uuid primary key default gen_random_uuid(),
  radicado            text unique,                              -- PQRS-YYYY-NNNNNNN (trigger)
  parent_case_id      uuid references pqrs_cases(id),           -- para recursos
  customer_id         uuid not null references customers(id) on delete restrict,
  service_account_id  uuid references service_accounts(id) on delete restrict,
  meter_id            uuid references meters(id) on delete set null,
  channel             pqrs_channel not null default 'portal',
  type                pqrs_type not null default 'peticion',
  category            pqrs_category,
  subcategory         text,
  causal              text,
  priority            pqrs_priority not null default 'media',
  status              pqrs_status not null default 'radicado',
  assigned_unit_id    uuid references organizational_units(id),
  assigned_to         uuid references users_profile(id),
  created_by          uuid references users_profile(id),
  summary             text,
  narrative           text not null,
  received_at         timestamptz not null default now(),
  legal_term_days     int not null default 15,
  due_at              timestamptz,
  closed_at           timestamptz,
  resolution_text     text,
  metadata            jsonb not null default '{}'::jsonb,
  search_tsv          tsvector,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists pqrs_messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references pqrs_cases(id) on delete cascade,
  author_id   uuid references users_profile(id),
  author_role user_role,
  is_internal boolean not null default false,
  body        text not null,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists pqrs_attachments (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references pqrs_cases(id) on delete cascade,
  message_id   uuid references pqrs_messages(id) on delete set null,
  bucket       text not null default 'pqrs-adjuntos',
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references users_profile(id),
  created_at   timestamptz not null default now()
);

create table if not exists pqrs_classifications (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references pqrs_cases(id) on delete cascade,
  type           pqrs_type,
  category       pqrs_category,
  subcategory    text,
  causal         text,
  priority       pqrs_priority,
  source         text not null check (source in ('manual','ai','rule')),
  confidence     numeric(4,3),
  model          text,
  created_by     uuid references users_profile(id),
  created_at     timestamptz not null default now()
);

create table if not exists pqrs_status_history (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references pqrs_cases(id) on delete cascade,
  from_status  pqrs_status,
  to_status    pqrs_status not null,
  reason       text,
  changed_by   uuid references users_profile(id),
  created_at   timestamptz not null default now()
);

create table if not exists pqrs_tasks (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references pqrs_cases(id) on delete cascade,
  title       text not null,
  description text,
  assigned_to uuid references users_profile(id),
  due_at      timestamptz,
  done_at     timestamptz,
  created_by  uuid references users_profile(id),
  created_at  timestamptz not null default now()
);

comment on table pqrs_cases   is 'Expedientes PQRS. Una fila = un radicado.';
comment on column pqrs_cases.due_at is 'Fecha límite legal calculada por trigger según legal_terms y holidays_co.';
