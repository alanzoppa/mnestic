#!/usr/bin/env python3
"""
Derive recurring event series from a Google Calendar export JSON.

Usage:
    cd /Users/alanzoppa/Code/notes-browser
    backend/.venv/bin/python scripts/derive_calendar_series.py

Outputs:
    data/series_from_calendar.json  -> {event_id: series_name}
"""

from __future__ import annotations

import json
import os
import re
import string
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def load_events(path: str) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    return data.get("events", [])


def normalize_title(title: str | None) -> str:
    if not title:
        return ""
    t = title.strip()
    prefixes = ["Canceled:", "Updated:", "Re:", "Fwd:"]
    for p in prefixes:
        if t.startswith(p):
            t = t[len(p) :].strip()
    t = t.lower()
    t = t.strip()
    t = t.rstrip(string.punctuation)
    return t


def to_snake_case(name: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    s = re.sub(r"_+", "_", s)
    if len(s) > max_len:
        s = s[:max_len].rsplit("_", 1)[0]  # try not to cut mid-word
    return s


def get_event_date(event: dict) -> str | None:
    start = event.get("start", {})
    dt = start.get("dateTime") or start.get("date")
    if not dt:
        return None
    try:
        if "T" in dt:
            return datetime.fromisoformat(dt).strftime("%Y-%m-%d")
        return dt
    except Exception:
        return None


def get_attendees(event: dict) -> set[str]:
    out: set[str] = set()
    organizer = event.get("organizer", {})
    dn = organizer.get("displayName")
    if dn:
        out.add(dn)
    for a in event.get("attendees", []):
        dn = a.get("displayName")
        if dn:
            out.add(dn)
    return out


def attendee_overlap(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    total = a.union(b)
    if not total:
        return 0.0
    return len(a.intersection(b)) / len(total)


def jaccard_similarity(a: str, b: str) -> float:
    sa = set(a.split())
    sb = set(b.split())
    if not sa and not sb:
        return 1.0
    inter = sa.intersection(sb)
    union = sa.union(sb)
    if not union:
        return 0.0
    return len(inter) / len(union)


def derive_series(events: list[dict]) -> dict[str, str]:
    # Step 1: normalize titles and group
    groups = defaultdict(list)
    for ev in events:
        nid = ev.get("id")
        if not nid:
            continue
        ntitle = normalize_title(ev.get("summary"))
        if not ntitle:
            continue
        groups[ntitle].append(ev)

    event_to_series: dict[str, str] = {}
    assigned: set[str] = set()

    # Step 2: genuinely recurring (≥3 events, multiple dates)
    for ntitle, evs in groups.items():
        if len(evs) >= 3:
            dates = {get_event_date(ev) for ev in evs}
            dates.discard(None)
            if len(dates) >= 2:
                series = to_snake_case(ntitle)
                for ev in evs:
                    eid = ev["id"]
                    if eid not in assigned:
                        event_to_series[eid] = series
                        assigned.add(eid)

    # Step 3: groups with exactly 2 events — check title similarity + attendee overlap
    for ntitle, evs in groups.items():
        if len(evs) == 2:
            e1, e2 = evs[0], evs[1]
            e1id, e2id = e1["id"], e2["id"]
            # skip if already assigned
            if e1id in assigned and e2id in assigned:
                continue
            # title similarity within group is perfect, so we use attendee overlap
            a1 = get_attendees(e1)
            a2 = get_attendees(e2)
            overlap = attendee_overlap(a1, a2)
            if overlap >= 0.5:
                series = to_snake_case(ntitle)
                for ev in evs:
                    eid = ev["id"]
                    if eid not in assigned:
                        event_to_series[eid] = series
                        assigned.add(eid)

    # Step 4: cross-group similarity for 2-event groups with similar titles but overlapping attendees
    # Build list of unassigned 2-event groups
    two_event_groups = {
        ntitle: evs for ntitle, evs in groups.items()
        if len(evs) == 2
    }

    processed = set()
    ordered = sorted(two_event_groups.keys())
    for i, t1 in enumerate(ordered):
        if t1 in processed:
            continue
        cluster_evs = list(two_event_groups[t1])
        cluster_titles = [t1]
        for t2 in ordered[i + 1 :]:
            if t2 in processed:
                continue
            sim = jaccard_similarity(t1, t2)
            if sim >= 0.75:
                e1 = two_event_groups[t1][0]
                e2 = two_event_groups[t2][0]
                ov = attendee_overlap(get_attendees(e1), get_attendees(e2))
                if ov >= 0.5:
                    cluster_evs.extend(two_event_groups[t2])
                    cluster_titles.append(t2)
                    processed.add(t2)
        if len(cluster_evs) >= 3:
            all_dates = {get_event_date(ev) for ev in cluster_evs}
            all_dates.discard(None)
            if len(all_dates) >= 2:
                representative = min(cluster_titles, key=len)
                series = to_snake_case(representative)
                for ev in cluster_evs:
                    eid = ev["id"]
                    if eid not in assigned:
                        event_to_series[eid] = series
                        assigned.add(eid)
                processed.add(t1)

    return event_to_series


def main():
    repo_root = Path("/Users/alanzoppa/Code/notes-browser")
    input_path = Path("/Users/alanzoppa/Downloads/calendar-export.json")
    output_path = repo_root / "data" / "series_from_calendar.json"

    events = load_events(str(input_path))
    print(f"Loaded {len(events):,} events from {input_path}")

    mapping = derive_series(events)
    os.makedirs(output_path.parent, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(mapping, f, indent=2, sort_keys=True)

    # Stats
    unique_series = set(mapping.values())
    from collections import Counter

    series_counts = Counter(mapping.values())
    top5 = series_counts.most_common(5)

    print(f"\nUnique series found: {len(unique_series):,}")
    print(f"Events assigned to a series: {len(mapping):,}")
    print("\nTop 5 series by event count:")
    for name, count in top5:
        print(f"  {name}: {count}")

    size = output_path.stat().st_size
    print(f"\nOutput: {output_path}")
    print(f"Size: {size:,} bytes")


if __name__ == "__main__":
    main()
