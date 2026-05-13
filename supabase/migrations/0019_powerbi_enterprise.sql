-- 0019_powerbi_enterprise.sql
-- Snapshots históricos, agregaciones, refresh incremental, exportaciones.

-- Snapshots diarios por org (alimenta tendencias)
create table if not exists pbi_snapshots_daily (
  snapshot_date    date not null,
  org_id           uuid not null references organizations(id),
  casos_radicados  int  not null default 0,
  casos_cerrados   int  not null default 0,
  casos_vencidos   int  not null default 0,
  casos_por_vencer int  not null default 0,
  tmr_dias         numeric(6,2),
  recursos_repo    int  not null default 0,
  apelaciones      int  not null default 0,
  sspd             int  not null default 0,
  ordenes_abiertas int  not null default 0,
  ordenes_cerradas int  not null default 0,
  ia_tokens_in     bigint not null default 0,
  ia_tokens_out    bigint not null default 0,
  created_at       timestamptz not null default now(),
  primary key (snapshot_date, org_id)
);

create index if not exists ix_pbi_snap_date on pbi_snapshots_daily(snapshot_date);

create or replace function fn_pbi_snapshot(p_date date default current_date - 1)
returns void language plpgsql as $$
begin
  insert into pbi_snapshots_daily as s (
    snapshot_date, org_id,
    casos_radicados, casos_cerrados, casos_vencidos, casos_por_vencer,
    tmr_dias, recursos_repo, apelaciones, sspd,
    ordenes_abiertas, ordenes_cerradas, ia_tokens_in, ia_tokens_out
  )
  select p_date,
         org_id,
         count(*) filter (where received_at::date = p_date),
         count(*) filter (where closed_at::date = p_date),
         count(*) filter (where due_at::date < p_date and status not in ('cerrado','resuelto','notificado')),
         count(*) filter (where due_at::date between p_date and p_date + 3 and status not in ('cerrado','resuelto','notificado')),
         -- FILTER va inmediatamente después del agregado, antes del cast.
         (avg(extract(epoch from (closed_at - received_at))/86400)
            filter (where closed_at::date = p_date))::numeric(6,2),
         count(*) filter (where type = 'recurso_reposicion' and received_at::date = p_date),
         count(*) filter (where type = 'recurso_apelacion'  and received_at::date = p_date),
         count(*) filter (where status = 'escalado_sspd'    and updated_at::date = p_date),
         (select count(*) from work_orders wo
            where wo.org_id = c.org_id and wo.status <> 'completada'),
         (select count(*) from work_orders wo
            where wo.org_id = c.org_id and wo.completed_at::date = p_date),
         coalesce((select sum(input_tokens)  from ai_interactions ai
            where ai.org_id = c.org_id and ai.created_at::date = p_date),0),
         coalesce((select sum(output_tokens) from ai_interactions ai
            where ai.org_id = c.org_id and ai.created_at::date = p_date),0)
  from pqrs_cases c
  group by c.org_id
  on conflict (snapshot_date, org_id) do update set
    casos_radicados  = excluded.casos_radicados,
    casos_cerrados   = excluded.casos_cerrados,
    casos_vencidos   = excluded.casos_vencidos,
    casos_por_vencer = excluded.casos_por_vencer,
    tmr_dias         = excluded.tmr_dias,
    recursos_repo    = excluded.recursos_repo,
    apelaciones      = excluded.apelaciones,
    sspd             = excluded.sspd,
    ordenes_abiertas = excluded.ordenes_abiertas,
    ordenes_cerradas = excluded.ordenes_cerradas,
    ia_tokens_in     = excluded.ia_tokens_in,
    ia_tokens_out    = excluded.ia_tokens_out;
end $$;

-- Aging buckets para reportería operativa
create or replace view v_pbi_aging as
select org_id,
       count(*) filter (where age_days <= 5)                  as bucket_0_5,
       count(*) filter (where age_days between 6  and 10)     as bucket_6_10,
       count(*) filter (where age_days between 11 and 15)     as bucket_11_15,
       count(*) filter (where age_days > 15)                  as bucket_15_plus
from (
  select org_id,
         (extract(epoch from (now() - received_at))/86400)::int as age_days
  from pqrs_cases
  where status not in ('cerrado','resuelto','notificado')
) t
group by org_id;

-- SLA por causal
create or replace view v_pbi_sla_causal as
select org_id, causal,
       count(*) as total,
       count(*) filter (where closed_at is not null and closed_at <= due_at) as a_tiempo,
       count(*) filter (where closed_at is not null and closed_at >  due_at) as fuera_tiempo,
       round(
         100.0 * count(*) filter (where closed_at is not null and closed_at <= due_at)
              / nullif(count(*) filter (where closed_at is not null),0), 2
       ) as cumplimiento_pct
from pqrs_cases
where causal is not null
group by org_id, causal;
