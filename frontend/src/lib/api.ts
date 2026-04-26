const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  metadata: Record<string, any>;
  score: number;
  type: "note" | "calendar";
  note_id?: string;
}

export function getNoteUrl(result: { id: string; note_id?: string; metadata?: Record<string, any> }): string {
  return `/notes/${encodeURIComponent(result.note_id || result.metadata?.note_id || result.id)}`;
}

export interface NoteDetail {
  id: string;
  metadata: Record<string, any>;
  content: string;
  calendar_events: CalendarEvent[];
  similar_notes: SimilarNote[];
}

export interface SimilarNote {
  id: string;
  note_id: string;
  title: string;
  score: number;
  created: string;
}

export interface CalendarEvent {
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

export interface TagInfo {
  name: string;
  count: number;
}

export interface CoOccurrence {
  tag1: string;
  tag2: string;
  count: number;
}

export interface TimelinePeriod {
  period: string;
  count: number;
  sample_ids: string[];
}

export interface Stats {
  total_notes: number;
  total_tags: number;
  date_range: [string | null, string | null];
  avg_note_length: number;
  total_calendar_events: number;
}

export async function search(query: string, filters?: Record<string, string>, n?: number, includeCalendar?: boolean, rerank?: boolean): Promise<{ results: SearchResult[] }> {
  return fetchAPI("/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, filters: filters || {}, n: n || 20, include_calendar: includeCalendar !== false, rerank: rerank !== false }),
  });
}

export async function getNote(noteId: string): Promise<NoteDetail> {
  return fetchAPI(`/notes/${encodeURIComponent(noteId)}`);
}

export async function getTags(): Promise<{ tags: TagInfo[]; co_occurrence: CoOccurrence[] }> {
  return fetchAPI("/tags");
}

export async function getTimeline(groupBy?: string, tag?: string): Promise<{ periods: TimelinePeriod[] }> {
  const params = new URLSearchParams();
  if (groupBy) params.set("group_by", groupBy);
  if (tag) params.set("tag", tag);
  return fetchAPI(`/timeline?${params}`);
}

export async function getSimilar(noteId: string, n?: number): Promise<{ notes: SimilarNote[] }> {
  return fetchAPI(`/similar/${encodeURIComponent(noteId)}?n=${n || 10}`);
}

export async function triggerIngest(full?: boolean): Promise<any> {
  return fetchAPI("/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full: full || false }),
  });
}

export async function getSchema(): Promise<any> {
  return fetchAPI("/schema");
}

export async function getStats(): Promise<Stats> {
  return fetchAPI("/stats");
}

export async function getCalendarEvents(startDate?: string, endDate?: string, attendee?: string): Promise<{ events: CalendarEvent[] }> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (attendee) params.set("attendee", attendee);
  const qs = params.toString();
  return fetchAPI(`/calendar${qs ? `?${qs}` : ""}`);
}

export async function getCalendarDate(date: string): Promise<{ date: string; events: CalendarEvent[]; notes: any[] }> {
  return fetchAPI(`/calendar/date/${date}`);
}

export interface GraphNode {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  source: string;
  created?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function getGraph(tag?: string, folder?: string, threshold?: number): Promise<GraphData> {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (folder) params.set("folder", folder);
  if (threshold !== undefined) params.set("threshold", threshold.toString());
  const qs = params.toString();
  return fetchAPI(`/graph${qs ? `?${qs}` : ""}`);
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  tags?: string[];
  participants?: string[];
}

export interface UpdateNoteResponse {
  id: string;
  metadata: Record<string, any>;
  content: string;
}

export async function updateNote(noteId: string, data: UpdateNoteRequest): Promise<UpdateNoteResponse> {
  return fetchAPI(`/notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export interface PersonInfo {
  name: string;
  aliases: string[];
  context: string;
}

export async function getPeople(): Promise<{ people: PersonInfo[] }> {
  return fetchAPI("/people");
}
