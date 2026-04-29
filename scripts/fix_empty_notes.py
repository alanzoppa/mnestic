#!/usr/bin/env python3
"""Classify notes with empty body text into: contentless, image-only, or lost-content."""

import os
import re
import sys
from pathlib import Path

import frontmatter

NOTES_DIR = Path(__file__).parent.parent / "notes"
IMAGE_PATTERNS = [
    r"!\[[^\]]*\]\([^)]+\)",
    r"\[View original\]\([^)]+\)",
    r"<img[^>]*>",
    r"\[AI caption\]:",
]
IMAGE_RE = re.compile("|".join(IMAGE_PATTERNS), re.IGNORECASE)


def strip_body(body: str) -> str:
    body = IMAGE_RE.sub("", body)
    body = re.sub(r"\[([^\]]*)\]\([^)]+\)", r"\1", body)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"#+ ", "", body)
    return body.strip()


def classify_body(title: str, body: str) -> str | None:
    stripped = strip_body(body)
    if stripped:
        return None
    if not body:
        title_lower = title.lower()
        short_story_words = [
            "idea", "note", "thought", "concept", "sketch",
            "seed", "fragment", "snippet", "prompt", "maybe", "perhaps",
        ]
        if any(w in title_lower for w in short_story_words):
            return "contentless"
        if len(title.split()) <= 6:
            return "contentless"
        return "lost-content"
    has_images = bool(IMAGE_RE.search(body))
    has_other = bool(strip_body(body))
    if has_images and not has_other:
        return "image-only"
    return "contentless"


def process_file(filepath: Path) -> tuple[str | None, str]:
    try:
        note = frontmatter.load(filepath)
    except Exception as e:
        return None, f"ERROR: {e}"
    title = note.get("title", "") or ""
    body = note.content or ""
    classification = classify_body(title, body)
    if classification:
        tags = note.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",")]
        if classification not in tags:
            tags.append(classification)
        note["tags"] = tags
        try:
            filepath.write_text(frontmatter.dumps(note), encoding="utf-8")
        except Exception as e:
            return classification, f"WRITE ERROR: {e}"
        return classification, "ok"
    return None, "ok"


def main():
    files = list(Path(NOTES_DIR).glob("*.md"))
    counts = {"contentless": [], "image-only": [], "lost-content": []}
    errors = []

    for f in files:
        cls, msg = process_file(f)
        if cls:
            counts[cls].append(f.name)
        if msg != "ok":
            errors.append(f"{f.name}: {msg}")

    print("=== Empty Notes Classification Report ===\n")
    for kind in ["contentless", "image-only", "lost-content"]:
        names = counts[kind]
        print(f"{kind}: {len(names)} notes")
        for n in names[:10]:
            print(f"  - {n}")
        if len(names) > 10:
            print(f"  ... and {len(names) - 10} more")
        print()

    if errors:
        print("Errors:")
        for e in errors:
            print(f"  {e}")
    else:
        print("No errors.")

if __name__ == "__main__":
    main()
