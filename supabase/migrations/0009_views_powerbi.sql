-- 0009_views_powerbi.sql
-- Vistas SQL para alimentar Power BI (KPIs solicitados)

-- 1. PQRS por día / mes / año
create or replace view v_pbi_radicados_dia as
select date_trunc('day', received_at)::date as fecha,
       count(*) as total
from pqrs_cases group by 1;

create or replace view v_pbi_radicados_mes as
select to_char(received_at,'YYYY-MM') as periodo, count(*) as total
from pqrs_cases group by 1;

create or replace view v_pbi_radicados_anio as
select extract(year from received_at)::int as anio, count(*) as total
from pqrs_cases group by 1;

-- 2. Por tipo
create or replace view v_pbi_por_tipo as
select type as tipo, count(*) as total
from pqrs_cases group by 1;

-- 3. Por causal
create or replace view v_pbi_por_causal as
select causal, count(*) as total
from pqrs_cases where causal is not null group by 1;

-- 4. Por municipio
create or replace view v_pbi_por_municipio as
select sa.municipality as municipio, count(*) as total
from pqrs_cases c
left join service_accounts sa on sa.id = c.service_account_id
group by 1;

-- 5. Por área responsable
create or replace view v_pbi_por_area as
select ou.code as area, count(*) as total
from pqrs_cases c
left join organizational_units ou on ou.id = c.assigned_unit_id
group by 1;

-- 6. Casos vencidos
create or replace view v_pbi_vencidos as
select date_trunc('day', received_at)::date as fecha,
       count(*) as vencidos
from pqrs_cases
where due_at < now() and status not in ('cerrado','resuelto','notificado')
group by 1;

-- 7. Próximos a vencer (<= 3 días hábiles)
create or replace view v_pbi_por_vencer as
select id, radicado, type, category, status, assigned_unit_id, assigned_to, due_at,
       greatest(0, extract(epoch from (due_at - now()))/86400)::numeric(6,2) as dias_restantes
from pqrs_cases
where status not in ('cerrado','resuelto','notificado','vencido')
  and due_at between now() and now() + interval '3 days';

-- 8. Tiempo promedio de respuesta (días corridos hasta resolución/notificado/cerrado)
create or replace view v_pbi_tiempo_respuesta as
select date_trunc('month', received_at) as periodo,
       avg(extract(epoch from (closed_at - received_at))/86400)::numeric(6,2) as dias_promedio,
       count(*) filter (where closed_at is not null) as cerrados
from pqrs_cases group by 1;

-- 9. Órdenes generadas
create or replace view v_pbi_ordenes_generadas as
select type as tipo_orden, status, count(*) as total
from work_orders group by 1,2;

-- 10. Reincidencia por cliente (clientes con > 1 caso en últimos 90 días)
create or replace view v_pbi_reincidencia as
select c.id as customer_id, c.full_name, c.document_id, count(*) as casos_90d
from customers c
join pqrs_cases p on p.customer_id = c.id
where p.received_at >= now() - interval '90 days'
group by c.id, c.full_name, c.document_id
having count(*) > 1;

-- 11. Reclamos por facturación
create or replace view v_pbi_reclamos_facturacion as
select date_trunc('month', received_at) as periodo, count(*) as total
from pqrs_cases
where type = 'reclamo' and category = 'facturacion'
group by 1;

-- 12. Reclamos por consumo elevado
create or replace view v_pbi_reclamos_consumo as
select date_trunc('month', received_at) as periodo, count(*) as total
from pqrs_cases
where type = 'reclamo' and category = 'consumo_elevado'
group by 1;

-- 13. Reclamos por medidor
create or replace view v_pbi_reclamos_medidor as
select date_trunc('month', received_at) as periodo, count(*) as total
from pqrs_cases
where type = 'reclamo' and category = 'medidor'
group by 1;

-- 14. Recursos de reposición
create or replace view v_pbi_recursos_reposicion as
select date_trunc('month', received_at) as periodo, count(*) as total
from pqrs_cases where type = 'recurso_reposicion' group by 1;

-- 15. Apelaciones
create or replace view v_pbi_apelaciones as
select date_trunc('month', received_at) as periodo, count(*) as total
from pqrs_cases where type = 'recurso_apelacion' group by 1;

-- 16. Casos escalados a SSPD
create or replace view v_pbi_escalados_sspd as
select date_trunc('month', received_at) as periodo, count(*) as total
from pqrs_cases where status = 'escalado_sspd' group by 1;

-- 17. Efectividad de respuestas
--   (cerrados sin recurso / total cerrados)
create or replace view v_pbi_efectividad as
with cerrados as (
  select id from pqrs_cases where status in ('cerrado','resuelto','notificado')
),
con_recurso as (
  select parent_case_id from pqrs_cases
  where parent_case_id is not null and type in ('recurso_reposicion','recurso_apelacion')
)
select count(*) filter (where c.id not in (select parent_case_id from con_recurso))::numeric
       / nullif(count(*),0) as ratio_efectividad,
       count(*) as total_cerrados
from cerrados c;

-- 18. Productividad por analista
create or replace view v_pbi_productividad_analista as
select up.id, up.full_name,
       count(*) filter (where p.closed_at >= now() - interval '30 days') as cerrados_30d,
       count(*) filter (where p.status not in ('cerrado','resuelto','notificado')) as en_curso
from users_profile up
left join pqrs_cases p on p.assigned_to = up.id
where up.role in ('analista','agente','supervisor','juridico')
group by up.id, up.full_name;

-- 19. Ranking de causales (top causales)
create or replace view v_pbi_ranking_causales as
select causal, count(*) as total,
       rank() over (order by count(*) desc) as posicion
from pqrs_cases where causal is not null
group by causal;

-- Vista materializada agregada para refresco programado
create materialized view if not exists mv_powerbi_metrics as
select
  (select count(*) from pqrs_cases)                              as total_casos,
  (select count(*) from pqrs_cases where received_at::date = current_date) as casos_hoy,
  (select count(*) from pqrs_cases
     where due_at < now() and status not in ('cerrado','resuelto','notificado')) as casos_vencidos,
  (select count(*) from pqrs_cases
     where status not in ('cerrado','resuelto','notificado','vencido')
       and due_at between now() and now() + interval '3 days')   as casos_por_vencer,
  (select count(*) from work_orders where status <> 'completada') as ordenes_abiertas,
  now() as refreshed_at;
