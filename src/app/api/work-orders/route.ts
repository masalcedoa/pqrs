import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

const Input = z.object({
  case_id: z.string().uuid(),
  type: z.enum([
    'revision_facturacion','visita_tecnica','inspeccion_medidor',
    'suspension','reconexion','revision_lectura','ajuste_comercial','analisis_juridico'
  ]),
  description: z.string().max(2000).optional(),
  priority: z.enum(['baja','media','alta','critica']).default('media'),
  scheduled_at: z.string().datetime().optional(),
  assigned_to: z.string().uuid().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address_text: z.string().optional()
});

export async function POST(req: Request) {
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const parse = Input.safeParse(await req.json());
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const sb = createSupabaseServiceClient();
  const { data: c } = await sb.from('pqrs_cases').select('org_id').eq('id', parse.data.case_id).single();
  if (!c) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  // Carga checklist plantilla por tipo de OT
  const { data: tpl } = await sb.from('work_order_templates')
    .select('checklist').eq('type', parse.data.type).eq('is_active', true)
    .or(`org_id.eq.${c.org_id},org_id.is.null`).limit(1).maybeSingle();

  const { data: wo, error } = await sb.from('work_orders').insert({
    case_id: parse.data.case_id,
    org_id: c.org_id,
    type: parse.data.type,
    description: parse.data.description ?? null,
    priority: parse.data.priority,
    scheduled_at: parse.data.scheduled_at ?? null,
    assigned_to: parse.data.assigned_to ?? null,
    lat: parse.data.lat ?? null,
    lng: parse.data.lng ?? null,
    address_text: parse.data.address_text ?? null,
    checklist: tpl?.checklist ?? [],
    created_by: user.id,
    status: 'creada'
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('case_timeline').insert({
    case_id: parse.data.case_id, org_id: c.org_id,
    event_type: 'order_created', actor_id: user.id,
    payload: { work_order_id: wo.id, order_number: wo.order_number, type: parse.data.type }
  });

  return NextResponse.json({ work_order: wo });
}

export async function GET(req: Request) {
  const sb = createSupabaseServiceClient();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  let q = sb.from('work_orders').select('*').order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return NextResponse.json({ items: data ?? [] });
}
