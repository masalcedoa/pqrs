import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/** Cron nocturno: corre fn_pbi_snapshot para D-1 y refresca la materialized view. */
async function handler(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createSupabaseServiceClient();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { error: e1 } = await sb.rpc('fn_pbi_snapshot', { p_date: yesterday });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  try { await sb.rpc('fn_refresh_pbi_metrics'); } catch { /* best-effort */ }

  return NextResponse.json({ snapshot_date: yesterday });
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization');           // Vercel Cron envía Bearer
  if (auth === `Bearer ${expected}`) return true;
  return req.headers.get('x-cron-key') === expected;
}

export const GET  = handler;
export const POST = handler;
export const dynamic = 'force-dynamic';
