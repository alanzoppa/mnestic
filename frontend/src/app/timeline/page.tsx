'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type TimelinePeriod } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { timelineKeys, timelineApi } from '@/lib/queries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SkeletonStatCards, SkeletonChart, CHART_BAR_HEIGHTS } from '@/components/ui/Skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { parse, format, isValid } from 'date-fns';

const TAGS = [
  { value: '', label: 'All tags' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'behavioral-interview', label: 'Behavioral Interview' },
  { value: 'technical-interview', label: 'Technical Interview' },
  { value: '1-on-1', label: '1-on-1s' },
  { value: 'team-lead', label: 'Team Lead' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'zendesk', label: 'Zendesk' },
  { value: 'writing', label: 'Writing' },
  { value: 'mental-health', label: 'Mental Health' },
  { value: 'handwritten', label: 'Handwritten' },
];

const GROUP_BY_OPTIONS = [
  { value: 'month', label: 'By Month' },
  { value: 'year', label: 'By Year' },
];

const CHART_TYPE_OPTIONS = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
];

export default function TimelinePage() {
  const router = useRouter();
  const [tagFilter, setTagFilter] = useState('');
  const [groupBy, setGroupBy] = useState('month');
  const [chartType, setChartType] = useState('bar');
  const [selectedBar, setSelectedBar] = useState<TimelinePeriod | null>(null);

  const {
    data: timelineData,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: timelineKeys.all(groupBy, tagFilter || undefined),
    queryFn: () => timelineApi.get(groupBy, tagFilter || undefined),
  });
  const data = timelineData ?? [];

  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const avgPerPeriod = data.length > 0 ? Math.round(totalCount / data.length) : 0;
  const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count)) : 0;

  // Prepare data for charts
  const chartData = data.map(d => ({
    ...d,
    label: groupBy === 'month' ? d.period.slice(0, 7) : d.period,
    displayLabel: groupBy === 'month'
      ? (() => {
          const parsed = parse(d.period, 'yyyy-MM', new Date());
          return isValid(parsed) ? format(parsed, "MMM ''yy") : d.period;
        })()
      : d.period,
  }));

  // Get recent periods (last 24 months or 5 years)
  const recentData = groupBy === 'month' 
    ? chartData.slice(-24)
    : chartData.slice(-10);

  const handleBarClick = (data: any) => {
    if (data && data.activePayload) {
      const period = data.activePayload[0].payload;
      setSelectedBar(period);
    }
  };

  return (
    <div className="max-w-7xl space-y-6">
      <SectionHeader
        title="Timeline"
        description="Visualize note activity over time"
        action={
          <div className="flex gap-3">
            <Select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              options={TAGS}
              className="w-40"
            />
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              options={GROUP_BY_OPTIONS}
              className="w-32"
            />
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Total Notes</p>
            <p className="text-3xl font-bold mt-1 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
              {totalCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Periods</p>
            <p className="text-3xl font-bold mt-1 text-blue-400">{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Avg per Period</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">{avgPerPeriod}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Peak Period</p>
            <p className="text-3xl font-bold mt-1 text-purple-400">{maxCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card hover>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Over Time</CardTitle>
            <Select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              options={CHART_TYPE_OPTIONS}
              className="w-32"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[400px] flex items-end gap-2">
              {CHART_BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 animate-pulse bg-zinc-800 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} onClick={handleBarClick}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="#52525b"
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    angle={groupBy === 'month' ? -45 : 0}
                    textAnchor={groupBy === 'month' ? 'end' : 'middle'}
                    height={groupBy === 'month' ? 60 : 30}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '0.5rem',
                      color: '#fafafa',
                    }}
                    cursor={{ fill: '#27272a', opacity: 0.5 }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#barGradient)" 
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer"
                  />
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="#52525b"
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    angle={groupBy === 'month' ? -45 : 0}
                    textAnchor={groupBy === 'month' ? 'end' : 'middle'}
                    height={groupBy === 'month' ? 60 : 30}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '0.5rem',
                      color: '#fafafa',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              ) : (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="#52525b"
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    angle={groupBy === 'month' ? -45 : 0}
                    textAnchor={groupBy === 'month' ? 'end' : 'middle'}
                    height={groupBy === 'month' ? 60 : 30}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '0.5rem',
                      color: '#fafafa',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    fill="url(#areaGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-zinc-500">
              No data available for the selected filter
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Mini-Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentData.length > 0 ? (
            <div className="space-y-3">
              {recentData.slice(-10).reverse().map((period) => (
                <div key={period.period} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-zinc-400">{period.displayLabel}</div>
                  <div className="flex-1">
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${maxCount > 0 ? (period.count / maxCount) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-sm font-medium text-right text-zinc-300">
                    {period.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-500 text-center py-8">No recent activity</div>
          )}
        </CardContent>
      </Card>

      {/* Selected Period Detail */}
      {selectedBar && (
        <Card className="border-blue-500/30">
          <CardHeader>
            <CardTitle>{selectedBar.period} - {selectedBar.count} notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => router.push(`/browse?date=${selectedBar.period}`)}
              >
                Browse Notes
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSelectedBar(null)}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
