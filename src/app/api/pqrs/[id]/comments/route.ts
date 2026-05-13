import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

const Input = z.object({ body: z.string().min(1).max(8000), is_internal: z.boolean().default(true) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const parse = Input.safeParse(await req.json());
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const sb = createSupabaseServiceClient();
  const { data: c } = await sb.from('pqrs_cases').select('org_id').eq('id', params.id).single();
  if (!c) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  const { data: comment, error } = await sb.from('case_comments').insert({
    case_id: params.id, org_id: c.org_id, author_id: user.id,
    is_internal: parse.data.is_internal, body: parse.data.body
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('case_timeline').insert({
    case_id: params.id, org_id: c.org_id,
    event_type: 'comment', actor_id: user.id,
    payload: { internal: parse.data.is_internal, length: parse.data.body.length }
  });

  return NextResponse.json({ comment });
}
