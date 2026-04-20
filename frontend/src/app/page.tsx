'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats, search, getTags, triggerIngest, type Stats, type SearchResult, type TagInfo } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard, StatsGrid } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DonutChart } from '@/components/charts/PieCharts';
import { SkeletonStatCards, SkeletonChart } from '@/components/ui/Skeleton';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';

// Icons
const DocumentIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TagIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [allNoteTitles, setAllNoteTitles] = useState<{ id: string; title: string; note_id?: string }[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  useEffect(() => {
    // Load stats
    getStats().then(setStats).catch(() => {});
    
    // Load tags for distribution and autocomplete
    getTags().then(res => {
      setTags(res.tags.slice(0, 10));
    }).catch(() => {});

    // Load note titles for autocomplete
    search('').then(res => {
      setAllNoteTitles(res.results.map(r => ({
        id: r.id,
        title: r.title,
        note_id: r.note_id || r.metadata?.note_id,
      })));
    }).catch(() => {});
  }, []);

  const handleIngest = async (full: boolean) => {
    setIngesting(true);
    setIngestResult(null);
    try {
      const result = await triggerIngest(full);
      const n = result.notes_result || {};
      const c = result.calendar_result || {};
      setIngestResult(
        `Notes: ${n.notes_ingested || 0} ingested, ${n.notes_skipped || 0} skipped, ${n.chunks_created || 0} chunks. Calendar: ${c.events_ingested || 0} events.`
      );
      getStats().then(setStats);
    } catch (e: any) {
      setIngestResult(`Error: ${e.message}`);
    }
    setIngesting(false);
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await search(query);
      setResults(data.results.slice(0, 5));
    } catch {}
    setSearching(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doSearch();
  };

  // Prepare tag distribution data for chart
  const tagDistributionData = tags.map(tag => ({
    name: tag.name,
    value: tag.count,
  }));

  return (
    <div className="max-w-7xl space-y-8">
      {/* Header with Search */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 rounded-2xl blur-xl" />
        <Card className="relative">
          <CardContent className="p-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Notes Browser
            </h1>
            <p className="text-zinc-500 mb-6">Search and explore your archived notes with semantic understanding</p>
            
            <SearchAutocomplete
              query={query}
              onQueryChange={setQuery}
              tags={tags}
              noteTitles={allNoteTitles}
              onSubmit={doSearch}
              placeholder="Search your notes..."
            />

            {/* Quick Search Results */}
            {results.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Quick Results</h3>
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={r.type === 'note' ? `/notes/${r.note_id || r.metadata?.note_id || r.id}` : `/calendar`}
                    className="block p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg hover:border-zinc-700/60 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-zinc-100">{r.title}</h4>
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{r.snippet}</p>
                      </div>
                      <span className={`ml-4 px-2 py-1 rounded text-xs ${
                        r.type === 'calendar' 
                          ? 'bg-purple-500/10 text-purple-400' 
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {r.type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      {stats ? (
        <StatsGrid>
          <StatCard
            value={stats.total_notes.toLocaleString()}
            label="Total Notes"
            icon={<DocumentIcon />}
          />
          <StatCard
            value={stats.total_tags.toLocaleString()}
            label="Unique Tags"
            icon={<TagIcon />}
          />
          <StatCard
            value={stats.total_calendar_events.toLocaleString()}
            label="Calendar Events"
            icon={<CalendarIcon />}
          />
          <StatCard
            value={stats.date_range[0] ? `${stats.date_range[0]?.slice(0, 4)}–${stats.date_range[1]?.slice(0, 4)}` : 'N/A'}
            label="Date Range"
            icon={<ClockIcon />}
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
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Advanced Search
                </Button>
              </Link>
              <Link href="/browse">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Browse All
                </Button>
              </Link>
              <Link href="/tags">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Tags
                </Button>
              </Link>
              <Link href="/graph">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
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
                loading={ingesting}
                disabled={ingesting}
              >
                Incremental Ingest
              </Button>
              <Button
                variant="primary"
                onClick={() => handleIngest(true)}
                loading={ingesting}
                disabled={ingesting}
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
