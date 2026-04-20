export const mockStats = {
  total_notes: 1641,
  total_tags: 89,
  total_calendar_events: 2324,
  avg_note_length: 1247,
  date_range: ["2017-01-01", "2025-03-15"],
};

export const mockSearchResults = {
  results: [
    {
      id: "note-001",
      title: "1:1 with Alice - March 2024",
      snippet: "Discussion about promotion readiness and team lead transition...",
      metadata: {
        title: "1:1 with Alice - March 2024",
        folder: "1:1 Notes",
        created: "2024-03-15T14:30:00",
        modified: "2024-03-15T15:45:00",
        source: "Apple Notes",
        tags: ["1:1", "management", "1-on-1", "team-lead", "promotion"],
        participants: ["Alice"],
      },
      score: 0.89,
      type: "note",
    },
    {
      id: "note-002",
      title: "Zendesk Chat Architecture Review",
      snippet: "The current implementation uses Redux for state management...",
      metadata: {
        title: "Zendesk Chat Architecture Review",
        folder: "Work",
        created: "2023-08-20T09:00:00",
        modified: "2023-08-20T11:30:00",
        source: "Evernote",
        tags: ["work", "zendesk", "react", "redux", "architecture"],
        participants: [],
      },
      score: 0.85,
      type: "note",
    },
    {
      id: "note-003",
      title: "Interview: Frontend Engineer Candidate",
      snippet: "Technical discussion covered React patterns, accessibility...",
      metadata: {
        title: "Interview: Frontend Engineer Candidate",
        folder: "Interview Notes",
        created: "2023-06-12T10:00:00",
        modified: "2023-06-12T11:00:00",
        source: "Apple Notes",
        tags: ["interview", "technical-interview", "hiring", "frontend"],
        participants: ["Sarah Chen"],
      },
      score: 0.78,
      type: "note",
    },
    {
      id: "event-001",
      title: "1:1 Alice",
      snippet: "Weekly 1:1 meeting",
      metadata: {
        summary: "1:1 Alice",
        date: "2024-03-15",
        location: "Conference Room A",
        attendees: ["Alice Smith"],
      },
      score: 0.82,
      type: "calendar",
    },
    {
      id: "event-002",
      title: "Engineering Standup",
      snippet: "Daily standup",
      metadata: {
        summary: "Engineering Standup",
        date: "2023-08-21",
        location: "",
        attendees: [],
      },
      score: 0.65,
      type: "calendar",
    },
  ],
};

export const mockNoteDetail = {
  id: "note-001",
  metadata: {
    title: "1:1 with Alice - March 2024",
    folder: "1:1 Notes",
    created: "2024-03-15T14:30:00",
    modified: "2024-03-15T15:45:00",
    source: "Apple Notes",
    tags: ["1:1", "management", "1-on-1", "team-lead", "promotion"],
    participants: ["Alice"],
    source_id: "x-coredata://test-note-1",
  },
  content: `# 1:1 with Alice - March 2024

## Agenda
- Performance review preparation
- Career progression discussion
- Team dynamics feedback

## Notes

Alice is doing well overall. She's taken ownership of the migration project and the team is responding well to her leadership.

### Promotion Readiness
We discussed the requirements for Senior Engineer:
- Technical depth in the area
- Mentorship experience
- Cross-team collaboration

Alice has made significant progress on all three fronts. She's been mentoring two junior engineers and her RFC on the API redesign was well-received.

### Next Steps
- [ ] Schedule calibration meeting with other senior ICs
- [ ] Draft promotion packet
- [ ] Collect peer feedback

[View original](Alice_1-1_001.png)
`,
  calendar_events: [
    {
      id: "evt-001",
      summary: "1:1 Alice",
      start: "2024-03-15T10:00:00",
      end: "2024-03-15T11:00:00",
      location: "Conference Room A",
      attendees: "Alice Smith, C. Alan Zoppa",
      description: "Weekly sync",
      event_type: "default",
    },
  ],
  similar_notes: [
    { id: "note-004", title: "1:1 with Alice - February 2024", score: 0.92 },
    { id: "note-005", title: "1:1 with Alice - January 2024", score: 0.88 },
    { id: "note-006", title: "Team Calibration Notes", score: 0.74 },
  ],
};

export const mockTags = {
  tags: [
    { name: "1:1", count: 45 },
    { name: "work", count: 287 },
    { name: "evernote", count: 1186 },
    { name: "handwritten", count: 156 },
    { name: "management", count: 89 },
    { name: "interview", count: 72 },
    { name: "zendesk", count: 297 },
    { name: "engineering", count: 234 },
    { name: "react", count: 45 },
    { name: "personal", count: 67 },
    { name: "creative", count: 23 },
    { name: "therapy", count: 12 },
  ],
  co_occurrence: [
    { tag1: "work", tag2: "zendesk", count: 234 },
    { tag1: "evernote", tag2: "work", count: 198 },
    { tag1: "engineering", tag2: "react", count: 42 },
    { tag1: "1:1", tag2: "management", count: 38 },
    { tag1: "interview", tag2: "technical-interview", count: 35 },
  ],
};

