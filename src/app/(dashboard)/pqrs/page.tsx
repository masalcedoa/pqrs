import { createSupabaseServerClient } from '@/lib/supabase/server';
import CaseQueueTable, { type CaseRow } from '@/components/dashboard/CaseQueueTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function PqrsListPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const sb = createSupabaseServerClient();
  let q = sb.from('pqrs_cases')
    .select('id, radicado, type, category, status, priority, received_at, due_at, assigned_to')
    .order('received_at', { ascending: false }).limit(200);

  if (searchParams.status) q = q.eq('status', searchParams.status);
  if (searchParams.q)
    q = q.or(`radicado.ilike.%${searchParams.q}%,narrative.ilike.%${searchParams.q}%`);

  const { data } = await q;
  const rows: CaseRow[] = (data ?? []).map(r => ({
    id: r.id, radicado: r.radicado, type: r.type, category: r.category,
    status: r.status, priority: r.priority,
    received_at: r.received_at, due_at: r.due_at, assigned_to: r.assigned_to,
    age_days: Math.floor((Date.now() - new Date(r.received_at).getTime()) / 86400000)
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold text-brand-700">Casos PQRS</h1>
      <Card className="mt-6">
        <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
        <CardContent>
          <CaseQueueTable data={rows} />
        </CardContent>
      </Card>
    </main>
  );
}
