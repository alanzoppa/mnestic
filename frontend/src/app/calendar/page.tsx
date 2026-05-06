"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type CalendarEvent } from "@/lib/api";
import { useQuery } from '@tanstack/react-query';
import { calendarEventKeys, calendarApi } from '@/lib/queries';
import { getMonthDays, toISODate, format } from '@/lib/dates';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonNoteCard } from '@/components/ui/Skeleton';

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendeeFilter, setAttendeeFilter] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startStr = toISODate(new Date(year, month, 1));
  const endStr = toISODate(new Date(year, month + 1, 0));

  const { data: events, isLoading: loading, error } = useQuery({
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

  const days = getMonthDays(year, month, 0);

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Calendar" description="Error loading calendar" accent />
        <EmptyState
          title="Failed to load calendar"
          subtitle={(error as Error)?.message || 'An unexpected error occurred'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Calendar"
        description={`${rawEvents.length} events in ${format(currentDate, "MMMM yyyy")}`}
        accent
        action={
          <div className="flex items-center gap-3">
            <Input
              placeholder="Filter by attendee..."
              value={attendeeFilter}
              onChange={(e) => setAttendeeFilter(e.target.value)}
              className="w-52"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={prevMonth}
              data-testid="month-nav-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span
              className="text-lg font-semibold text-zinc-100 min-w-40 text-center"
              data-testid="current-month"
            >
              {format(currentDate, "MMMM yyyy")}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={nextMonth}
              data-testid="month-nav-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="space-y-3">
          <SkeletonNoteCard />
          <SkeletonNoteCard />
          <SkeletonNoteCard />
        </div>
      )}

      {!loading && (
        <Card className="animate-fade-up delay-0">
          <div className="grid grid-cols-7 bg-zinc-800/50 rounded-t-xl">
            {DAYS.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-zinc-400">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-zinc-800/30" data-testid="calendar-grid">
            {days.map((day, idx) => {
              if (day === null) {
                return (
                  <div key={idx} className="min-h-24 p-2" />
                );
              }
              const dayEvents = getEventsForDay(day);
              const dateStr = toISODate(day);
              return (
                <Card
                  key={idx}
                  hover
                  onClick={() => router.push(`/calendar/${dateStr}`)}
                  className={`min-h-24 cursor-pointer rounded-none group ${dayEvents.length > 0 ? 'hover:animate-pulse-glow' : ''}`}
                  data-testid={`calendar-day-${dateStr}`}
                >
                  <CardContent className="p-2">
                    <div className={`font-medium text-sm mb-1 ${dayEvents.length > 0 ? 'transition-transform duration-200 group-hover:scale-110' : ''}`}>{day.getDate()}</div>
                    <div className="space-y-1" data-testid={`calendar-events-${dateStr}`}>
                      {dayEvents.slice(0, 3).map((event) => (
                        <Badge
                          key={event.id}
                          variant="purple"
                          size="sm"
                          className="truncate w-full block"
                          data-testid={`calendar-event-${event.id}`}
                        >
                          {event.summary}
                        </Badge>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-zinc-400">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
