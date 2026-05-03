"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from '@tanstack/react-query';
import { calendarEventKeys, calendarApi } from '@/lib/queries';
import type { CalendarDateNote } from '@/lib/api';
import { parseISO, format, isValid } from 'date-fns';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonNoteCard } from '@/components/ui/Skeleton';

const getDateParam = (params: Record<string, string | string[] | undefined>): string => {
  const val = params.date;
  return Array.isArray(val) ? val[0] ?? '' : val ?? '';
};

export default function CalendarDatePage() {
  const router = useRouter();
  const params = useParams();
  const dateStr = getDateParam(params as Record<string, string | string[] | undefined>);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: calendarEventKeys.date(dateStr),
    queryFn: () => calendarApi.date(dateStr),
    enabled: !!dateStr,
  });
  const events = data?.events ?? [];
  const notes: CalendarDateNote[] = data?.notes ?? [];

  const formattedDate = isValid(parseISO(dateStr))
    ? format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
    : dateStr;

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    const d = parseISO(isoString);
    if (!isValid(d)) return "";
    return format(d, "h:mm a");
  };

  if (error) {
    return (
      <div className="max-w-4xl space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/calendar")}
          data-testid="back-to-calendar"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Calendar
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <EmptyState
              title="Failed to load calendar"
              subtitle={(error as Error)?.message || 'An unexpected error occurred'}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/calendar")}
        data-testid="back-to-calendar"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Calendar
      </Button>

      <h1
        className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent"
        data-testid="date-title"
      >
        {formattedDate}
      </h1>

      {loading && (
        <div className="space-y-3">
          <SkeletonNoteCard />
          <SkeletonNoteCard />
          <SkeletonNoteCard />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">Events <span className="text-zinc-500 font-normal text-sm">({events.length})</span></h2>
            {events.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <EmptyState title="No events on this day" />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <Card key={event.id} hover className="mb-3">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{event.summary}</h3>
                          <p className="text-sm text-zinc-400 mt-1">
                            {formatTime(event.start)} - {formatTime(event.end)}
                          </p>
                        </div>
                        {event.event_type && (
                          <Badge variant="purple" size="sm">
                            {event.event_type}
                          </Badge>
                        )}
                      </div>
                      {event.location && (
                        <p className="text-sm text-zinc-400 mt-2">
                          <MapPin className="w-3.5 h-3.5 inline mr-1" />
                          {event.location}
                        </p>
                      )}
                      {event.attendees && (
                        <p className="text-sm text-zinc-400 mt-1">
                          <Users className="w-3.5 h-3.5 inline mr-1" />
                          {event.attendees}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-sm text-zinc-300 mt-3 border-t border-zinc-800 pt-3">
                          {event.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Notes <span className="text-zinc-500 font-normal text-sm">({notes.length})</span></h2>
            {notes.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <EmptyState title="No notes on this day" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {notes.map((note) => (
                  <Card
                    key={note.id}
                    hover
                    onClick={() => router.push(`/notes/${note.id}`)}
                    className="cursor-pointer group"
                  >
                    <CardContent className="p-4">
                      <h3 className="font-medium">{note.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="zinc" size="sm">
                          {note.metadata.folder}
                        </Badge>
                        <span className="text-xs text-zinc-400">{note.metadata.source}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
