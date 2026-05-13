-- 0010_rls_policies.sql
-- Row Level Security por rol. El rol se obtiene del JWT via users_profile.

-- Helper: rol del usuario actual
create or replace function fn_current_role()
returns user_role language sql stable security definer set search_path=public as $$
  select role from users_profile where id = auth.uid();
$$;

-- Helper: ¿este auth.uid() es el customer dueño del caso?
create or replace function fn_is_customer_of(p_case uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from pqrs_cases pc
    join customers cu on cu.id = pc.customer_id
    where pc.id = p_case and cu.user_id = auth.uid()
  );
$$;

-- Activar RLS
alter table users_profile         enable row level security;
alter table customers             enable row level security;
alter table service_accounts      enable row level security;
alter table meters                enable row level security;
alter table pqrs_cases            enable row level security;
alter table pqrs_messages         enable row level security;
alter table pqrs_attachments      enable row level security;
alter table pqrs_classifications  enable row level security;
alter table pqrs_status_history   enable row level security;
alter table pqrs_tasks            enable row level security;
alter table work_orders           enable row level security;
alter table work_order_updates    enable row level security;
alter table legal_terms           enable row level security;
alter table response_templates    enable row level security;
alter table regulatory_documents  enable row level security;
alter table knowledge_base_chunks enable row level security;
alter table ai_interactions       enable row level security;
alter table notifications         enable row level security;
alter table audit_log             enable row level security;
alter table api_keys              enable row level security;
alter table organizational_units  enable row level security;

------------------------------------------------------------
-- users_profile
------------------------------------------------------------
create policy "profile_self_select" on users_profile
  for select using (auth.uid() = id or fn_current_role() in ('admin','auditor','supervisor'));

create policy "profile_self_update" on users_profile
  for update using (auth.uid() = id);

create policy "profile_admin_all" on users_profile
  for all using (fn_current_role() = 'admin');

------------------------------------------------------------
-- customers, service_accounts, meters
------------------------------------------------------------
create policy "customers_owner_or_staff" on customers
  for select using (
    user_id = auth.uid()
    or fn_current_role() in ('agente','analista','supervisor','juridico','tecnico','admin','auditor')
  );
create policy "customers_staff_write" on customers
  for all using (fn_current_role() in ('agente','analista','supervisor','admin'));

create policy "accounts_owner_or_staff" on service_accounts
  for select using (
    exists (select 1 from customers c where c.id = customer_id and c.user_id = auth.uid())
    or fn_current_role() in ('agente','analista','supervisor','juridico','tecnico','admin','auditor')
  );
create policy "accounts_staff_write" on service_accounts
  for all using (fn_current_role() in ('agente','analista','supervisor','admin'));

create policy "meters_staff_read" on meters
  for select using (fn_current_role() in ('agente','analista','supervisor','juridico','tecnico','admin','auditor'));
create policy "meters_staff_write" on meters
  for all using (fn_current_role() in ('tecnico','analista','supervisor','admin'));

------------------------------------------------------------
-- pqrs_cases
------------------------------------------------------------
-- Lectura
create policy "cases_select_owner" on pqrs_cases
  for select using (fn_is_customer_of(id));

create policy "cases_select_staff" on pqrs_cases
  for select using (
    fn_current_role() in ('supervisor','admin','auditor')
    or (fn_current_role() in ('agente','analista','juridico') and
        (assigned_to = auth.uid()
         or assigned_unit_id = (select unit_id from users_profile where id = auth.uid())))
    or (fn_current_role() = 'tecnico' and
        exists (select 1 from work_orders wo where wo.case_id = pqrs_cases.id and wo.assigned_to = auth.uid()))
  );

-- Inserción
create policy "cases_insert_owner_or_staff" on pqrs_cases
  for insert with check (
    fn_current_role() in ('ciudadano','agente','analista','supervisor','admin')
  );

-- Update
create policy "cases_update_staff" on pqrs_cases
  for update using (
    fn_current_role() in ('agente','analista','supervisor','juridico','admin')
  );

