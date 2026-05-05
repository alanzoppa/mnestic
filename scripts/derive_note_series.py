from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from pathlib import Path

import frontmatter

REPO_ROOT = Path(__file__).resolve().parents[1]
NOTES_DIR = REPO_ROOT / "notes"
OUT_PATH = REPO_ROOT / "data" / "series_from_notes.json"


# Meeting keywords for single-note fallback detection
MEETING_KEYWORDS = {
    "meeting", "call", "standup", "sync", "1:1", "one on one",
    "review", "demo", "interview", "kickoff", "retrospective", "planning",
}

# Title prefixes/suffixes to strip
PREFIX_PATTERNS = [
    r"^\d{8}_\s*",
    r"^\d{4}-\d{2}-\d{2}\s*[-–—]\s*",
    r"^\d{4}\.\d{2}\.\d{2}\s*",
    r"^\d{4}-\d{2}-\d{2}\s+",
    r"^meeting notes\s*[:\-]\s*",
    r"^call\s*[:\-]\s*",
    r"^handwriting from\s+",
    r"^snapshot\s+(from\s+)?",
    r"^note from\s+",
    r"^drafting\s+a\s+",
    r"^discuss\s+",
]

SUFFIX_PATTERNS = [
    r"\s*@\s+.*$",  # Strip location suffixes like "@ Chicago, Illinois"
    r"\s*__v?\d+.*$",  # Strip __v2 suffixes
    r"\s*__\d{4}-\d{2}-\d{2}.*$",  # Strip __YYYY-MM-DD
]


def normalize_title(title: str) -> str:
    t = title.lower().strip()
    for pat in PREFIX_PATTERNS:
        t = re.sub(pat, "", t, flags=re.IGNORECASE)
    for pat in SUFFIX_PATTERNS:
        t = re.sub(pat, "", t, flags=re.IGNORECASE)
    t = re.sub(r"[^\w\s]", " ", t)  # Replace punctuation with space
    t = re.sub(r"\s+", " ", t).strip()
    return t


def to_snake_case(s: str, max_len: int = 40) -> str:
    s = s.strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", "_", s).strip("_")
    if len(s) > max_len:
        s = s[:max_len].rsplit("_", 1)[0]
    return s


def parse_date_from_title(title: str) -> str | None:
    # Patterns: 20250605_, 2024-01-15, 2017.07.13, 2014-05-29
    for pat in [
        r"(\d{4})(\d{2})(\d{2})",
        r"(\d{4})-(\d{2})-(\d{2})",
        r"(\d{4})\.(\d{2})\.(\d{2})",
    ]:
        m = re.search(pat, title)
        if m:
            return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def looks_like_meeting(title: str, tags: list[str], participants: list[str]) -> bool:
    title_lower = title.lower()
    if any(kw in title_lower for kw in MEETING_KEYWORDS):
        return True
    tag_set = {t.lower() for t in tags}
    if tag_set & {"1:1", "one-on-one", "standup", "meeting", "interview"}:
        return True
    return False


def main() -> None:
    notes_data = []
    for md_path in sorted(NOTES_DIR.glob("*.md")):
        try:
            post = frontmatter.load(str(md_path))
        except Exception:
            continue

        note_id = post.get("source_id")
        if not note_id:
            continue

        title = post.get("title", "")
        folder = post.get("folder", "")
        created = post.get("created", "")
        tags = post.get("tags", []) or []
        participants = post.get("participants", []) or []

        if not title:
            continue

        norm = normalize_title(title)
        notes_data.append({
            "note_id": note_id,
            "title": title,
            "norm": norm,
            "folder": folder,
            "created": created,
            "tags": tags,
            "participants": [p.strip() for p in participants if p.strip()],
            "date_in_title": parse_date_from_title(title),
        })

    # Group by normalized title
    groups: dict[str, list[dict]] = defaultdict(list)
    for note in notes_data:
        groups[note["norm"]].append(note)

    series_map: dict[str, str | None] = {}
    assigned: dict[str, str] = {}

    # Rule 3 & 4: groups with >=3 notes, or 2 notes with same folder + participant overlap
    for norm, members in groups.items():
        if len(members) >= 3:
            series_name = to_snake_case(norm, max_len=40)
            for m in members:
                assigned[m["note_id"]] = series_name
            continue

        if len(members) == 2:
            a, b = members[0], members[1]
            folder_match = a["folder"] and a["folder"] == b["folder"]
            participant_overlap = bool(set(a["participants"]) & set(b["participants"]))
            if folder_match or participant_overlap:
                series_name = to_snake_case(norm, max_len=40)
                for m in members:
                    assigned[m["note_id"]] = series_name

    # Rule 6: single notes that look like meetings with date evidence
    # Check if created date (or title date) exists and title has meeting keywords
    for note in notes_data:
        if note["note_id"] in assigned:
            continue
        if not looks_like_meeting(note["title"], note["tags"], note["participants"]):
            continue
        # Must have some temporal evidence: created date or date in title
        has_date = bool(note["created"]) or bool(note["date_in_title"])
        if not has_date:
            continue
        series_name = to_snake_case(note["norm"], max_len=40)
        if series_name:
            assigned[note["note_id"]] = series_name

    # Build final map with nulls for unassigned
    for note in notes_data:
        series_map[note["note_id"]] = assigned.get(note["note_id"])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(series_map, f, indent=2, ensure_ascii=False)

    # Stats
    total = len(notes_data)
    unique_series = sorted(set(v for v in assigned.values() if v))
    assigned_count = len(assigned)
    series_counts: dict[str, int] = defaultdict(int)
    for v in assigned.values():
        series_counts[v] += 1
    top5 = sorted(series_counts.items(), key=lambda x: (-x[1], x[0]))[:5]

    print(f"Notes analyzed: {total}")
    print(f"Unique series found: {len(unique_series)}")
    print(f"Notes assigned to a series: {assigned_count}")
    print("Top 5 series by assignment count:")
    for name, cnt in top5:
        print(f"  {name}: {cnt}")
    print(f"Output: {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
