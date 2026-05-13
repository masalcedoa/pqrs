import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

const CreateOrgInput = z.object({
  slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  nit:  z.string().optional(),
  plan_code: z.enum(['starter','pro','enterprise']).default('starter'),
  domain: z.string().optional(),
  branding: z.record(z.unknown()).optional()
});

export async function POST(req: Request) {
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const body = await req.json();
  const parse = CreateOrgInput.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const sb = createSupabaseServiceClient();
  const { data: org, error } = await sb.from('organizations').insert({
    slug: parse.data.slug, name: parse.data.name, nit: parse.data.nit ?? null,
    plan_code: parse.data.plan_code, domain: parse.data.domain ?? null,
    branding: parse.data.branding ?? {}, created_by: user.id
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El creador queda como admin de la nueva org.
  await sb.from('org_members').insert({
    org_id: org.id, user_id: user.id, role: 'admin', is_default: true
  });

  return NextResponse.json({ org });
}

export async function GET() {
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const sb = createSupabaseServiceClient();
  const { data, error } = await sb.from('org_members')
    .select('role, organizations(id, slug, name, plan_code, branding)')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: data });
}
