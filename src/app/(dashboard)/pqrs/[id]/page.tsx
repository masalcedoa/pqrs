import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import TransitionPanel from '@/components/pqrs/TransitionPanel';
import CaseTimeline from '@/components/pqrs/CaseTimeline';
import CaseComments from '@/components/pqrs/CaseComments';

export const dynamic = 'force-dynamic';

export default async function PqrsDetailPage({ params }: { params: { id: string } }) {
  const sb = createSupabaseServerClient();

  const { data: c } = await sb.from('pqrs_cases').select(`
    id, radicado, type, category, subcategory, causal, priority, status,
    narrative, summary, resolution_text, received_at, due_at, closed_at,
    assigned_to, assigned_unit_id, metadata, customer_id, service_account_id
  `).eq('id', params.id).maybeSingle();

  if (!c) return notFound();

  const [{ data: timeline }, { data: comments }, { data: customer }, { data: orders }, { data: approvals }] = await Promise.all([
    sb.from('case_timeline').select('id, event_type, actor_id, payload, created_at').eq('case_id', c.id).order('created_at', { ascending: true }),
    sb.from('case_comments').select('id, body, author_id, is_internal, created_at').eq('case_id', c.id).order('created_at', { ascending: true }),
    sb.from('customers').select('full_name, document_type, document_id, email, phone').eq('id', c.customer_id).maybeSingle(),
    sb.from('work_orders').select('id, order_number, type, status, due_at').eq('case_id', c.id).order('created_at', { ascending: false }),
    sb.from('case_approvals').select('required_role, decision, decision_note, decided_at').eq('case_id', c.id)
  ]);

  const dueDate = c.due_at ? new Date(c.due_at) : null;
  const overdue = !!dueDate && dueDate < new Date() && !['cerrado','resuelto','notificado'].includes(c.status);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Radicado</p>
          <h1 className="font-mono text-2xl font-bold">{c.radicado}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="info">{c.type}</Badge>
            {c.category && <Badge tone="neutral">{c.category}</Badge>}
            <Badge tone={c.priority === 'critica' ? 'danger' : c.priority === 'alta' ? 'warning' : 'neutral'}>
              prioridad: {c.priority}
            </Badge>
            <Badge tone={overdue ? 'danger' : 'success'}>{c.status}</Badge>
          </div>
        </div>

        <div className="text-right text-sm">
          <p className="text-gray-500">Recibido</p>
          <p className="font-medium">{new Date(c.received_at).toLocaleString('es-CO')}</p>
          <p className="mt-2 text-gray-500">Vence</p>
          <p className={overdue ? 'font-bold text-red-600' : 'font-medium'}>
            {dueDate ? dueDate.toLocaleDateString('es-CO') : '—'}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Narrativa</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{c.narrative}</p>
              {c.resolution_text && (
                <>
                  <h4 className="mt-6 font-semibold">Respuesta proyectada</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{c.resolution_text}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="comments">Comentarios</TabsTrigger>
              <TabsTrigger value="orders">Órdenes ({orders?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="approvals">Aprobaciones</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline"><CaseTimeline events={timeline ?? []} /></TabsContent>
            <TabsContent value="comments"><CaseComments caseId={c.id} initial={comments ?? []} /></TabsContent>
            <TabsContent value="orders">
              <Card><CardContent>
                {orders?.length
                  ? <ul className="divide-y">
                      {orders.map(o => (
                        <li key={o.id} className="flex justify-between py-2 text-sm">
                          <span className="font-mono">{o.order_number}</span>
                          <span>{o.type}</span>
                          <Badge tone={o.status === 'completada' ? 'success' : 'info'}>{o.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  : <p className="text-sm text-gray-500">Sin órdenes asociadas.</p>}
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="approvals">
              <Card><CardContent>
                {approvals?.length
                  ? <ul className="space-y-2 text-sm">
                      {approvals.map((a, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{a.required_role}</span>
                          <Badge tone={a.decision === 'aprobado' ? 'success' : a.decision === 'rechazado' ? 'danger' : 'warning'}>
                            {a.decision}
                          </Badge>
                          <span className="text-gray-500">{a.decided_at ? new Date(a.decided_at).toLocaleString('es-CO') : 'pendiente'}</span>
                        </li>
                      ))}
                    </ul>
                  : <p className="text-gray-500">Sin aprobaciones registradas.</p>}
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Solicitante</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{customer?.full_name}</p>
              <p className="text-xs text-gray-500">{customer?.document_type} {customer?.document_id}</p>
              <p className="mt-2 text-xs">{customer?.email ?? '—'}</p>
              <p className="text-xs">{customer?.phone ?? '—'}</p>
            </CardContent>
          </Card>

          <TransitionPanel caseId={c.id} currentStatus={c.status} />
        </aside>
      </section>
    </main>
  );
}
