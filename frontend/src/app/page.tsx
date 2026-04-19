"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats, search, triggerIngest, type Stats, type SearchResult } from "@/lib/api";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  const handleIngest = async (full: boolean) => {
    setIngesting(true);
    setIngestResult(null);
    try {
      const result = await triggerIngest(full);
      const n = result.notes_result || {};
      const c = result.calendar_result || {};
      setIngestResult(`Notes: ${n.notes_ingested || 0} ingested, ${n.notes_skipped || 0} skipped, ${n.chunks_created || 0} chunks. Calendar: ${c.events_ingested || 0} events.`);
      getStats().then(setStats);
    } catch (e: any) {
      setIngestResult(`Error: ${e.message}`);
    }
    setIngesting(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await search(query);
      setResults(data.results.slice(0, 5));
    } catch {}
    setSearching(false);
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Notes Browser</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium disabled:opacity-50"
        >
          {searching ? "..." : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Results</h2>
          <div className="space-y-2">
            {results.map((r) => (
              <Link
                key={r.id}
                href={r.type === "note" ? `/notes/${r.id}` : `/calendar`}
                className="block p-3 bg-zinc-900 rounded border border-zinc-800 hover:border-zinc-600"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-zinc-500">{r.type}</span>
                </div>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{r.snippet}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Notes" value={stats.total_notes} />
          <StatCard label="Tags" value={stats.total_tags} />
          <StatCard label="Calendar Events" value={stats.total_calendar_events} />
          <StatCard
            label="Date Range"
            value={stats.date_range[0] ? `${stats.date_range[0]?.slice(0, 4)}–${stats.date_range[1]?.slice(0, 4)}` : "N/A"}
          />
        </div>
      )}

      <div className="mt-8 p-4 bg-zinc-900 rounded border border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Index Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleIngest(false)}
            disabled={ingesting}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-zinc-100 disabled:opacity-50"
          >
            {ingesting ? "Ingesting..." : "Incremental Ingest"}
          </button>
          <button
            onClick={() => handleIngest(true)}
            disabled={ingesting}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm text-zinc-100 disabled:opacity-50"
          >
            {ingesting ? "Ingesting..." : "Full Re-ingest"}
          </button>
        </div>
        {ingestResult && (
          <p className="mt-3 text-sm text-zinc-400">{ingestResult}</p>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/search" className="text-blue-400 hover:underline text-sm">Advanced Search →</Link>
        <Link href="/browse" className="text-blue-400 hover:underline text-sm">Browse All →</Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 bg-zinc-900 rounded border border-zinc-800">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
