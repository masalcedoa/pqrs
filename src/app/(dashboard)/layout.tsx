import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveTenant } from '@/lib/tenant/context';
import Sidebar from '@/components/layout/Sidebar';
import TenantBrandingStyle from '@/components/layout/TenantBrandingStyle';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ssr = createSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await resolveTenant();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {tenant && <TenantBrandingStyle branding={tenant.branding} />}
      <Sidebar tenantName={tenant?.name ?? 'PQRS Energía'} />
      <div className="flex-1 lg:ml-64">{children}</div>
    </div>
  );
}
