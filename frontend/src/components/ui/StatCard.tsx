import { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';
import { useCountUp } from '@/lib/hooks';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
  delay?: 0 | 80 | 160 | 240;
}

function AnimatedValue({ value }: { value: number }) {
  const animated = useCountUp(value, 800);
  return <>{animated}</>;
}

export function StatCard({
  value,
  label,
  icon,
  trend,
  className = '',
  delay = 0,
}: StatCardProps) {
  return (
    <div className={`card-hover p-5 animate-fade-up delay-${delay} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight leading-none">
            {typeof value === 'number' ? <AnimatedValue value={value} /> : value}
          </p>
          {trend && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendingUp
                className={`w-3.5 h-3.5 ${!trend.positive ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 text-zinc-600">
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