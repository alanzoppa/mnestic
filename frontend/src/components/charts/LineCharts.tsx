'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { TOOLTIP_STYLE, CARTESIAN_GRID, X_AXIS_DARK, Y_AXIS_DARK } from '@/lib/chart-styles';

interface LineChartData {
  label: string;
  [key: string]: string | number;
}

interface LineChartProps {
  data: LineChartData[];
  lines: { key: string; name: string; color: string }[];
  title?: string;
  height?: number;
  xAxisKey?: string;
  className?: string;
}

export function LineChartComponent({
  data,
  lines,
  title,
  height = 300,
  xAxisKey = 'label',
  className = '',
}: LineChartProps) {
  return (
    <div className={`card p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid {...CARTESIAN_GRID} />
          <XAxis dataKey={xAxisKey} {...X_AXIS_DARK} />
          <YAxis {...Y_AXIS_DARK} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend
            wrapperStyle={{
              color: '#9ca3af',
              fontSize: '12px',
            }}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={{ fill: line.color, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AreaChartProps extends LineChartProps {
  gradientStart?: string;
  gradientEnd?: string;
}

export function AreaChartComponent({
  data,
  lines,
  title,
  height = 300,
  xAxisKey = 'label',
  className = '',
}: AreaChartProps) {
  return (
    <div className={`card p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            {lines.map((line) => (
              <linearGradient
                key={line.key}
                id={`gradient-${line.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={line.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...CARTESIAN_GRID} />
          <XAxis dataKey={xAxisKey} {...X_AXIS_DARK} />
          <YAxis {...Y_AXIS_DARK} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend
            wrapperStyle={{
              color: '#9ca3af',
              fontSize: '12px',
            }}
          />
          {lines.map((line) => (
            <Area
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              fill={`url(#gradient-${line.key})`}
              dot={{ fill: line.color, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}