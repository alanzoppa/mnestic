'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TOOLTIP_STYLE } from '@/lib/chart-styles';

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: PieChartData[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#f97316', // orange
];

export function DonutChart({
  data,
  title,
  height = 300,
  showLegend = true,
  className = '',
}: DonutChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={`card p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [
              `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              String(name),
            ]}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                color: '#9ca3af',
                fontSize: '12px',
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {total > 0 && (
        <div className="text-center text-sm text-zinc-500 mt-2">
          Total: {total.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function PieChartComponent({
  data,
  title,
  height = 300,
  showLegend = true,
  className = '',
}: DonutChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={`card p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [
              `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              String(name),
            ]}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                color: '#9ca3af',
                fontSize: '12px',
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}