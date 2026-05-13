import { NextResponse } from 'next/server';
import { dispatchPending } from '@/lib/notifications/dispatcher';

async function handler(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await dispatchPending(50);
  return NextResponse.json(result);
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
