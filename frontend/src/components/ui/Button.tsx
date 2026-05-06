import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { tv } from 'tailwind-variants';

const buttonStyles = tv({
  base: 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]',
  variants: {
    variant: {
      primary: 'bg-blue-600 hover:bg-blue-500 text-white focus-visible:ring-blue-400 shadow-sm shadow-blue-900/20',
      secondary: 'bg-zinc-800/80 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/80 focus-visible:ring-zinc-500',
      ghost: 'hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 focus-visible:ring-zinc-500',
      danger: 'bg-red-600 hover:bg-red-500 text-white focus-visible:ring-red-400 shadow-sm shadow-red-900/20',
    },
    size: {
      sm: 'px-3 py-1.5 text-sm rounded-md',
      md: 'px-4 py-2 rounded-lg',
      lg: 'px-6 py-3 text-lg rounded-lg',
    },
  },
  defaultVariants: {
    variant: 'secondary',
    size: 'md',
  },
});

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Loader2 className="animate-spin h-4 w-4" strokeWidth={2.5} />
      )}
      {children}
    </button>
  );
}
