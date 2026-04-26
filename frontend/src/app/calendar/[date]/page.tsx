"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from '@tanstack/react-query';
import { calendarEventKeys, calendarApi } from '@/lib/queries';
import { type CalendarEvent } from "@/lib/api";

interface Note {
  id: string;
  title: string;
  folder: string;
  created: string;
  modified: string;
  source: string;
  source_id: string;
  tags: string[];
  participants: string[];
}

export default function CalendarDatePage() {
  const router = useRouter();
  const params = useParams();
  const date = params.date as string;

  const { data, isLoading: loading } = useQuery({
    queryKey: calendarEventKeys.date(date),
    queryFn: () => calendarApi.date(date),
    enabled: !!date,
  });
  const events = data?.events ?? [];
  const notes = (data?.notes ?? []) as Note[];

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/calendar")}
          className="mb-6 text-blue-400 hover:text-blue-300 text-sm"
          data-testid="back-to-calendar"
        >
          ← Back to Calendar
        </button>

        <h1 className="text-2xl font-bold mb-6" data-testid="date-title">{formatDate(date)}</h1>

        {loading && <p className="text-zinc-400" data-testid="loading">Loading...</p>}

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">Events</h2>
            {events.length === 0 ? (
              <p className="text-zinc-400 text-sm">No events</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{event.summary}</h3>
                        <p className="text-sm text-zinc-400 mt-1">
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </p>
                      </div>
                      {event.event_type && (
                        <span className="text-xs bg-zinc-700 rounded px-2 py-1">
                          {event.event_type}
                        </span>
                      )}
                    </div>
                    {event.location && (
                      <p className="text-sm text-zinc-400 mt-2">📍 {event.location}</p>
                    )}
                    {event.attendees && (
                      <p className="text-sm text-zinc-400 mt-1">👥 {event.attendees}</p>
                    )}
                    {event.description && (
                      <p className="text-sm text-zinc-300 mt-3 border-t border-zinc-800 pt-3">
                        {event.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Notes</h2>
            {notes.length === 0 ? (
              <p className="text-zinc-400 text-sm">No notes</p>
            ) : (
              <div className="grid gap-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => router.push(`/notes/${note.id}`)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 cursor-pointer hover:bg-zinc-800"
                  >
                    <h3 className="font-medium">{note.title}</h3>
                    <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
                      <span>{note.folder}</span>
                      <span>•</span>
                      <span>{note.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
