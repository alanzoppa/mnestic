import { tv } from 'tailwind-variants';

const badgeStyles = tv({
  base: 'inline-flex items-center font-medium transition-colors',
  variants: {
    variant: {
      blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      pink: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
      zinc: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
      red: 'bg-red-500/10 text-red-400 border border-red-500/20',
    },
    size: {
      sm: 'px-2 py-0.5 rounded text-xs',
      md: 'px-2.5 py-0.5 rounded-full text-xs',
    },
  },
  defaultVariants: {
    variant: 'zinc',
    size: 'md',
  },
});

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'purple' | 'amber' | 'pink' | 'zinc' | 'red';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'zinc',
  size = 'md',
  className = '',
}: BadgeProps) {
  return (
    <span className={badgeStyles({ variant, size, className })} data-testid="badge">
      {children}
    </span>
  );
}
