-- 0017_security.sql
-- Rate limiting, señales de abuso, intentos de prompt injection, masking PII, documentos cifrados.

create table if not exists rate_limit_buckets (
  bucket_key  text primary key,                  -- ej: 'ip:1.2.3.4:radicar'
  tokens      int  not null,
  capacity    int  not null,
  refill_rate numeric not null,                  -- tokens/segundo
  updated_at  timestamptz not null default now()
);

create table if not exists abuse_signals (
  id          bigserial primary key,
  org_id      uuid references organizations(id),
  user_id     uuid references users_profile(id),
  ip          inet,
  signal      text not null,                     -- 'prompt_injection','rate_limit','sql_pattern','xss_pattern'
  severity    text not null default 'low',       -- low|medium|high|critical
  context     jsonb not null default '{}'::jsonb,
  blocked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists ix_abuse_org on abuse_signals(org_id, created_at desc);
create index if not exists ix_abuse_signal on abuse_signals(signal, severity);

-- Documentos cifrados a nivel aplicación (clave por org)
create table if not exists encrypted_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id),
  case_id      uuid references pqrs_cases(id) on delete cascade,
  kind         text not null,                    -- 'response_pdf','dictamen','soporte_legal'
  bucket       text not null,
  storage_path text not null,
  enc_key_hash text not null,                    -- KMS key id (sin guardar la clave)
  iv           bytea not null,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

-- Masking de PII: catálogo de patrones por organización
create table if not exists pii_patterns (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id),
  name       text not null,
  regex      text not null,
  replacement text not null default '***',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into pii_patterns(name, regex, replacement) values
  ('cedula_10', '\m\d{8,10}\M',          '[DOC]'),
  ('telefono_co', '\m3\d{9}\M',          '[TEL]'),
  ('email', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL]'),
  ('cuenta_contrato', '\mCC\d{4,}\M',    '[CTA]')
on conflict do nothing;
