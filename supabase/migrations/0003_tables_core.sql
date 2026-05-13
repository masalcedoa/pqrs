-- 0003_tables_core.sql
-- Tablas núcleo: perfiles, clientes, cuentas, medidores, festivos

-- Unidades organizacionales (áreas)
create table if not exists organizational_units (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  name         text not null,
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Perfil de usuario: 1:1 con auth.users
create table if not exists users_profile (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  document_type text check (document_type in ('CC','CE','NIT','TI','PA')),
  document_id   text,
  phone         text,
  role          user_role not null default 'ciudadano',
  unit_id       uuid references organizational_units(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (document_type, document_id)
);

-- Clientes (suscriptores del servicio; pueden o no ser usuarios del sistema)
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  kind          customer_kind not null default 'persona_natural',
  document_type text not null check (document_type in ('CC','CE','NIT','TI','PA')),
  document_id   text not null,
  full_name     text not null,
  email         text,
  phone         text,
  user_id       uuid references users_profile(id),
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (document_type, document_id)
);

-- Cuentas contrato del servicio
create table if not exists service_accounts (
  id             uuid primary key default gen_random_uuid(),
  account_number text unique not null,
  customer_id    uuid not null references customers(id) on delete restrict,
  address        text not null,
  municipality   text not null,
  department     text not null default 'Antioquia',
  stratum        smallint check (stratum between 1 and 6),
  tariff_class   text,
  service_status text default 'activo',
  metadata       jsonb default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Medidores
create table if not exists meters (
  id                 uuid primary key default gen_random_uuid(),
  service_account_id uuid not null references service_accounts(id) on delete cascade,
  serial             text unique not null,
  brand              text,
  model              text,
  meter_type         text,
  installation_date  date,
  last_reading_date  date,
  is_active          boolean not null default true,
  metadata           jsonb default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Festivos Colombia (para días hábiles)
create table if not exists holidays_co (
  holiday_date date primary key,
  name         text not null,
  created_at   timestamptz not null default now()
);

comment on table users_profile     is 'Extensión de auth.users con datos de aplicación.';
comment on table customers         is 'Personas o empresas que pueden radicar PQRS.';
comment on table service_accounts  is 'Cuentas contrato (puntos de servicio).';
comment on table meters            is 'Medidores asociados a cuentas.';
comment on table holidays_co       is 'Festivos colombianos para cálculo de días hábiles.';
