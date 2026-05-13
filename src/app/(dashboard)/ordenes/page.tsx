import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OrdenesPage() {
  const sb = createSupabaseServerClient();
  const { data: orders } = await sb.from('work_orders')
    .select('id, order_number, type, status, priority, due_at, scheduled_at, address_text, municipality, case_id')
    .order('created_at', { ascending: false }).limit(200);

  const byStatus = (orders ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1; return acc;
  }, {});

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold text-brand-700">Órdenes internas</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(byStatus).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">{k}</p>
              <p className="text-2xl font-bold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-2">N° OT</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Prioridad</th>
                    <th className="px-3 py-2">Dirección</th>
                    <th className="px-3 py-2">Programada</th>
                    <th className="px-3 py-2">Caso</th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.map(o => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{o.order_number}</td>
                      <td className="px-3 py-2">{o.type}</td>
                      <td className="px-3 py-2"><Badge tone={o.status === 'completada' ? 'success' : o.status === 'cancelada' ? 'danger' : 'info'}>{o.status}</Badge></td>
                      <td className="px-3 py-2">{o.priority}</td>
                      <td className="px-3 py-2">{o.address_text ?? o.municipality ?? '—'}</td>
                      <td className="px-3 py-2">{o.scheduled_at ? new Date(o.scheduled_at).toLocaleString('es-CO') : '—'}</td>
                      <td className="px-3 py-2"><Link href={`/pqrs/${o.case_id}`} className="text-brand-600 hover:underline">Ver caso</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
