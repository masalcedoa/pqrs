-- 0005_tables_workflow.sql
-- Órdenes internas, plantillas y términos legales

create table if not exists work_orders (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references pqrs_cases(id) on delete cascade,
  order_number    text unique,                       -- OT-YYYY-NNNNNNN (trigger)
  type            work_order_type not null,
  status          work_order_status not null default 'creada',
  description     text,
  priority        pqrs_priority not null default 'media',
  assigned_unit_id uuid references organizational_units(id),
  assigned_to     uuid references users_profile(id),
  due_at          timestamptz,
  completed_at    timestamptz,
  result_summary  text,
  metadata        jsonb default '{}'::jsonb,
  created_by      uuid references users_profile(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists work_order_updates (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  status        work_order_status,
  notes         text,
  attachments   jsonb default '[]'::jsonb,
  created_by    uuid references users_profile(id),
  created_at    timestamptz not null default now()
);

-- Catálogo de términos legales (parametrizable por causal)
create table if not exists legal_terms (
  id              uuid primary key default gen_random_uuid(),
  pqrs_type       pqrs_type not null,
  category        pqrs_category,
  subcategory     text,
  causal          text,
  requires_visit  boolean not null default false,
  days_business   int not null default 15,
  legal_basis     text,                              -- referencia normativa
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- NULLS NOT DISTINCT trata los NULL como un valor único, eliminando la necesidad
-- de COALESCE (que con cast de enum a text rompe IMMUTABLE en expresiones de índice).
-- Requiere PostgreSQL 15+ (cumplido: supabase/config.toml fija major_version = 15).
create unique index if not exists legal_terms_uniq
  on legal_terms (pqrs_type, category, subcategory, causal, requires_visit)
  nulls not distinct
  where is_active;

-- Plantillas de respuesta
create table if not exists response_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  pqrs_type   pqrs_type,
  category    pqrs_category,
  subject     text,
  body        text not null,                         -- soporta {{cliente.nombre}}, {{caso.radicado}}, etc.
  is_active   boolean not null default true,
  created_by  uuid references users_profile(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
