-- 0008_triggers.sql
-- Funciones y triggers: updated_at, radicado, OT, due_at, tsv, status_history, auditoría

------------------------------------------------------------
-- updated_at automático
------------------------------------------------------------
create or replace function trg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
        for each row execute function trg_set_updated_at();', t);
  end loop;
end $$;

------------------------------------------------------------
-- Generación de número de radicado: PQRS-YYYY-NNNNNNN
------------------------------------------------------------
create or replace function fn_next_radicado()
returns text language plpgsql as $$
declare
  y int := extract(year from now())::int;
  v int;
begin
  insert into pqrs_sequences(year, last_value) values (y, 1)
  on conflict (year) do update set last_value = pqrs_sequences.last_value + 1
  returning last_value into v;
  return format('PQRS-%s-%s', y, lpad(v::text, 7, '0'));
end $$;

create or replace function trg_pqrs_before_insert()
returns trigger language plpgsql as $$
begin
  if new.radicado is null then
    new.radicado := fn_next_radicado();
  end if;
  -- search_tsv
  new.search_tsv :=
      to_tsvector('spanish', coalesce(new.narrative,'') || ' ' || coalesce(new.summary,''));
  return new;
end $$;

drop trigger if exists pqrs_before_insert on pqrs_cases;
create trigger pqrs_before_insert
  before insert on pqrs_cases
  for each row execute function trg_pqrs_before_insert();

create or replace function trg_pqrs_before_update()
returns trigger language plpgsql as $$
begin
  if (new.narrative is distinct from old.narrative) or (new.summary is distinct from old.summary) then
    new.search_tsv :=
      to_tsvector('spanish', coalesce(new.narrative,'') || ' ' || coalesce(new.summary,''));
  end if;
  return new;
end $$;

drop trigger if exists pqrs_before_update on pqrs_cases;
create trigger pqrs_before_update
  before update on pqrs_cases
  for each row execute function trg_pqrs_before_update();

------------------------------------------------------------
-- Días hábiles colombianos (excluye sábado, domingo y holidays_co)
------------------------------------------------------------
create or replace function fn_is_business_day(d date)
returns boolean language sql stable as $$
  select extract(isodow from d) < 6
         and not exists (select 1 from holidays_co where holiday_date = d);
$$;

create or replace function fn_add_business_days(start_ts timestamptz, n int)
returns timestamptz language plpgsql stable as $$
declare
  d date := start_ts::date;
  added int := 0;
begin
  while added < n loop
    d := d + 1;
    if fn_is_business_day(d) then
      added := added + 1;
    end if;
  end loop;
  -- mantener hora 23:59:59 del día límite
  return (d::timestamp + time '23:59:59') at time zone 'America/Bogota';
end $$;

------------------------------------------------------------
-- Cálculo de due_at al insertar o reclasificar
------------------------------------------------------------
create or replace function fn_lookup_legal_term(
  p_type pqrs_type, p_category pqrs_category, p_subcategory text,
  p_causal text, p_requires_visit boolean)
returns int language sql stable as $$
  select coalesce(
    (select days_business from legal_terms
      where is_active
        and pqrs_type = p_type
        and (category is null or category = p_category)
        and (subcategory is null or subcategory = p_subcategory)
        and (causal is null or causal = p_causal)
        and requires_visit = p_requires_visit
      order by
        (causal is not null) desc,
        (subcategory is not null) desc,
        (category is not null) desc
      limit 1),
    15
  );
$$;

create or replace function trg_pqrs_set_due_at()
returns trigger language plpgsql as $$
declare
  d int;
  needs_visit boolean := coalesce((new.metadata->>'requires_visit')::boolean, false);
begin
  d := fn_lookup_legal_term(new.type, new.category, new.subcategory, new.causal, needs_visit);
  new.legal_term_days := d;
  new.due_at := fn_add_business_days(new.received_at, d);
  return new;
end $$;

drop trigger if exists pqrs_set_due_at_ins on pqrs_cases;
create trigger pqrs_set_due_at_ins
  before insert on pqrs_cases
  for each row execute function trg_pqrs_set_due_at();

drop trigger if exists pqrs_set_due_at_upd on pqrs_cases;
create trigger pqrs_set_due_at_upd
  before update of type, category, subcategory, causal, received_at, metadata on pqrs_cases
  for each row execute function trg_pqrs_set_due_at();

------------------------------------------------------------
-- Status history automático
------------------------------------------------------------
create or replace function trg_pqrs_status_history()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    insert into pqrs_status_history(case_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif (tg_op = 'UPDATE') and (new.status is distinct from old.status) then
    insert into pqrs_status_history(case_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status,
            nullif(current_setting('request.jwt.claim.sub', true),'')::uuid);
  end if;
  return new;
end $$;

drop trigger if exists pqrs_status_hist on pqrs_cases;
create trigger pqrs_status_hist
  after insert or update on pqrs_cases
  for each row execute function trg_pqrs_status_history();

------------------------------------------------------------
-- Numeración de órdenes de trabajo: OT-YYYY-NNNNNNN (reaprovecha pqrs_sequences con prefijo 'OT-')
------------------------------------------------------------
create table if not exists wo_sequences (
  year int primary key, last_value int not null default 0
);

create or replace function fn_next_order_number()
returns text language plpgsql as $$
declare y int := extract(year from now())::int; v int;
begin
  insert into wo_sequences(year,last_value) values (y,1)
  on conflict (year) do update set last_value = wo_sequences.last_value + 1
  returning last_value into v;
  return format('OT-%s-%s', y, lpad(v::text, 7, '0'));
end $$;

create or replace function trg_wo_before_insert()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := fn_next_order_number();
  end if;
  return new;
end $$;

drop trigger if exists wo_before_insert on work_orders;
create trigger wo_before_insert
  before insert on work_orders
  for each row execute function trg_wo_before_insert();

------------------------------------------------------------
-- Auditoría genérica
------------------------------------------------------------
create or replace function trg_audit_row()
returns trigger language plpgsql as $$
declare
  uid uuid := nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
  ip_text text := current_setting('request.headers', true);
begin
  if (tg_op = 'INSERT') then
    insert into audit_log(table_name, row_pk, operation, changed_by, after_data)
    values (tg_table_name, (row_to_json(new)->>'id'), 'INSERT', uid, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into audit_log(table_name, row_pk, operation, changed_by, before_data, after_data)
    values (tg_table_name, (row_to_json(new)->>'id'), 'UPDATE', uid, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit_log(table_name, row_pk, operation, changed_by, before_data)
    values (tg_table_name, (row_to_json(old)->>'id'), 'DELETE', uid, to_jsonb(old));
    return old;
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'pqrs_cases','pqrs_messages','pqrs_attachments','pqrs_classifications',
    'pqrs_tasks','work_orders','work_order_updates','legal_terms',
    'response_templates','customers','service_accounts','meters','users_profile'])
  loop
    execute format('drop trigger if exists audit_%I on public.%I;', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I
       for each row execute function trg_audit_row();', t, t);
  end loop;
end $$;
