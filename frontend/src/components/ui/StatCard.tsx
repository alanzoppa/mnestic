import { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatCard({
  value,
  label,
  icon,
  trend,
  className = '',
}: StatCardProps) {
  return (
    <div className={`card-hover p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-100">
            {value}
          </p>
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-sm ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendingUp
                className={`w-4 h-4 ${!trend.positive ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-zinc-800 rounded-lg text-blue-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function StatsGrid({ children, columns = 4 }: StatsGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };
  
  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {children}
    </div>
  );
}
