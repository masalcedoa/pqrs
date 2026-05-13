import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Cron diario: marca vencidos y notifica próximos a vencer.
 * Acepta GET (Vercel Cron con Authorization: Bearer $CRON_SECRET) y POST (manual con x-cron-key).
 */
async function handler(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createSupabaseServiceClient();

  const { data: overdue } = await sb.from('pqrs_cases').select('id, org_id')
    .lt('due_at', new Date().toISOString())
    .not('status', 'in', '("cerrado","resuelto","notificado","vencido")');

  for (const c of overdue ?? []) {
    await sb.from('pqrs_cases').update({ status: 'vencido' }).eq('id', c.id);
    await sb.from('case_timeline').insert({
      case_id: c.id, org_id: c.org_id, event_type: 'overdue',
      payload: { detected_at: new Date().toISOString() }
    });
  }

  const limit = new Date(Date.now() + 3 * 86400000).toISOString();
  const { data: soon } = await sb.from('pqrs_cases')
    .select('id, org_id, radicado, due_at, assigned_to')
    .gte('due_at', new Date().toISOString())
    .lte('due_at', limit)
    .not('status', 'in', '("cerrado","resuelto","notificado","vencido")');

  for (const c of soon ?? []) {
    if (!c.assigned_to) continue;
    const { data: u } = await sb.from('users_profile').select('full_name').eq('id', c.assigned_to).maybeSingle();
    await sb.from('notifications').insert({
      case_id: c.id, org_id: c.org_id, channel: 'email',
      recipient: 'analista@ejemplo.co',
      subject: `PQRS ${c.radicado} próxima a vencer`,
      body: `El caso ${c.radicado} asignado a ${u?.full_name ?? 'analista'} vence el ${new Date(c.due_at!).toLocaleString('es-CO')}.`,
      template: 'PROXIMO_VENCER',
      payload: { radicado: c.radicado, fecha_limite: c.due_at }
    });
  }

  return NextResponse.json({ overdue_marked: overdue?.length ?? 0, near_due: soon?.length ?? 0 });
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${expected}`) return true;
  return req.headers.get('x-cron-key') === expected;
}

export const GET  = handler;
export const POST = handler;
export const dynamic = 'force-dynamic';
