import { headers, cookies } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export interface TenantContext {
  orgId: string;
  slug:  string;
  name:  string;
  branding: Record<string, unknown>;
  plan: string;
}

/**
 * Resuelve el tenant activo para la request actual.
 * Prioridad: subdominio → header x-org → cookie app_org → membresía única.
 */
export async function resolveTenant(): Promise<TenantContext | null> {
  const h = headers();
  const host = h.get('host') ?? '';
  const xOrg = h.get('x-org');
  const cookie = cookies().get('app_org')?.value;

  const sb = createSupabaseServiceClient();

  // 1) subdominio
  const subdomain = extractSubdomain(host);
  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    const { data } = await sb.from('organizations')
      .select('id, slug, name, branding, plan_code')
      .eq('slug', subdomain).eq('is_active', true).maybeSingle();
    if (data) return mapOrg(data);
  }

  // 2) header x-org (slug o uuid)
  if (xOrg) {
    const filter = xOrg.match(/^[0-9a-f-]{36}$/i) ? 'id' : 'slug';
    const { data } = await sb.from('organizations')
      .select('id, slug, name, branding, plan_code')
      .eq(filter, xOrg).eq('is_active', true).maybeSingle();
    if (data) return mapOrg(data);
  }

  // 3) cookie
  if (cookie) {
    const { data } = await sb.from('organizations')
      .select('id, slug, name, branding, plan_code')
      .eq('id', cookie).eq('is_active', true).maybeSingle();
    if (data) return mapOrg(data);
  }

  // 4) membresía única (requiere usuario autenticado)
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (user) {
    const { data: mems } = await sb.from('org_members')
      .select('org_id, organizations(id, slug, name, branding, plan_code)')
      .eq('user_id', user.id).limit(2);
    if (mems?.length === 1) {
      const org = (mems[0] as { organizations: unknown }).organizations as {
        id: string; slug: string; name: string; branding: Record<string, unknown>; plan_code: string;
      };
      return mapOrg(org);
    }
  }

  return null;
}

function mapOrg(data: { id: string; slug: string; name: string; branding: Record<string, unknown>; plan_code: string }): TenantContext {
  return {
    orgId: data.id, slug: data.slug, name: data.name,
    branding: data.branding ?? {}, plan: data.plan_code
  };
}

function extractSubdomain(host: string): string | null {
  const cleaned = host.replace(/:\d+$/, '');
  const parts = cleaned.split('.');
  if (parts.length < 3) return null;
  return parts[0];
}

/**
 * En servidor: setea `app.current_org` para que las funciones RLS lo lean.
 * Usar antes de cualquier query que dependa del tenant activo.
 */
export async function setDbTenantContext(orgId: string) {
  const sb = createSupabaseServiceClient();
  try {
    // Requiere función pública: fn_set_current_org(p_org uuid) — ver migración 0021.
    await sb.rpc('fn_set_current_org', { p_org: orgId } as never);
  } catch {
    // Best-effort: si la función no existe, las consultas siguen usando el JWT claim.
  }
}
