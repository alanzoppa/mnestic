from datetime import date as date_type

from pydantic import BaseModel, field_validator


class CalendarEvent(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    location: str = ""
    description: str = ""
    attendees: str = ""          # comma-joined for Chroma constraints
    attendee_names: list[str] = []  # normalized list for Python logic
    event_type: str = "default"
    date: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        if v:
            date_type.fromisoformat(v)  # raises ValueError on bad format
        return v
