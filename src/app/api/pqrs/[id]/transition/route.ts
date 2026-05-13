import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { transitionCase } from '@/application/pqrs/use-cases/transition-case';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const sb = createSupabaseServiceClient();
  const { data: profile } = await sb.from('users_profile').select('role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'sin perfil' }, { status: 403 });

  const body = await req.json();
  const result = await transitionCase({
    case_id: params.id,
    to: body.to,
    actor: { user_id: user.id, role: profile.role },
    reason: body.reason,
    payload: body.payload
  });

  if (!result.ok) {
    const code = result.error.code === 'not_authorized' ? 403
               : result.error.code === 'not_found'      ? 404
               : result.error.code === 'validation_error' ? 422
               : 400;
    return NextResponse.json({ error: result.error.toJSON() }, { status: code });
  }
  return NextResponse.json(result.value);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Devuelve las transiciones legales para el actor actual
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const sb = createSupabaseServiceClient();
  const [{ data: profile }, { data: snap }] = await Promise.all([
    sb.from('users_profile').select('role').eq('id', user.id).single(),
    sb.from('pqrs_cases').select('id, org_id, status').eq('id', params.id).single()
  ]);
  if (!profile || !snap) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });

  const { loadDefinition } = await import('@/lib/workflow/definitions');
  const def = await loadDefinition('pqrs_default', snap.org_id);
  const allowed = def.transitions.filter(t => t.from === snap.status && t.roles_allowed.includes(profile.role));
  return NextResponse.json({ from: snap.status, allowed });
}
