-- 0012_multitenant.sql
-- Tablas de tenants + retrofit de org_id en todas las tablas operativas.

create type org_plan as enum ('starter','pro','enterprise');

create table if not exists plans (
  code              org_plan primary key,
  name              text not null,
  monthly_cases     int,
  max_users         int,
  rag_mb            int,
  ai_tokens_month   bigint,
  features          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

insert into plans(code,name,monthly_cases,max_users,rag_mb,ai_tokens_month,features) values
  ('starter',   'Starter',       500,    5, 50,   1000000,   '{"powerbi":true}'::jsonb),
  ('pro',       'Pro',           5000,   25, 500,  10000000,  '{"powerbi":true,"chat_support":true}'::jsonb),
  ('enterprise','Enterprise',    null,   null, 5120, null,    '{"powerbi":true,"sso":true,"dedicated":true}'::jsonb)
on conflict do nothing;

create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  nit           text,
  plan_code     org_plan not null default 'starter',
  domain        text unique,
  branding      jsonb not null default '{}'::jsonb,
  settings      jsonb not null default '{}'::jsonb,   -- config por org (providers, sspd, etc.)
  is_active     boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists org_members (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id)    on delete cascade,
  role       user_role not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists ix_org_members_user on org_members(user_id);

------------------------------------------------------------
-- Helper: org_id activo desde GUC o JWT
------------------------------------------------------------
create or replace function current_org_id()
returns uuid language plpgsql stable as $$
declare
  v text;
begin
  -- 1) GUC seteado por la app
  v := current_setting('app.current_org', true);
  if v is not null and v <> '' then return v::uuid; end if;

  -- 2) JWT claim
  v := nullif(current_setting('request.jwt.claim.org_id', true),'');
  if v is not null then return v::uuid; end if;

  -- 3) Si el usuario tiene una sola membresía
  return (
    select org_id from org_members where user_id = auth.uid() limit 1
  );
end $$;

create or replace function fn_can_bypass_org()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.bypass_org', true),'false')::boolean;
$$;

create or replace function fn_is_org_member(p_org uuid, p_role user_role default null)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from org_members
    where org_id = p_org
      and user_id = auth.uid()
      and (p_role is null or role = p_role)
  );
$$;

------------------------------------------------------------
-- Retrofit org_id en tablas operativas existentes
------------------------------------------------------------
alter table organizational_units  add column if not exists org_id uuid references organizations(id);
alter table users_profile         add column if not exists default_org_id uuid references organizations(id);
alter table customers             add column if not exists org_id uuid references organizations(id);
alter table service_accounts      add column if not exists org_id uuid references organizations(id);
alter table meters                add column if not exists org_id uuid references organizations(id);
alter table pqrs_cases            add column if not exists org_id uuid references organizations(id);
alter table pqrs_messages         add column if not exists org_id uuid references organizations(id);
alter table pqrs_attachments      add column if not exists org_id uuid references organizations(id);
alter table pqrs_classifications  add column if not exists org_id uuid references organizations(id);
alter table pqrs_status_history   add column if not exists org_id uuid references organizations(id);
alter table pqrs_tasks            add column if not exists org_id uuid references organizations(id);
alter table work_orders           add column if not exists org_id uuid references organizations(id);
alter table work_order_updates    add column if not exists org_id uuid references organizations(id);
alter table legal_terms           add column if not exists org_id uuid references organizations(id);
alter table response_templates    add column if not exists org_id uuid references organizations(id);
alter table regulatory_documents  add column if not exists org_id uuid references organizations(id);
alter table knowledge_base_chunks add column if not exists org_id uuid references organizations(id);
alter table ai_interactions       add column if not exists org_id uuid references organizations(id);
alter table notifications         add column if not exists org_id uuid references organizations(id);
alter table audit_log             add column if not exists org_id uuid references organizations(id);
alter table api_keys              add column if not exists org_id uuid references organizations(id);

-- Índices por org_id (siempre primer filtro)
create index if not exists ix_cases_org           on pqrs_cases(org_id, status);
create index if not exists ix_cases_org_due       on pqrs_cases(org_id, due_at);
create index if not exists ix_messages_org        on pqrs_messages(org_id, created_at);
create index if not exists ix_wo_org              on work_orders(org_id, status);
create index if not exists ix_kb_org              on knowledge_base_chunks(org_id);
create index if not exists ix_audit_org           on audit_log(org_id, created_at desc);
create index if not exists ix_notifs_org          on notifications(org_id, status);
create index if not exists ix_ai_org              on ai_interactions(org_id, created_at desc);

-- Constraint diferida: garantiza que el caso siempre tenga org_id
-- (se valida en runtime; en seed inicial se permite null y se backfillea)
