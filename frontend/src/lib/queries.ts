import {
  search,
  getNote,
  getTags,
  getTimeline,
  getGraph,
  getStats,
  getSchema,
  getCalendarEvents,
  getCalendarDate,
  getPeople,
  updateNote,
  triggerIngest,
  type SearchResult,
  type TagInfo,
  type CoOccurrence,
  type TimelinePeriod,
  type GraphData,
  type Stats,
  type CalendarEvent,
  type PersonInfo,
} from './api';

// ============================================================================
// Query Keys
// ============================================================================

export const noteKeys = {
  all: ['notes'] as const,
  detail: (id: string) => [...noteKeys.all, id] as const,
};

export const tagKeys = {
  all: ['tags'] as const,      // { tags: TagInfo[], co_occurrence: CoOccurrence[] }
  list: ['tags', 'list'] as const, // TagInfo[]
};

export const timelineKeys = {
  all: (groupBy: string, tag?: string) => ['timeline', groupBy, tag ?? ''] as const,
};

export const graphKeys = {
  all: (tag?: string, threshold?: number) => ['graph', tag ?? '', threshold ?? ''] as const,
};

export const statsKeys = {
  all: ['stats'] as const,
};

export const schemaKeys = {
  all: ['schema'] as const,
};

export const calendarEventKeys = {
  range: (start: string, end: string) => ['calendar-events', start, end] as const,
  date: (date: string) => ['calendar-date', date] as const,
};

export const peopleKeys = {
  all: ['people'] as const,
};

export const searchKeys = {
  results: (query: string, filters: Record<string, string>, includeCalendar: boolean) =>
    ['search', query, JSON.stringify(filters), includeCalendar] as const,
};

// ============================================================================
// Query Functions (thin wrappers so pages don't import api directly)
// ============================================================================

export const notesApi = {
  detail: (id: string) => getNote(id),
};

export const tagsApi = {
  all: async (): Promise<{ tags: TagInfo[]; co_occurrence: CoOccurrence[] }> => getTags(),
};

export const timelineApi = {
  get: async (groupBy: string, tag?: string): Promise<TimelinePeriod[]> => {
    const res = await getTimeline(groupBy, tag);
    return res.periods;
  },
};

export const graphApi = {
  get: async (tag?: string, threshold?: number): Promise<GraphData> => getGraph(tag, undefined, threshold),
  tags: async (): Promise<TagInfo[]> => {
    const res = await getTags();
    return res.tags.slice(0, 30);
  },
};

export const statsApi = {
  get: (): Promise<Stats> => getStats(),
};

export const schemaApi = {
  get: (): Promise<any> => getSchema(),
};

export const calendarApi = {
  events: async (startStr: string, endStr: string): Promise<CalendarEvent[]> => {
    const res = await getCalendarEvents(startStr, endStr);
    return res.events;
  },
  date: async (date: string): Promise<{ events: CalendarEvent[]; notes: any[] }> => {
    const res = await getCalendarDate(date);
    return { events: res.events, notes: res.notes || [] };
  },
};

export const peopleApi = {
  all: async (): Promise<PersonInfo[]> => {
    const res = await getPeople();
    return res.people;
  },
};

// ============================================================================
// Mutation wrappers
// ============================================================================

export const notesMutations = {
  update: async ({ id, data }: { id: string; data: { title?: string; content?: string; tags?: string[]; participants?: string[] } }) => {
    return updateNote(id, data);
  },
};

export const ingestApi = {
  trigger: async (full?: boolean): Promise<any> => triggerIngest(full),
};

// ============================================================================
// Search API (not cached by default)
// ============================================================================

export const searchApi = {
  all: async (options: {
    query?: string;
    filters?: Record<string, string>;
    n?: number;
    includeCalendar?: boolean;
  }): Promise<SearchResult[]> => {
    const { query = '', filters, n = 50, includeCalendar = true } = options;
    const res = await search(query || '*', Object.keys(filters || {}).length ? filters : undefined, n, includeCalendar);
    return res.results;
  },
  byTag: async (tag: string): Promise<SearchResult[]> => {
    const res = await search('', { tags: tag });
    return res.results.filter((r) => r.type === 'note');
  },
};
