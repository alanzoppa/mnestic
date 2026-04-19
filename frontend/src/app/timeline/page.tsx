"use client";

import { useState, useEffect, useCallback } from "react";
import { getTimeline } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TimelinePeriod {
  period: string;
  count: number;
  sample_ids: string[];
}

const TAGS = [
  "interviewing",
  "behavioral-interview",
  "technical-interview",
  "1-on-1",
  "team-lead",
  "promotion",
  "feedback",
  "onboarding",
  "engineering",
  "product",
  "zendesk",
  "writing",
  "mental-health",
];

export default function TimelinePage() {
  const [data, setData] = useState<TimelinePeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("");

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    const result = await getTimeline("month", tagFilter || undefined);
    setData(result.periods);
    setLoading(false);
  }, [tagFilter]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Timeline</h1>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          >
            <option value="">All tags</option>
            {TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-zinc-400">Loading timeline...</p>}

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" />
              <XAxis
                dataKey="period"
                stroke="#71717a"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: "0.5rem",
                  color: "#fafafa",
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.length > 0 && (
          <p className="text-zinc-400 text-sm mt-4 text-center">
            {data.reduce((sum, d) => sum + d.count, 0)} notes across{" "}
            {data.length} periods
          </p>
        )}
      </div>
    </div>
  );
}