#!/usr/bin/env python3
"""
Merge series_from_calendar.json and series_from_notes.json into series_assignments.json.

Output: .state/series_assignments.json -> {note_id: series_name | null}
  - Notes with existing series keep it (notes data is more precise)
  - Notes with null try to derive from calendar via date cross-referencing
  - Calendar-derived series get `_notes` suffix to distinguish from calendar-only entries
"""

from __future__ import annotations

import json
import os
import re
from collections import Counter
from pathlib import Path

import frontmatter

REPO_ROOT = Path(__file__).resolve().parents[1]
CALENDAR_EXPORT_PATH = Path("/Users/alanzoppa/Downloads/calendar-export.json")
SERIES_FROM_CALENDAR = REPO_ROOT / "data" / "series_from_calendar.json"
SERIES_FROM_NOTES = REPO_ROOT / "data" / "series_from_notes.json"
OUTPUT_PATH = REPO_ROOT / ".state" / "series_assignments.json"
NOTES_DIR = REPO_ROOT / "notes"


def normalize_event_id(event_id: str) -> str:
    """Strip timestamp suffixes like _YYYYMMDD or _YYYYMMDDTHHMMSSZ"""
    return re.sub(r"_\d{8}(T\d{6}Z)?$", "", event_id)


def load_calendar_events_by_date(path: Path) -> dict[str, list[str]]:
    """Load calendar events, return {date_str: [event_id, ...]}"""
    with open(path) as f:
        data = json.load(f)
    events = data.get("events", [])
    by_date: dict[str, list[str]] = {}
    for ev in events:
        eid = ev.get("id")
        start = ev.get("start", {})
        dt = start.get("dateTime") or start.get("date")
        if not dt or not eid:
            continue
        try:
            if "T" in dt:
                date_str = dt.split("T")[0]
            else:
                date_str = dt
            if date_str not in by_date:
                by_date[date_str] = []
            by_date[date_str].append(eid)
        except Exception:
            continue
    return by_date


def load_series_from_calendar(path: Path) -> dict[str, str]:
    """Load series_from_calendar.json"""
    with open(path) as f:
        return json.load(f)


def build_source_id_map() -> dict[str, Path]:
    """Scan all notes and build source_id -> path mapping"""
    source_id_map: dict[str, Path] = {}
    for note_path in NOTES_DIR.glob("*.md"):
        if note_path.name.startswith("."):
            continue
        try:
            with open(note_path) as f:
                fm = frontmatter.load(f)
            sid = fm.get("source_id")
            if sid:
                source_id_map[sid] = note_path
        except Exception:
            continue
    return source_id_map


def main():
    os.makedirs(OUTPUT_PATH.parent, exist_ok=True)

    cal_series = load_series_from_calendar(SERIES_FROM_CALENDAR)
    with open(SERIES_FROM_NOTES) as f:
        notes_series: dict[str, str | None] = json.load(f)

    # Build normalized event_id -> series mapping (strip date suffixes for matching)
    normalized_cal_series: dict[str, str] = {}
    for eid, series in cal_series.items():
        normalized_cal_series[normalize_event_id(eid)] = series

    # Build source_id -> note_path mapping by scanning notes
    print("Building source_id -> note path mapping...")
    source_id_map = build_source_id_map()
    print(f"  Mapped {len(source_id_map):,} notes")

    # Load calendar events indexed by date
    print("Loading calendar events by date...")
    events_by_date = load_calendar_events_by_date(CALENDAR_EXPORT_PATH)
    print(f"  {len(events_by_date):,} unique dates")

    # Process each note
    assignments: dict[str, str | None] = {}
    notes_kept_existing = 0
    notes_derived_from_calendar = 0
    notes_not_found = 0
    notes_remain_null = 0

    for note_id, series in notes_series.items():
        if series is not None:
            assignments[note_id] = series
            notes_kept_existing += 1
            continue

        # Try to derive from calendar
        derived = None

        # Find note path using source_id map
        note_path = source_id_map.get(note_id)

        if not note_path or not note_path.exists():
            notes_not_found += 1
            assignments[note_id] = None
            continue

        try:
            with open(note_path) as f:
                fm = frontmatter.load(f)
            created_str = fm.get("created")
            if created_str:
                date_match = re.match(r"(\d{4}-\d{2}-\d{2})", str(created_str))
                if date_match:
                    date_str = date_match.group(1)
                    events_on_date = events_by_date.get(date_str, [])
                    for event_id in events_on_date:
                        normalized = normalize_event_id(event_id)
                        if normalized in normalized_cal_series:
                            derived = normalized_cal_series[normalized] + "_notes"
                            break
        except Exception:
            pass

        if derived:
            assignments[note_id] = derived
            notes_derived_from_calendar += 1
        else:
            assignments[note_id] = None
            notes_remain_null += 1

    # Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(assignments, f, indent=2, sort_keys=True)

    # Stats
    total_with_series = sum(1 for v in assignments.values() if v is not None)
    total_null = sum(1 for v in assignments.values() if v is None)

    series_counts = Counter(v for v in assignments.values() if v is not None)
    top5 = series_counts.most_common(5)

    print(f"\nResults:")
    print(f"  Notes with existing series (kept): {notes_kept_existing:,}")
    print(f"  Notes derived from calendar:        {notes_derived_from_calendar:,}")
    print(f"  Notes not found on disk:           {notes_not_found:,}")
    print(f"  Notes remaining null:               {notes_remain_null:,}")
    print(f"\nTotal notes with series: {total_with_series:,}")
    print(f"Total notes with null:  {total_null:,}")
    print(f"\nTop 5 series by assignment count:")
    for name, count in top5:
        print(f"  {name}: {count}")

    size = OUTPUT_PATH.stat().st_size
    print(f"\nOutput: {OUTPUT_PATH}")
    print(f"Size: {size:,} bytes")


if __name__ == "__main__":
    main()