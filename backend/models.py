from datetime import date as date_type
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CalendarEvent(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    location: str = ""
    description: str = ""
    attendees: str = ""  # comma-joined for Chroma constraints
    attendee_names: list[str] = []  # normalized list for Python logic
    event_type: str = "default"
    date: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        if v:
            date_type.fromisoformat(v)  # raises ValueError on bad format
        return v


class NoteMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    note_id: str = ""
    title: str = ""
    folder: str = ""
    tags: list[str] = []
    participants: list[str] = []
    created: str = ""
    modified: str = ""
    source: str = ""
    source_id: str = ""
    date: str = ""
    filename: str = ""
    chunk_index: int = 0

    @field_validator("tags", "participants", mode="before")
    @classmethod
    def split_csv(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v or []


# ------------------------------------------------------------------
# Request models
# ------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str
    filters: dict = Field(default_factory=dict)
    n: int = 20
    include_calendar: bool = True
    rerank: bool = True


class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    participants: Optional[list[str]] = None


class IngestRequest(BaseModel):
    full: bool = False


# ------------------------------------------------------------------
# Response models for FastAPI endpoints
# ------------------------------------------------------------------

class SearchResultItem(BaseModel):
    id: str
    title: str = ""
    snippet: str = ""
    metadata: NoteMetadata = Field(default_factory=NoteMetadata)
    score: float = 0.0
    type: str = "note"
    note_id: str = ""


class SearchResponse(BaseModel):
    results: list[SearchResultItem] = []


class SimilarNoteRef(BaseModel):
    id: str
    note_id: str = ""
    title: str = ""
    score: float = 0.0
    created: str = ""
    embedding: list[float] = []


class SimilarNotesResponse(BaseModel):
    notes: list[SimilarNoteRef] = []


class NoteDetailResponse(BaseModel):
    id: str
    metadata: NoteMetadata = Field(default_factory=NoteMetadata)
    content: str = ""
    calendar_events: list[CalendarEvent] = []
    similar_notes: list[SimilarNoteRef] = []
    embedding: list[float] = []


class UpdateNoteResponse(BaseModel):
    id: str
    metadata: NoteMetadata = Field(default_factory=NoteMetadata)
    content: str = ""


class PersonInfo(BaseModel):
    name: str
    aliases: list[str] = []
    context: str = ""


class PeopleResponse(BaseModel):
    people: list[PersonInfo] = []


class TagInfo(BaseModel):
    name: str
    count: int = 0


class CoOccurrence(BaseModel):
    tag1: str
    tag2: str
    count: int = 0


class TagsResponse(BaseModel):
    tags: list[TagInfo] = []
    co_occurrence: list[CoOccurrence] = []


class TimelinePeriod(BaseModel):
    period: str
    count: int = 0
    sample_ids: list[str] = []


class TimelineResponse(BaseModel):
    periods: list[TimelinePeriod] = []


class IngestResponse(BaseModel):
    notes_result: Any = None
    calendar_result: Any = None


class GraphNode(BaseModel):
    id: str
    title: str = ""
    folder: str = ""
    tags: list[str] = []
    source: str = ""
    created: str = ""
    search_score: float = 0.0


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float = 0.0


class GraphResponse(BaseModel):
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []


class SchemaField(BaseModel):
    name: str
    type: str = ""
    cardinality: str = ""
    samples: list[Any] = []
    classification: str = ""


class SchemaResponse(BaseModel):
    total_files: int = 0
    fields: list[SchemaField] = []
    sources: list[str] = []
    folders: list[str] = []


class WatcherStatus(BaseModel):
    running: bool = False
    notes_dir: str = ""


class StatsResponse(BaseModel):
    total_notes: int = 0
    total_tags: int = 0
    date_range: list[str | None] = []
    avg_note_length: int = 0
    total_calendar_events: int = 0


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent] = []


class CalendarEventDetailLinkedNote(BaseModel):
    id: str
    title: str = ""
    date: str = ""


class CalendarEventDetailResponse(BaseModel):
    id: str
    summary: str = ""
    start: str = ""
    end: str = ""
    location: str = ""
    attendees: list[str] = []
    description: str = ""
    linked_notes: list[CalendarEventDetailLinkedNote] = []


class CalendarDateNote(BaseModel):
    id: str
    title: str = ""
    metadata: NoteMetadata = Field(default_factory=NoteMetadata)


class CalendarDateResponse(BaseModel):
    date: str
    events: list[CalendarEvent] = []
    notes: list[CalendarDateNote] = []
