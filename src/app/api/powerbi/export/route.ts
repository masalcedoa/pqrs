import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Exportación CSV firmada para Power BI.
 * GET /api/powerbi/export?metric=radicados_mes&from=2025-01-01&to=2025-12-31
 * Headers: x-api-token: <token plano>
 */
const ALLOWED_METRICS = new Set([
  'pbi_snapshots_daily',
  'v_pbi_aging',
  'v_pbi_sla_causal',
  'v_pbi_por_municipio',
  'v_pbi_por_area',
  'v_pbi_tiempo_respuesta'
]);

export async function GET(req: Request) {
  const token = req.headers.get('x-api-token');
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 401 });

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const sb = createSupabaseServiceClient();
  const { data: key } = await sb.from('api_keys').select('id, is_active, expires_at, org_id').eq('hash_sha256', hash).maybeSingle();
  if (!key?.is_active) return NextResponse.json({ error: 'token inválido' }, { status: 401 });
  if (key.expires_at && new Date(key.expires_at) < new Date())
    return NextResponse.json({ error: 'token expirado' }, { status: 401 });

  const url = new URL(req.url);
  const metric = url.searchParams.get('metric') ?? '';
  const from   = url.searchParams.get('from');
  const to     = url.searchParams.get('to');

  if (!ALLOWED_METRICS.has(metric))
    return NextResponse.json({ error: 'metric inválida' }, { status: 400 });

  let q = sb.from(metric).select('*');
  if (key.org_id) q = q.eq('org_id', key.org_id);
  if (from && metric === 'pbi_snapshots_daily') q = q.gte('snapshot_date', from);
  if (to   && metric === 'pbi_snapshots_daily') q = q.lte('snapshot_date', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/csv' } });

  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => csvEscape(r[h])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');

  await sb.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', key.id);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${metric}.csv"`
    }
  });
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
