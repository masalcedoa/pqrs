import { createSupabaseServerClient } from '@/lib/supabase/server';
import KpiGrid, { type Kpi } from '@/components/dashboard/KpiGrid';
import AgingChart from '@/components/dashboard/AgingChart';
import ProductivityChart from '@/components/dashboard/ProductivityChart';
import SlaHeatmap from '@/components/dashboard/SlaHeatmap';
import CaseQueueTable, { type CaseRow } from '@/components/dashboard/CaseQueueTable';
import WorkOrderMap, { type OrderPoint } from '@/components/dashboard/WorkOrderMap';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = createSupabaseServerClient();

  // Métricas agregadas
  const { data: metrics } = await sb.from('mv_powerbi_metrics').select('*').maybeSingle();

  // Aging
  const { data: agingRows } = await sb.from('v_pbi_aging').select('*').limit(1).maybeSingle();
  const aging = agingRows
    ? [
        { bucket: '0-5 d',  value: Number(agingRows.bucket_0_5) },
        { bucket: '6-10 d', value: Number(agingRows.bucket_6_10) },
        { bucket: '11-15 d',value: Number(agingRows.bucket_11_15) },
        { bucket: '>15 d',  value: Number(agingRows.bucket_15_plus) }
      ]
    : [];

  // Tendencia 30 días (compone radicados + cerrados + vencidos)
  const { data: trend30 } = await sb.from('pbi_snapshots_daily')
    .select('snapshot_date, casos_radicados, casos_cerrados, casos_vencidos')
    .gte('snapshot_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });

  const trend = (trend30 ?? []).map(r => ({
    date: r.snapshot_date,
    radicados: r.casos_radicados ?? 0,
    cerrados:  r.casos_cerrados  ?? 0,
    vencidos:  r.casos_vencidos  ?? 0
  }));

  // SLA por causal (toma 6 causales top + filas área = unit)
  const { data: slaRows } = await sb.from('v_pbi_sla_causal')
    .select('*').order('total', { ascending: false }).limit(36);

  const cols = Array.from(new Set((slaRows ?? []).map(r => (r.causal ?? '—') as string))).slice(0, 6);
  const rows = ['ATC', 'COM', 'TEC', 'JUR']; // áreas
  const slaCells = (slaRows ?? []).map(r => ({
    row: rows[0],                                          // sin desagregar por área en esta vista; placeholder visual
    col: r.causal ?? '—',
    pct: Number(r.cumplimiento_pct ?? 0),
    total: Number(r.total ?? 0)
  }));

  // Cola de trabajo
  const { data: queue } = await sb.from('pqrs_cases')
    .select('id, radicado, type, category, status, priority, received_at, due_at, assigned_to')
    .not('status', 'in', '("cerrado","resuelto","notificado","vencido")')
    .order('due_at', { ascending: true }).limit(100);

  const queueRows: CaseRow[] = (queue ?? []).map(r => ({
    id: r.id, radicado: r.radicado, type: r.type, category: r.category,
    status: r.status, priority: r.priority,
    received_at: r.received_at, due_at: r.due_at, assigned_to: r.assigned_to,
    age_days: Math.floor((Date.now() - new Date(r.received_at).getTime()) / 86400000)
  }));

  // Órdenes activas con geolocalización
  const { data: orders } = await sb.from('work_orders')
    .select('id, order_number, type, status, lat, lng, address_text, municipality, assigned_to')
    .not('status', 'in', '("completada","cancelada","rechazada")')
    .not('lat', 'is', null).limit(200);

  const orderPoints: OrderPoint[] = (orders ?? []).map(o => ({
    id: o.id, order_number: o.order_number, type: o.type, status: o.status,
    lat: Number(o.lat), lng: Number(o.lng),
    address: o.address_text ? `${o.address_text}${o.municipality ? `, ${o.municipality}` : ''}` : o.municipality,
    assigned_to_name: null
  }));

  const kpis: Kpi[] = [
    { label: 'Casos totales',     value: metrics?.total_casos ?? '—' },
    { label: 'Radicados hoy',     value: metrics?.casos_hoy   ?? '—' },
    { label: 'Vencidos',          value: metrics?.casos_vencidos ?? '—', highlight: 'danger' },
    { label: 'Por vencer (3 d)',  value: metrics?.casos_por_vencer ?? '—', highlight: 'warn' }
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">Dashboard operativo</h1>
          <p className="text-sm text-gray-500">Última actualización: {metrics?.refreshed_at ? new Date(metrics.refreshed_at).toLocaleString('es-CO') : '—'}</p>
        </div>
      </header>

      <section className="mt-6"><KpiGrid items={kpis} /></section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><ProductivityChart data={trend} /></div>
        <div><AgingChart data={aging} /></div>
      </section>

      <section className="mt-8">
        <Tabs defaultValue="cola">
          <TabsList>
            <TabsTrigger value="cola">Cola de trabajo</TabsTrigger>
            <TabsTrigger value="sla">SLA por causal</TabsTrigger>
            <TabsTrigger value="ordenes">Órdenes activas</TabsTrigger>
          </TabsList>
          <TabsContent value="cola"><CaseQueueTable data={queueRows} /></TabsContent>
          <TabsContent value="sla">
            <SlaHeatmap data={slaCells} rows={rows} cols={cols} />
          </TabsContent>
          <TabsContent value="ordenes"><WorkOrderMap points={orderPoints} /></TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
