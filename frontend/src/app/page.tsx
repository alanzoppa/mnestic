'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Tag, Calendar, Clock, Search, FolderOpen, Zap } from 'lucide-react';
import { type Stats } from '@/lib/api';
import {
  statsKeys, statsApi,
  tagKeys, tagsApi,
  ingestApi,
} from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard, StatsGrid } from '@/components/ui/StatCard';
import { DonutChart } from '@/components/charts/PieCharts';
import { SkeletonStatCards } from '@/components/ui/Skeleton';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';

import { SectionHeader } from '@/components/ui/SectionHeader';

export default function Dashboard() {
  const queryClient = useQueryClient();

  // Local state
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  // Queries
  const { data: stats } = useQuery({ queryKey: statsKeys.all, queryFn: statsApi.get });
  const { data: tagsData } = useQuery({ queryKey: tagKeys.all, queryFn: tagsApi.all });
  const tags = (tagsData?.tags ?? []).slice(0, 10);

  // Mutations
  const ingestMutation = useMutation({
    mutationFn: (full: boolean) => ingestApi.trigger(full),
    onMutate: () => { setIngestResult(null); },
    onSuccess: (result) => {
      const n = result.notes_result || {};
      const c = result.calendar_result || {};
      setIngestResult(
        `Notes: ${n.notes_ingested || 0} ingested, ${n.notes_skipped || 0} skipped, ${n.chunks_created || 0} chunks. Calendar: ${c.events_ingested || 0} events.`
      );
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
    onError: (e: Error) => {
      setIngestResult(`Error: ${e.message}`);
    },
  });

  const handleIngest = (full: boolean) => {
    ingestMutation.mutate(full);
  };

  // Prepare tag distribution data for chart
  const tagDistributionData = tags.map(tag => ({
    name: tag.name,
    value: tag.count,
  }));

  return (
    <div className="max-w-7xl space-y-8">
      {/* Header */}
      <SectionHeader title="Mnestic" description="Your private knowledge archive" />

      {/* Stats Grid */}
      {stats ? (
        <StatsGrid>
          <StatCard
            value={stats.total_notes.toLocaleString()}
            label="Total Notes"
            icon={<FileText className="w-6 h-6" />}
          />
          <StatCard
            value={stats.total_tags.toLocaleString()}
            label="Unique Tags"
            icon={<Tag className="w-6 h-6" />}
          />
          <StatCard
            value={stats.total_calendar_events.toLocaleString()}
            label="Calendar Events"
            icon={<Calendar className="w-6 h-6" />}
          />
          <StatCard
            value={stats.date_range[0] ? `${stats.date_range[0]?.slice(0, 4)}–${stats.date_range[1]?.slice(0, 4)}` : 'N/A'}
            label="Date Range"
            icon={<Clock className="w-6 h-6" />}
          />
        </StatsGrid>
      ) : (
        <SkeletonStatCards />
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar Heatmap */}
        <Card hover>
          <CardHeader>
            <CardTitle>Activity Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarHeatmap />
          </CardContent>
        </Card>

        {/* Tag Distribution */}
        <Card hover>
          <CardHeader>
            <CardTitle>Top Tags Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {tagDistributionData.length > 0 ? (
              <DonutChart
                data={tagDistributionData}
                height={250}
                showLegend={true}
              />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-zinc-500">
                No tag data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Index Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Explore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">Navigate through your notes using different views</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/search">
                <Button variant="secondary" className="w-full justify-start">
                  <Search className="w-4 h-4 mr-2" />
                  Advanced Search
                </Button>
              </Link>
              <Link href="/browse">
                <Button variant="secondary" className="w-full justify-start">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Browse All
                </Button>
              </Link>
              <Link href="/tags">
                <Button variant="secondary" className="w-full justify-start">
                  <Tag className="w-4 h-4 mr-2" />
                  Tags
                </Button>
              </Link>
              <Link href="/graph">
                <Button variant="secondary" className="w-full justify-start">
                  <Zap className="w-4 h-4 mr-2" />
                  Graph
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Index Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500 mb-4">Update the search index with new or modified notes</p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => handleIngest(false)}
                loading={ingestMutation.isPending}
                disabled={ingestMutation.isPending}
              >
                Incremental Ingest
              </Button>
              <Button
                variant="primary"
                onClick={() => handleIngest(true)}
                loading={ingestMutation.isPending}
                disabled={ingestMutation.isPending}
              >
                Full Re-ingest
              </Button>
            </div>

            {ingestResult && (
              <div className="mt-4 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-400">{ingestResult}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
