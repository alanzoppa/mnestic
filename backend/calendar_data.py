from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime

from cachetools import TTLCache

from config import CALENDAR_EXPORT_PATH, PEOPLE_REGISTRY_PATH
from models import CalendarEvent


class CalendarProcessor:
    def __init__(
        self, calendar_path: str = CALENDAR_EXPORT_PATH, registry_path: str = PEOPLE_REGISTRY_PATH
    ) -> None:
        self._calendar_path = calendar_path
        self._registry_path = registry_path
        self._events: list[dict] = []
        self._alias_map: dict[str, str] = {}
        # Single TTLCache key for processed events + indexes
        self._cache = TTLCache(maxsize=1, ttl=300)

    def load(self) -> None:
        try:
            with open(self._calendar_path, "r", encoding="utf-8") as f:
                calendar_data = json.load(f)
            self._events = calendar_data.get("events", [])
        except (FileNotFoundError, json.JSONDecodeError, PermissionError):
            self._events = []

        # Invalidate caches when raw data changes
        self._cache.clear()

        try:
            registry: dict = {}
            with open(self._registry_path, "r", encoding="utf-8") as f:
                registry = json.load(f)

            alias_map: dict[str, str] = {}
            for canonical, info in registry.items():
                if canonical == "_metadata":
                    continue
                if not isinstance(info, dict):
                    continue
                aliases = info.get("aliases", [])
                for alias in aliases:
                    alias_map[alias.lower()] = canonical
                alias_map[canonical.lower()] = canonical

            self._alias_map = alias_map
        except (FileNotFoundError, json.JSONDecodeError, PermissionError):
            self._alias_map = {}

    def normalize_name(self, name: str) -> str:
        if not name:
            return name
        normalized = name.strip()
        lower_key = normalized.lower()
        if lower_key in self._alias_map:
            return self._alias_map[lower_key]
        return normalized

    def _build_events(self) -> tuple[list[CalendarEvent], dict[str, list[CalendarEvent]], dict[str, list[CalendarEvent]]]:
        """Rebuild processed events and indexes from raw data."""
        processed: list[CalendarEvent] = []
        by_date: dict[str, list[CalendarEvent]] = defaultdict(list)
        by_participant: dict[str, list[CalendarEvent]] = defaultdict(list)

        for event in self._events:
            start_val = event.get("start", {})
            end_val = event.get("end", {})
            start_dt = start_val.get("dateTime", start_val.get("date", ""))
            end_dt = end_val.get("dateTime", end_val.get("date", ""))
            if len(start_dt) == 10:
                start_dt += "T00:00:00"
            if len(end_dt) == 10:
                end_dt += "T00:00:00"

            attendees_raw = event.get("attendees", [])
            attendee_names: list[str] = []
            for a in attendees_raw:
                if isinstance(a, dict):
                    dn = a.get("displayName", "")
                    if dn:
                        attendee_names.append(dn)
            normalized_names = [self.normalize_name(n) for n in attendee_names]
            attendees_str = ",".join(normalized_names)

            date_str = start_dt[:10] if start_dt else ""

            pe = CalendarEvent(
                id=event.get("id", ""),
                summary=event.get("summary", ""),
                start=start_dt,
                end=end_dt,
                location=event.get("location") or "",
                description=event.get("description") or "",
                attendees=attendees_str,
                attendee_names=normalized_names,
                event_type=event.get("eventType", "default"),
                date=date_str,
            )
            processed.append(pe)
            if date_str:
                by_date[date_str].append(pe)
            for name in normalized_names:
                by_participant[name].append(pe)

        return processed, dict(by_date), dict(by_participant)

    def _get_cached(self) -> tuple[list[CalendarEvent], dict[str, list[CalendarEvent]], dict[str, list[CalendarEvent]]]:
        """Return cached events + indexes, rebuilding if needed."""
        try:
            return self._cache[0]
        except KeyError:
            data = self._build_events()
            self._cache[0] = data
            return data

    def process_events(self) -> list[CalendarEvent]:
        processed, _, _ = self._get_cached()
        return processed

    def get_events_for_date(self, date: str) -> list[CalendarEvent]:
        _, by_date, _ = self._get_cached()
        return by_date.get(date, [])

    def get_events_for_participant(self, name: str) -> list[CalendarEvent]:
        _, _, by_participant = self._get_cached()
        normalized = self.normalize_name(name)
        return by_participant.get(normalized, [])

    def get_embedding_text(self, event: CalendarEvent) -> str:
        return f"{event.summary}. {event.description}. Attendees: {event.attendees}. Location: {event.location}"
