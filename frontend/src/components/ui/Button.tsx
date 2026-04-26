import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { tv } from 'tailwind-variants';

const buttonStyles = tv({
  base: 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed',
  variants: {
    variant: {
      primary: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 focus:ring-blue-500',
      secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 focus:ring-zinc-600',
      ghost: 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 focus:ring-zinc-600',
      danger: 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/25 focus:ring-red-500',
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
