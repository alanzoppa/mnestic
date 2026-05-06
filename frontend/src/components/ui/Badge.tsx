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
    active: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'zinc',
    size: 'md',
    active: false,
  },
});

const activeBgMap: Record<string, string> = {
  blue: 'bg-blue-500/25',
  green: 'bg-emerald-500/25',
  purple: 'bg-purple-500/25',
  amber: 'bg-amber-500/25',
  pink: 'bg-pink-500/25',
  zinc: 'bg-zinc-700',
  red: 'bg-red-500/25',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'purple' | 'amber' | 'pink' | 'zinc' | 'red';
  size?: 'sm' | 'md';
  className?: string;
  'data-testid'?: string;
  'data-active'?: 'true' | 'false';
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

export function Badge({
  children,
  variant = 'zinc',
  size = 'md',
  className = '',
  'data-testid': dataTestId = 'badge',
  'data-active': dataActive,
  onClick,
}: BadgeProps) {
  const isActive = dataActive === 'true';
  const activeClass = isActive ? activeBgMap[variant] : '';
  const interactiveClass = onClick
    ? 'cursor-pointer hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
    : '';

  return (
    <span
      className={badgeStyles({ variant, size, className }) + (activeClass ? ` ${activeClass}` : '') + (interactiveClass ? ` ${interactiveClass}` : '')}
      data-testid={dataTestId}
      data-active={dataActive}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </span>
  );
}
