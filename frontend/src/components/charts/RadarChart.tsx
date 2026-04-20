'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface RadarChartData {
  metric: string;
  value: number;
  fullMark: number;
}

interface RadarChartProps {
  data: RadarChartData[];
  title?: string;
  height?: number;
  color?: string;
  fillColor?: string;
  className?: string;
}

export function RadarChartComponent({
  data,
  title,
  height = 300,
  color = '#8b5cf6',
  fillColor = 'rgba(139, 92, 246, 0.3)',
  className = '',
}: RadarChartProps) {
  return (
    <div className={`chart-container ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 'auto']}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Stats"
            dataKey="value"
            stroke={color}
            fill={fillColor}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '0.5rem',
              color: '#fafafa',
            }}
            formatter={(value: number) => [value, '']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
