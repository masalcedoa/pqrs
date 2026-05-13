import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const toneClasses: Record<Tone, string> = {
  default: 'bg-brand-100 text-brand-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100  text-amber-800',
  danger:  'bg-red-100    text-red-700',
  info:    'bg-sky-100    text-sky-700',
  neutral: 'bg-gray-100   text-gray-700'
};

export function Badge({
  tone = 'default',
  className,
  ...props
}: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone], className
      )}
      {...props}
    />
  );
}
