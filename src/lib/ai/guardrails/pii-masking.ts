import { createSupabaseServiceClient } from '@/lib/supabase/server';

interface Pattern { name: string; regex: RegExp; replacement: string; }

const CACHE: { patterns: Pattern[]; loadedAt: number } = { patterns: [], loadedAt: 0 };
const TTL = 5 * 60_000;

async function load(orgId: string | null): Promise<Pattern[]> {
  if (CACHE.patterns.length && Date.now() - CACHE.loadedAt < TTL) return CACHE.patterns;
  const sb = createSupabaseServiceClient();
  let q = sb.from('pii_patterns').select('name, regex, replacement').eq('is_active', true);
  if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`);
  const { data } = await q;
  const patterns = (data ?? []).map(p => ({
    name: p.name,
    regex: new RegExp(p.regex, 'g'),
    replacement: p.replacement
  }));
  CACHE.patterns  = patterns;
  CACHE.loadedAt  = Date.now();
  return patterns;
}

export async function maskPII(input: string, orgId: string | null = null): Promise<{ masked: string; replaced: number }> {
  const patterns = await load(orgId);
  let masked = input;
  let replaced = 0;
  for (const p of patterns) {
    masked = masked.replace(p.regex, () => { replaced++; return p.replacement; });
  }
  return { masked, replaced };
}
