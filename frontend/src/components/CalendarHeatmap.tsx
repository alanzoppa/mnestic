'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { timelineKeys, timelineApi } from '@/lib/queries'
import type { TimelinePeriod } from '@/lib/api'
import { format, parseISO, getYear, startOfYear, endOfYear, eachDayOfInterval, getDay, differenceInCalendarWeeks, setYear as fnSetYear } from 'date-fns'
import { toISODate } from '@/lib/dates'

const COLORS = [
  'bg-zinc-800',
  'bg-blue-900/60',
  'bg-blue-800/70',
  'bg-blue-700/80',
  'bg-blue-600',
  'bg-blue-500',
]

interface DayData {
  date: string
  count: number
  dayOfWeek: number
  week: number
}

export function CalendarHeatmap() {
  const [year, setYear] = useState(() => getYear(new Date()))
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  const { data: periods } = useQuery({
    queryKey: timelineKeys.all('day'),
    queryFn: () => timelineApi.get('day'),
    staleTime: Infinity,
  });
  const data = periods ?? [];

  const yearData = useMemo(() => {
    const dayMap = new Map<string, number>()
    for (const p of data) {
      dayMap.set(p.period.slice(0, 10), p.count)
    }

    const yearStart = startOfYear(fnSetYear(new Date(), year))
    const yearEnd = endOfYear(fnSetYear(new Date(), year))
    const days = eachDayOfInterval({ start: yearStart, end: yearEnd })
    const mapped: DayData[] = []

    for (const d of days) {
      const dateStr = toISODate(d)
      const count = dayMap.get(dateStr) || 0
      const dayOfWeek = getDay(d)
      const weekNum = differenceInCalendarWeeks(d, yearStart, { weekStartsOn: 0 })
      mapped.push({ date: dateStr, count, dayOfWeek, week: weekNum })
    }

    return { days: mapped, maxCount: Math.max(...mapped.map(d => d.count), 1) }
  }, [data, year])

  const totalNotes = data.reduce((sum, p) => sum + p.count, 0)
  const activeDays = yearData.days.filter(d => d.count > 0).length

  const getColor = (count: number) => {
    if (count === 0) return COLORS[0]
    const ratio = count / yearData.maxCount
    if (ratio <= 0.2) return COLORS[1]
    if (ratio <= 0.4) return COLORS[2]
    if (ratio <= 0.6) return COLORS[3]
    if (ratio <= 0.8) return COLORS[4]
    return COLORS[5]
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const availableYears = useMemo(() => {
    if (data.length === 0) return [getYear(new Date())]
    const years = new Set(
      data
        .map(p => parseInt(p.period.slice(0, 4)))
        .filter(y => !isNaN(y))
    )
    return [...years].sort().reverse()
  }, [data])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">
            {activeDays} active days · {totalNotes.toLocaleString()} notes
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          Less
          {COLORS.map((color, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
          More
        </div>
      </div>

      {/* Month labels */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-[720px]">
          <div className="flex mb-1 ml-[22px]">
            {months.map((m, i) => (
              <div key={m} className="text-xs text-zinc-500" style={{ width: `${100 / 12}%` }}>
                {m}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="relative">
            <svg width="720" height="112" className="block">
              {yearData.days.map((day) => {
                const x = 22 + day.week * 13
                const y = day.dayOfWeek * 15 + 2
                const color = getColor(day.count)

                return (
                  <rect
                    key={day.date}
                    x={x}
                    y={y}
                    width={11}
                    height={11}
                    rx={2}
                    className={`${color} cursor-pointer hover:ring-1 hover:ring-white/30 transition-all`}
                    onMouseEnter={(e) => {
                      setTooltip({
                        date: day.date,
                        count: day.count,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => {
                      window.location.href = `/calendar/${day.date}`
                    }}
                  />
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm pointer-events-none"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          <div className="font-medium text-zinc-200">
            {format(parseISO(tooltip.date), 'EEE, MMM d')}
          </div>
          <div className="text-zinc-400">
            {tooltip.count} {tooltip.count === 1 ? 'note' : 'notes'}
          </div>
        </div>
      )}
    </div>
  )
}
