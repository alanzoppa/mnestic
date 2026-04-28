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

export function EmptyState({ icon = <Search className="w-16 h-16 mx-auto mb-4 text-zinc-500" />, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="text-xl font-medium text-zinc-300">{title}</p>
      {subtitle && <p className="text-sm text-zinc-500 mt-2">{subtitle}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