export const mockTimeline = {
  periods: [
    { period: "2024-01", count: 45, sample_ids: ["note-001", "note-002"] },
    { period: "2024-02", count: 38, sample_ids: ["note-003"] },
    { period: "2024-03", count: 52, sample_ids: ["note-004"] },
    { period: "2024-04", count: 41, sample_ids: ["note-005"] },
    { period: "2024-05", count: 35, sample_ids: ["note-006"] },
    { period: "2024-06", count: 48, sample_ids: ["note-007"] },
    { period: "2024-07", count: 42, sample_ids: ["note-008"] },
    { period: "2024-08", count: 39, sample_ids: ["note-009"] },
    { period: "2024-09", count: 44, sample_ids: ["note-010"] },
    { period: "2024-10", count: 51, sample_ids: ["note-011"] },
    { period: "2024-11", count: 36, sample_ids: ["note-012"] },
    { period: "2024-12", count: 29, sample_ids: ["note-013"] },
  ],
};

export const mockGraph = {
  nodes: [
    { id: "note-001", title: "1:1 with Alice", folder: "1:1 Notes", tags: ["1:1", "management"], source: "Apple Notes" },
    { id: "note-002", title: "Zendesk Architecture", folder: "Work", tags: ["work", "zendesk"], source: "Evernote" },
    { id: "note-003", title: "Interview Notes", folder: "Interview Notes", tags: ["interview"], source: "Apple Notes" },
    { id: "note-004", title: "Personal Reflection", folder: "Personal", tags: ["personal"], source: "Apple Notes" },
    { id: "note-005", title: "ZEIG Meeting", folder: "ZEIG things", tags: ["zeig"], source: "Apple Notes" },
    { id: "note-006", title: "General Notes", folder: "Notes", tags: ["notes"], source: "Evernote" },
  ],
  edges: [
    { source: "note-001", target: "note-002", weight: 0.85 },
    { source: "note-001", target: "note-003", weight: 0.72 },
    { source: "note-002", target: "note-006", weight: 0.68 },
    { source: "note-004", target: "note-001", weight: 0.55 },
    { source: "note-005", target: "note-002", weight: 0.48 },
  ],
};

export const mockCalendarEvents = {
  events: [
    {
      id: "evt-001",
      summary: "1:1 with Alice",
      date: "2024-03-15",
      start: "2024-03-15T10:00:00",
      end: "2024-03-15T11:00:00",
      location: "Conference Room A",
      attendees: "Alice Smith, C. Alan Zoppa",
      attendee_names: ["Alice Smith", "C. Alan Zoppa"],
      description: "Weekly sync",
      event_type: "default",
    },
    {
      id: "evt-002",
      summary: "Engineering Standup",
      date: "2024-03-15",
      start: "2024-03-15T09:00:00",
      end: "2024-03-15T09:15:00",
      location: "",
      attendees: "",
      attendee_names: [],
      description: "",
      event_type: "default",
    },
    {
      id: "evt-003",
      summary: "Architecture Review",
      date: "2024-03-15",
      start: "2024-03-15T14:00:00",
      end: "2024-03-15T15:00:00",
      location: "Zoom",
      attendees: "Bob Jones, Carol White",
      attendee_names: ["Bob Jones", "Carol White"],
      description: "Review Q1 architecture decisions",
      event_type: "default",
    },
  ],
};

export const mockCalendarDate = {
  date: "2024-03-15",
  events: [
    {
      id: "evt-001",
      summary: "1:1 with Alice",
      start: "2024-03-15T10:00:00",
      end: "2024-03-15T11:00:00",
      location: "Conference Room A",
      attendees: "Alice Smith, C. Alan Zoppa",
      date: "2024-03-15",
      description: "Weekly sync",
      event_type: "default",
    },
    {
      id: "evt-002",
      summary: "Engineering Standup",
      start: "2024-03-15T09:00:00",
      end: "2024-03-15T09:15:00",
      location: "",
      attendees: "",
      date: "2024-03-15",
      description: "",
      event_type: "default",
    },
  ],
  notes: [
    {
      id: "note-001",
      title: "1:1 with Alice - March 2024",
      folder: "1:1 Notes",
      created: "2024-03-15T14:30:00",
      modified: "2024-03-15T15:45:00",
      source: "Apple Notes",
      source_id: "x-coredata://test-note-1",
      tags: ["1:1", "management", "1-on-1"],
      participants: ["Alice"],
    },
  ],
};

export const mockSchema = {
  total_files: 1641,
  fields: [
    { name: "title", type: "str", cardinality: "high", samples: [], classification: "embedded" },
    { name: "folder", type: "str", cardinality: "low", samples: ["Notes", "Work", "1:1 Notes"], classification: "categorical" },
    { name: "tags", type: "list", cardinality: "high", samples: [], classification: "categorical" },
    { name: "created", type: "str", cardinality: "high", samples: [], classification: "temporal" },
    { name: "source", type: "str", cardinality: "low", samples: ["Apple Notes", "Evernote"], classification: "categorical" },
  ],
};
