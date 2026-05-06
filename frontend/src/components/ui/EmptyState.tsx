import { Search } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
        <div className="relative mb-6">
        {/* Warm glow behind icon */}
        <div className="absolute inset-0 blur-2xl opacity-20 bg-blue-500/30 rounded-full scale-[2] animate-breathe" />
        <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-zinc-900/80 border border-zinc-800/60 text-zinc-400 animate-float">
          {icon || <Search className="w-7 h-7" strokeWidth={1.5} />}
        </div>
      </div>
      <h3 className="text-2xl font-extrabold text-zinc-100 tracking-tight mb-2">
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-zinc-400 font-normal leading-relaxed max-w-sm mx-auto mb-6">
          {/\b(nothing|no results|empty)\b/i.test(title) 
            ? "Go ahead and create something wonderful — the blank page is waiting."
            : subtitle}
        </p>
      )}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}