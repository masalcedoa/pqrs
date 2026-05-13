-- 0022_trigger_fixes.sql
-- Ajusta trg_set_org_id para que NO lance excepción cuando no se pueda resolver org_id.
-- Razón: tablas secundarias (audit_log, case_timeline, notification_attempts) reciben
-- inserts indirectos vía triggers donde la sesión service_role aún no tiene org seteado.
-- La seguridad sigue garantizada por RLS: fn_user_in_org(null) devuelve false, así que
-- una fila con org_id null queda invisible a todos los roles no privilegiados.

create or replace function trg_set_org_id()
returns trigger language plpgsql as $$
begin
  if new.org_id is null then
    new.org_id := current_org_id();
  end if;
  -- Sin RAISE: si no se resuelve, queda NULL.
  -- RLS impide accesos posteriores sin org_id válido.
  return new;
end $$;
