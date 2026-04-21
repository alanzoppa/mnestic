"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCalendarEvents } from "@/lib/api";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string;
  attendees: string;
  date: string;
  description?: string;
  event_type?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [attendeeFilter, setAttendeeFilter] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
    const result = await getCalendarEvents(startStr, endStr);
    setEvents(result.events);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(event => {
      if (!event.date && !event.start) return false;
      const eventDate = event.date || event.start.split("T")[0];
      if (eventDate !== dateStr) return false;
      if (attendeeFilter && !event.attendees?.toLowerCase().includes(attendeeFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  };

  const days = getDaysInMonth();

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
              {MONTHS[month]} {year}
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
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              return (
                <div
                  key={idx}
                  onClick={() => router.push(`/calendar/${dateStr}`)}
                  className="bg-zinc-900 min-h-24 p-2 cursor-pointer hover:bg-zinc-800"
                >
                  <div className="font-medium text-sm mb-1">{day}</div>
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