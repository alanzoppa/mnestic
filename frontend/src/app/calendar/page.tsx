"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type CalendarEvent } from "@/lib/api";
import { useQuery } from '@tanstack/react-query';
import { calendarEventKeys, calendarApi } from '@/lib/queries';
import { getMonthDays, toISODate, format } from '@/lib/dates';

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendeeFilter, setAttendeeFilter] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startStr = toISODate(new Date(year, month, 1));
  const endStr = toISODate(new Date(year, month + 1, 0));

  const { data: events, isLoading: loading } = useQuery({
    queryKey: calendarEventKeys.range(startStr, endStr),
    queryFn: () => calendarApi.events(startStr, endStr),
  });

  const rawEvents = events || [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    rawEvents.forEach((event) => {
      const eventDate = event.date || event.start.split("T")[0];
      if (!eventDate) return;
      if (attendeeFilter) {
        const attendees = event.attendees || "";
        if (!attendees.toLowerCase().includes(attendeeFilter.toLowerCase())) return;
      }
      const existing = map.get(eventDate) || [];
      existing.push(event);
      map.set(eventDate, existing);
    });
    return map;
  }, [rawEvents, attendeeFilter]);

  const getEventsForDay = (day: Date) => {
    const dateStr = toISODate(day);
    return eventsByDate.get(dateStr) || [];
  };

  const days = getMonthDays(year, month, 0); // weekStartsOn=0 (Sunday) to match DAYS array

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Calendar</h1>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Filter by attendee..."
              value={attendeeFilter}
              onChange={(e) => setAttendeeFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm w-48"
            />
            <button
              onClick={prevMonth}
              className="bg-zinc-800 hover:bg-zinc-700 rounded p-2"
              data-testid="month-nav-prev"
            >
              ←
            </button>
            <span className="text-lg font-semibold w-40 text-center" data-testid="current-month">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <button
              onClick={nextMonth}
              className="bg-zinc-800 hover:bg-zinc-700 rounded p-2"
              data-testid="month-nav-next"
            >
              →
            </button>
          </div>
        </div>

        {loading && <p className="text-zinc-400">Loading events...</p>}

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-zinc-800">
            {DAYS.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-zinc-400">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-zinc-800" data-testid="calendar-grid">
            {days.map((day, idx) => {
              if (day === null) {
                return (
                  <div key={idx} className="bg-zinc-950 min-h-24 p-2" />
                );
              }
              const dayEvents = getEventsForDay(day);
              const dateStr = toISODate(day);
              return (
                <div
                  key={idx}
                  onClick={() => router.push(`/calendar/${dateStr}`)}
                  className="bg-zinc-900 min-h-24 p-2 cursor-pointer hover:bg-zinc-800"
                  data-testid={`calendar-day-${dateStr}`}
                >
                  <div className="font-medium text-sm mb-1">{day.getDate()}</div>
                  <div className="space-y-1" data-testid={`calendar-events-${dateStr}`}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs bg-zinc-700 rounded px-1 py-0.5 truncate"
                        data-testid={`calendar-event-${event.id}`}
                      >
                        {event.summary}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-zinc-400">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
