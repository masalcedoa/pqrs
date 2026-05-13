'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pqrs',      label: 'Casos PQRS' },
  { href: '/ordenes',   label: 'Órdenes' },
  { href: '/admin',     label: 'Admin' }
];

export default function Sidebar({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-white lg:flex">
      <div className="border-b px-5 py-4">
        <p className="text-xs uppercase text-gray-400">Tenant</p>
        <p className="font-semibold text-brand-700">{tenantName}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'block rounded px-3 py-2 text-sm font-medium',
              pathname?.startsWith(item.href)
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form action="/api/auth/signout" method="post" className="border-t p-3">
        <button className="text-sm text-gray-500 hover:text-gray-800">Cerrar sesión</button>
      </form>
    </aside>
  );
}
