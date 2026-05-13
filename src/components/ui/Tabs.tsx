'use client';
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface TabsCtx { value: string; setValue: (v: string) => void; }
const Ctx = React.createContext<TabsCtx | null>(null);

export function Tabs({ defaultValue, value, onValueChange, children, className }: {
  defaultValue?: string; value?: string; onValueChange?: (v: string) => void;
  children: React.ReactNode; className?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const current = value ?? internal;
  const setValue = (v: string) => { setInternal(v); onValueChange?.(v); };
  return <Ctx.Provider value={{ value: current, setValue }}><div className={className}>{children}</div></Ctx.Provider>;
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('inline-flex rounded-md border bg-gray-50 p-1', className)}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        'rounded px-3 py-1.5 text-sm font-medium transition',
        active ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className="mt-4">{children}</div>;
}
