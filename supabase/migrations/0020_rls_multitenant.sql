-- 0020_rls_multitenant.sql
-- Reescritura RLS para aislamiento por org_id. Reemplaza (sin perder) lo previo.

-- Helper: verifica si la fila pertenece a una org del usuario actual
create or replace function fn_user_in_org(p_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select fn_can_bypass_org()
      or (p_org is not null and exists(
            select 1 from org_members
            where user_id = auth.uid() and org_id = p_org));
$$;

------------------------------------------------------------
-- Activar RLS en tablas nuevas
------------------------------------------------------------
alter table organizations           enable row level security;
alter table org_members             enable row level security;
alter table workflow_definitions    enable row level security;
alter table case_timeline           enable row level security;
alter table case_approvals          enable row level security;
alter table case_comments           enable row level security;
alter table case_reminders          enable row level security;
alter table work_order_photos       enable row level security;
alter table work_order_signatures   enable row level security;
alter table work_order_templates    enable row level security;
alter table rag_corpora             enable row level security;
alter table rag_query_log           enable row level security;
alter table notification_templates  enable row level security;
alter table notification_attempts   enable row level security;
alter table rate_limit_buckets      enable row level security;
alter table abuse_signals           enable row level security;
alter table encrypted_documents     enable row level security;
alter table pii_patterns            enable row level security;
alter table document_versions       enable row level security;
alter table ocr_jobs                enable row level security;
alter table generated_pdfs          enable row level security;
alter table pbi_snapshots_daily     enable row level security;
alter table plans                   enable row level security;

------------------------------------------------------------
-- Organizations / membership
------------------------------------------------------------
drop policy if exists "orgs_member_select" on organizations;
create policy "orgs_member_select" on organizations
  for select using (fn_user_in_org(id));

drop policy if exists "orgs_superadmin" on organizations;
create policy "orgs_superadmin" on organizations
  for all using (fn_can_bypass_org());

drop policy if exists "members_self_or_org_admin" on org_members;
create policy "members_self_or_org_admin" on org_members
  for select using (
    user_id = auth.uid()
    or fn_is_org_member(org_id, 'admin')
    or fn_can_bypass_org()
  );

drop policy if exists "members_admin_write" on org_members;
create policy "members_admin_write" on org_members
  for all using (fn_is_org_member(org_id, 'admin') or fn_can_bypass_org());

drop policy if exists "plans_read" on plans;
create policy "plans_read" on plans for select using (true);

------------------------------------------------------------
-- Macro: aplica políticas RLS estándar a tablas con org_id
-- Estrategia: el usuario ve filas si fn_user_in_org(org_id).
-- Las políticas previas más finas (por rol) siguen vigentes encima.
------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'organizational_units','customers','service_accounts','meters',
    'pqrs_cases','pqrs_messages','pqrs_attachments','pqrs_classifications',
    'pqrs_status_history','pqrs_tasks','work_orders','work_order_updates',
    'work_order_photos','work_order_signatures','work_order_templates',
    'legal_terms','response_templates','regulatory_documents','knowledge_base_chunks',
    'rag_corpora','rag_query_log','ai_interactions','notifications',
    'notification_templates','notification_attempts','audit_log','api_keys',
    'case_timeline','case_approvals','case_comments','case_reminders',
    'workflow_definitions','encrypted_documents','pii_patterns',
    'document_versions','ocr_jobs','generated_pdfs','pbi_snapshots_daily',
    'abuse_signals'
  ])
  loop
    execute format('drop policy if exists "tenant_isolation_%I" on public.%I;', t, t);
    execute format(
      'create policy "tenant_isolation_%I" on public.%I
         as restrictive
         for all using (fn_user_in_org(org_id));', t, t);
  end loop;
end $$;

-- abuse_signals y rate_limit_buckets: lectura solo admin / auditor
drop policy if exists "abuse_select_admin" on abuse_signals;
create policy "abuse_select_admin" on abuse_signals
  for select using (fn_current_role() in ('admin','auditor') and fn_user_in_org(org_id));

drop policy if exists "rate_select_admin" on rate_limit_buckets;
create policy "rate_select_admin" on rate_limit_buckets
  for select using (fn_current_role() in ('admin','auditor'));

------------------------------------------------------------
-- Reglas de inserción: forzar org_id = current_org_id() si no se envía
------------------------------------------------------------
create or replace function trg_set_org_id()
returns trigger language plpgsql as $$
begin
  if new.org_id is null then
    new.org_id := current_org_id();
  end if;
  if new.org_id is null and not fn_can_bypass_org() then
    raise exception 'org_id requerido (no se pudo resolver current_org_id())';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'pqrs_cases','pqrs_messages','pqrs_attachments','pqrs_classifications',
    'pqrs_status_history','pqrs_tasks','work_orders','work_order_updates',
    'work_order_photos','work_order_signatures','case_timeline','case_approvals',
    'case_comments','case_reminders','ai_interactions','notifications',
    'notification_attempts','audit_log','customers','service_accounts','meters'])
  loop
    execute format('drop trigger if exists set_org_id_%I on public.%I;', t, t);
    execute format(
      'create trigger set_org_id_%I before insert on public.%I
       for each row execute function trg_set_org_id();', t, t);
  end loop;
end $$;
