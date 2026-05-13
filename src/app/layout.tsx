import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PQRS Energía',
  description: 'Gestión integral de PQRS para empresas de energía en Colombia.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
