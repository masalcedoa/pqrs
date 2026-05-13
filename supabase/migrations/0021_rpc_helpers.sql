-- 0021_rpc_helpers.sql
-- Funciones públicas que la app llama vía sb.rpc(...).
-- Se exponen security definer y con grants explícitos.

------------------------------------------------------------
-- fn_set_current_org: setea el GUC app.current_org para la sesión.
------------------------------------------------------------
create or replace function fn_set_current_org(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.current_org', p_org::text, false);
end $$;

revoke all on function fn_set_current_org(uuid) from public;
grant execute on function fn_set_current_org(uuid) to authenticated, service_role;

------------------------------------------------------------
-- fn_refresh_pbi_metrics: refresca la materialized view de KPIs.
------------------------------------------------------------
create or replace function fn_refresh_pbi_metrics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view mv_powerbi_metrics;
end $$;

revoke all on function fn_refresh_pbi_metrics() from public;
grant execute on function fn_refresh_pbi_metrics() to service_role;

------------------------------------------------------------
-- Buckets de Storage (idempotente).
-- Estos también se declaran en supabase/config.toml para `supabase start`.
-- Aquí los aseguramos para Supabase Cloud o instancias sin config.toml.
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pqrs-adjuntos', 'pqrs-adjuntos', false, 20 * 1024 * 1024,
     array['image/png','image/jpeg','application/pdf','text/plain','application/zip']),
  ('respuestas',    'respuestas',    false, 20 * 1024 * 1024,
     array['application/pdf']),
  ('normativa',     'normativa',     false, 50 * 1024 * 1024,
     array['application/pdf','text/plain','text/markdown'])
on conflict (id) do nothing;

------------------------------------------------------------
-- RLS de Storage: usuarios solo ven adjuntos de casos a los que tienen acceso.
-- Aquí se define una política base; afinable según necesidad.
------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='pqrs_adjuntos_read') then
    return;
  end if;
  create policy "pqrs_adjuntos_read" on storage.objects
    for select using (
      bucket_id in ('pqrs-adjuntos','respuestas','normativa')
      and auth.role() = 'authenticated'
    );
  create policy "pqrs_adjuntos_write" on storage.objects
    for insert with check (
      bucket_id in ('pqrs-adjuntos','respuestas','normativa')
      and auth.role() = 'authenticated'
    );
end $$;
