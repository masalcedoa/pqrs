import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'subtle';
type Size    = 'sm' | 'md' | 'lg' | 'icon';

const styles: Record<Variant, string> = {
  default:     'bg-brand-600 text-white hover:bg-brand-700',
  outline:     'border border-gray-300 bg-white hover:bg-gray-50',
  ghost:       'hover:bg-gray-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  subtle:      'bg-gray-100 text-gray-800 hover:bg-gray-200'
};
const sizes: Record<Size, string> = {
  sm:   'h-8  px-3 text-xs',
  md:   'h-10 px-4 text-sm',
  lg:   'h-12 px-6 text-base',
  icon: 'h-9 w-9'
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
        styles[variant], sizes[size], className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
