// Ruta de diagnostico de sesion. SOLO disponible en NODE_ENV=development.
// Muestra exactamente lo que ve el servidor sobre la sesion del navegador.
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { resolveTenant } from '@/lib/tenant/context';

export const dynamic = 'force-dynamic';

interface Row { label: string; value: string; ok?: boolean }

export default async function DebugSessionPage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  const cookieJar = cookies();
  const hdrs = headers();
  const ssr = createSupabaseServerClient();

  const { data: userData, error: userErr } = await ssr.auth.getUser();
  const user = userData?.user;

  // Cookies sb-*
  const sbCookies = cookieJar.getAll().filter(c => c.name.startsWith('sb-'));
  const allCookieNames = cookieJar.getAll().map(c => c.name);

  // Perfil + membresia + org (via service client porque debug)
  let profileRole: string | null = null;
  let orgRole: string | null = null;
  let orgSlug: string | null = null;
  let currentRoleRpc = '(no probado)';
  let currentOrgRpc  = '(no probado)';

  if (user) {
    const svc = createSupabaseServiceClient();
    const { data: prof } = await svc.from('users_profile').select('role').eq('id', user.id).maybeSingle();
    profileRole = prof?.role ?? null;
    const { data: mem } = await svc.from('org_members')
      .select('role, organizations(slug)').eq('user_id', user.id).eq('is_default', true).maybeSingle();
    orgRole = mem?.role ?? null;
    orgSlug = (mem?.organizations as unknown as { slug: string } | null)?.slug ?? null;

    // Probar las funciones RLS (best-effort)
    try {
      const { data: r1 } = await ssr.rpc('fn_current_role' as never);
      currentRoleRpc = String(r1 ?? '(null)');
    } catch (e) { currentRoleRpc = `error: ${(e as Error).message}`; }
    try {
      const { data: r2 } = await ssr.rpc('current_org_id' as never);
      currentOrgRpc = String(r2 ?? '(null)');
    } catch (e) { currentOrgRpc = `error: ${(e as Error).message}`; }
  }

  const tenant = await resolveTenant();

  const headerHost   = hdrs.get('host') ?? '(no host)';
  const headerCookie = hdrs.get('cookie') ?? '(no cookie header)';

  const rows: Row[] = [
    { label: 'NODE_ENV',                   value: process.env.NODE_ENV ?? '?' },
    { label: 'NEXT_PUBLIC_SUPABASE_URL',   value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(no set)' },
    { label: 'host header',                value: headerHost },
    { label: 'cookie header (truncated)',  value: headerCookie.slice(0, 200) + (headerCookie.length > 200 ? '…' : '') },
    { label: 'sb-* cookies presentes',     value: sbCookies.length ? sbCookies.map(c => c.name).join(', ') : '(ninguna)', ok: sbCookies.length > 0 },
    { label: 'todas las cookies',          value: allCookieNames.join(', ') || '(ninguna)' },
    { label: 'auth.getUser() error',       value: userErr?.message ?? '(none)', ok: !userErr },
    { label: 'user.email',                 value: user?.email ?? '(no user)', ok: !!user },
    { label: 'user.id',                    value: user?.id ?? '-' },
    { label: 'user.email_confirmed_at',    value: user?.email_confirmed_at ?? '-' },
    { label: 'users_profile.role',         value: profileRole ?? '-', ok: profileRole === 'admin' || profileRole === 'super_admin' },
    { label: 'org_members.role (default)', value: orgRole ?? '-' },
    { label: 'organizations.slug',         value: orgSlug ?? '-' },
    { label: 'fn_current_role()',          value: currentRoleRpc },
    { label: 'current_org_id()',           value: currentOrgRpc },
    { label: 'resolveTenant().orgId',      value: tenant?.orgId ?? '(null)', ok: !!tenant },
    { label: 'resolveTenant().slug',       value: tenant?.slug  ?? '-' },
    { label: 'resolveTenant().name',       value: tenant?.name  ?? '-' }
  ];

  const sessionOk = !!user && !!tenant;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 font-mono text-sm">
      <h1 className="text-2xl font-bold font-sans">Debug · Session</h1>
      <p className="mt-1 text-gray-500 font-sans">Solo disponible en NODE_ENV=development.</p>

      <div className={`mt-4 rounded-md p-4 ${sessionOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        <p className={`font-semibold ${sessionOk ? 'text-emerald-800' : 'text-amber-800'}`}>
          {sessionOk ? 'Sesion activa detectada por el servidor' : 'No hay sesion server-side'}
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Si la cookie sb-* aparece pero auth.getUser() no devuelve usuario, la cookie esta corrupta o pertenece a otro origen. Ver doc 16-DEBUG-SESION-NAVEGADOR.md
        </p>
      </div>

      <table className="mt-6 w-full border-collapse">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5 pr-4 align-top text-gray-500 w-64">{r.label}</td>
              <td className={`py-1.5 break-all ${r.ok === false ? 'text-red-600' : r.ok === true ? 'text-emerald-700' : 'text-gray-900'}`}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex gap-3 font-sans">
        <Link href="/login" className="rounded-md border border-gray-300 px-3 py-1.5">Volver a /login</Link>
        {user && <Link href="/dashboard" className="rounded-md bg-brand-600 px-3 py-1.5 text-white">Ir a /dashboard</Link>}
        {user && (
          <form action="/api/auth/signout" method="post">
            <button className="rounded-md border border-red-300 px-3 py-1.5 text-red-700">Cerrar sesion</button>
          </form>
        )}
      </div>
    </main>
  );
}