------------------------------------------------------------
-- pqrs_messages, attachments, classifications, status_history, tasks
------------------------------------------------------------
create policy "messages_select" on pqrs_messages
  for select using (
    (not is_internal and fn_is_customer_of(case_id))
    or fn_current_role() in ('agente','analista','supervisor','juridico','tecnico','admin','auditor')
  );
create policy "messages_insert" on pqrs_messages
  for insert with check (
    fn_is_customer_of(case_id)
    or fn_current_role() in ('agente','analista','supervisor','juridico','admin')
  );

create policy "attach_select" on pqrs_attachments
  for select using (
    fn_is_customer_of(case_id)
    or fn_current_role() in ('agente','analista','supervisor','juridico','tecnico','admin','auditor')
  );
create policy "attach_insert" on pqrs_attachments
  for insert with check (
    fn_is_customer_of(case_id)
    or fn_current_role() in ('agente','analista','supervisor','juridico','admin')
  );

create policy "class_rw" on pqrs_classifications
  for all using (fn_current_role() in ('agente','analista','supervisor','admin'));

create policy "hist_read" on pqrs_status_history
  for select using (
    fn_is_customer_of(case_id)
    or fn_current_role() in ('agente','analista','supervisor','juridico','tecnico','admin','auditor')
  );

create policy "tasks_rw_staff" on pqrs_tasks
  for all using (fn_current_role() in ('analista','supervisor','admin')
                 or assigned_to = auth.uid());

------------------------------------------------------------
-- work_orders
------------------------------------------------------------
create policy "wo_select" on work_orders
  for select using (
    fn_is_customer_of(case_id)
    or fn_current_role() in ('analista','supervisor','admin','auditor','juridico')
    or assigned_to = auth.uid()
  );
create policy "wo_write" on work_orders
  for all using (fn_current_role() in ('analista','supervisor','admin'));

create policy "wo_updates_select" on work_order_updates
  for select using (
    fn_current_role() in ('analista','supervisor','admin','auditor','juridico')
    or exists (select 1 from work_orders wo where wo.id = work_order_id and wo.assigned_to = auth.uid())
  );
create policy "wo_updates_insert" on work_order_updates
  for insert with check (
    fn_current_role() in ('tecnico','analista','supervisor','admin')
  );

------------------------------------------------------------
-- Catálogos (lectura para staff, escritura solo admin/jurídico)
------------------------------------------------------------
create policy "legal_terms_read_all_staff" on legal_terms
  for select using (fn_current_role() <> 'ciudadano');
create policy "legal_terms_admin" on legal_terms
  for all using (fn_current_role() in ('admin','juridico'));

create policy "templates_read_all_staff" on response_templates
  for select using (fn_current_role() <> 'ciudadano');
create policy "templates_admin" on response_templates
  for all using (fn_current_role() in ('admin','juridico'));

create policy "regdoc_read_staff" on regulatory_documents
  for select using (fn_current_role() <> 'ciudadano');
create policy "regdoc_admin" on regulatory_documents
  for all using (fn_current_role() in ('admin','juridico'));

create policy "kb_chunks_read_staff" on knowledge_base_chunks
  for select using (fn_current_role() <> 'ciudadano');
create policy "kb_chunks_admin" on knowledge_base_chunks
  for all using (fn_current_role() in ('admin','juridico'));

create policy "org_read" on organizational_units
  for select using (auth.role() = 'authenticated');
create policy "org_admin" on organizational_units
  for all using (fn_current_role() = 'admin');

------------------------------------------------------------
-- IA, notificaciones, auditoría, api_keys
------------------------------------------------------------
create policy "ai_read_staff" on ai_interactions
  for select using (fn_current_role() in ('analista','supervisor','admin','auditor','juridico')
                    or user_id = auth.uid());
create policy "ai_insert_any_auth" on ai_interactions
  for insert with check (auth.role() = 'authenticated');

create policy "notif_select" on notifications
  for select using (
    fn_current_role() in ('agente','analista','supervisor','admin','auditor')
    or fn_is_customer_of(case_id)
  );
create policy "notif_write" on notifications
  for all using (fn_current_role() in ('agente','analista','supervisor','admin'));

create policy "audit_read" on audit_log
  for select using (fn_current_role() in ('admin','auditor'));

create policy "api_keys_admin" on api_keys
  for all using (fn_current_role() = 'admin');
