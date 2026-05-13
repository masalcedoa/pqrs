'use client';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

export interface Kpi {
  label: string;
  value: number | string;
  delta?: number;            // % vs período anterior
  highlight?: 'good' | 'warn' | 'danger';
}

export default function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className={cn(
            'border-l-4',
            k.highlight === 'danger' && 'border-l-red-500',
            k.highlight === 'warn'   && 'border-l-amber-500',
            k.highlight === 'good'   && 'border-l-emerald-500',
            !k.highlight             && 'border-l-brand-500'
          )}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">{k.label}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{k.value}</p>
              {typeof k.delta === 'number' && (
                <p className={cn(
                  'mt-1 text-xs font-medium',
                  k.delta >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta).toFixed(1)}% vs período anterior
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
