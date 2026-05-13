import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Rate limit por token bucket persistido en Postgres.
 * Para alta concurrencia, migrar a Redis (Upstash) sin cambiar la firma.
 */
export interface RateLimitOptions {
  key: string;
  capacity: number;
  refillPerSecond: number;
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function consumeRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const cost = opts.cost ?? 1;
  const sb = createSupabaseServiceClient();
  const now = Date.now();

  const { data: row } = await sb.from('rate_limit_buckets').select('*').eq('bucket_key', opts.key).maybeSingle();
  if (!row) {
    await sb.from('rate_limit_buckets').insert({
      bucket_key: opts.key,
      tokens: opts.capacity - cost,
      capacity: opts.capacity,
      refill_rate: opts.refillPerSecond
    });
    return { allowed: true, remaining: opts.capacity - cost, retryAfterMs: 0 };
  }

  const elapsedSec = Math.max(0, (now - new Date(row.updated_at).getTime()) / 1000);
  const refilled = Math.min(row.capacity, row.tokens + elapsedSec * Number(row.refill_rate));

  if (refilled < cost) {
    await sb.from('rate_limit_buckets').update({
      tokens: refilled, updated_at: new Date().toISOString()
    }).eq('bucket_key', opts.key);
    const retryAfterMs = Math.ceil(((cost - refilled) / Number(row.refill_rate)) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  const newTokens = refilled - cost;
  await sb.from('rate_limit_buckets').update({
    tokens: newTokens, updated_at: new Date().toISOString()
  }).eq('bucket_key', opts.key);
  return { allowed: true, remaining: newTokens, retryAfterMs: 0 };
}

export async function recordAbuse(opts: {
  orgId?: string | null; userId?: string | null; ip?: string | null;
  signal: string; severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>; blocked?: boolean;
}) {
  const sb = createSupabaseServiceClient();
  await sb.from('abuse_signals').insert({
    org_id: opts.orgId ?? null,
    user_id: opts.userId ?? null,
    ip: opts.ip ?? null,
    signal: opts.signal,
    severity: opts.severity ?? 'low',
    context: opts.context ?? {},
    blocked: opts.blocked ?? false
  });
}
