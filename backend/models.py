from datetime import date as date_type

from pydantic import BaseModel, ConfigDict, field_validator


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
