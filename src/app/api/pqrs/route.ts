import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { clasificarPqrs } from '@/lib/ai/agent';

const InputSchema = z.object({
  customer: z.object({
    kind:          z.enum(['persona_natural', 'persona_juridica']),
    document_type: z.enum(['CC', 'CE', 'NIT', 'TI', 'PA']),
    document_id:   z.string().min(3),
    full_name:     z.string().min(2),
    email:         z.string().email().optional().or(z.literal('')),
    phone:         z.string().optional()
  }),
  service_account: z.object({
    account_number: z.string(),
    address:        z.string().optional(),
    municipality:   z.string().optional()
  }).optional(),
  type:      z.enum(['peticion','queja','reclamo','recurso_reposicion','recurso_apelacion','denuncia','solicitud_tecnica']),
  category:  z.string().optional(),
  narrative: z.string().min(20),
  channel:   z.string().optional()
});

export async function POST(req: Request) {
  const body  = await req.json();
  const parse = InputSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  const data = parse.data;

  const supabase = createSupabaseServiceClient();

  // 0. Resolver org de destino para esta radicación pública.
  //    Prioridad: header x-org (uuid o slug) → subdominio → ÚNICA org activa (fallback dev).
  const orgId = await resolvePublicOrg(req, supabase);
  if (!orgId) return NextResponse.json({ error: 'no se pudo resolver organización destino' }, { status: 400 });

  // 1. upsert customer
  const { data: customer, error: errCust } = await supabase
    .from('customers')
    .upsert(
      {
        kind:          data.customer.kind,
        document_type: data.customer.document_type,
        document_id:   data.customer.document_id,
        full_name:     data.customer.full_name,
        email:         data.customer.email || null,
        phone:         data.customer.phone || null,
        org_id:        orgId
      },
      { onConflict: 'document_type,document_id' }
    )
    .select()
    .single();

  if (errCust) return NextResponse.json({ error: errCust.message }, { status: 500 });

  // 2. cuenta de servicio (si vino)
  let serviceAccountId: string | null = null;
  if (data.service_account?.account_number) {
    const { data: sa } = await supabase
      .from('service_accounts')
      .upsert(
        {
          account_number: data.service_account.account_number,
          customer_id:    customer.id,
          address:        data.service_account.address ?? '',
          municipality:   data.service_account.municipality ?? '',
          org_id:         orgId
        },
        { onConflict: 'account_number' }
      )
      .select()
      .single();
    serviceAccountId = sa?.id ?? null;
  }

  // 3. clasificación IA (no bloqueante si falla)
  let classification: Awaited<ReturnType<typeof clasificarPqrs>> | null = null;
  try { classification = await clasificarPqrs(data.narrative); } catch { /* ignore */ }

  // 4. crear caso
  const { data: pqrs, error: errCase } = await supabase
    .from('pqrs_cases')
    .insert({
      customer_id:        customer.id,
      service_account_id: serviceAccountId,
      org_id:             orgId,
      channel:            data.channel ?? 'portal',
      type:               data.type,
      category:           data.category || classification?.category || null,
      subcategory:        classification?.subcategory ?? null,
      causal:             classification?.causal ?? null,
      priority:           classification?.priority ?? 'media',
      narrative:          data.narrative,
      summary:            classification ? `${classification.type} - ${classification.category}` : null,
      metadata: {
        requires_visit:  classification?.requires_visit ?? false,
        suggested_unit:  classification?.suggested_unit ?? null
      },
      status: 'radicado'
    })
    .select()
    .single();

  if (errCase) return NextResponse.json({ error: errCase.message }, { status: 500 });

  // 5. registrar clasificación
  if (classification) {
    await supabase.from('pqrs_classifications').insert({
      case_id:     pqrs.id,
      type:        classification.type,
      category:    classification.category,
      subcategory: classification.subcategory,
      causal:      classification.causal,
      priority:    classification.priority,
      source:      'ai',
      confidence:  classification.confidence,
      model:       process.env.ANTHROPIC_MODEL_FAST
    });
  }

  return NextResponse.json({ id: pqrs.id, radicado: pqrs.radicado, due_at: pqrs.due_at });
}

export async function GET(req: Request) {
  const supabase = createSupabaseServiceClient();
  const url      = new URL(req.url);
  const q        = url.searchParams.get('q');
  const status   = url.searchParams.get('status');

  let query = supabase.from('pqrs_cases')
    .select('id, radicado, type, category, status, priority, received_at, due_at, customer_id')
    .order('received_at', { ascending: false }).limit(100);

  if (status) query = query.eq('status', status);
  if (q)      query = query.or(`radicado.ilike.%${q}%,narrative.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

/**
 * Resuelve la organización destino de una radicación pública.
 * 1) Header `x-org` (uuid o slug)
 * 2) Subdominio del Host (slug)
 * 3) Fallback: si solo existe una organización activa, esa.
 */
async function resolvePublicOrg(
  req: Request,
  sb: ReturnType<typeof createSupabaseServiceClient>
): Promise<string | null> {
  const xOrg = req.headers.get('x-org');
  if (xOrg) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(xOrg);
    const { data } = await sb.from('organizations')
      .select('id').eq(isUuid ? 'id' : 'slug', xOrg).eq('is_active', true).maybeSingle();
    if (data) return data.id;
  }

  const host = req.headers.get('host') ?? '';
  const parts = host.replace(/:\d+$/, '').split('.');
  if (parts.length >= 3) {
    const slug = parts[0];
    if (slug && slug !== 'www' && slug !== 'app') {
      const { data } = await sb.from('organizations')
        .select('id').eq('slug', slug).eq('is_active', true).maybeSingle();
      if (data) return data.id;
    }
  }

  // Fallback: única org activa (típico en dev / single-tenant).
  const { data: orgs } = await sb.from('organizations')
    .select('id').eq('is_active', true).limit(2);
  if (orgs?.length === 1) return orgs[0].id;
  return null;
}
