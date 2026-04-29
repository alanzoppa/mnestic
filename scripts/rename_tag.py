#!/usr/bin/env python3
"""Rename tag '1-on-1' to '1:1' in frontmatter only."""
import sys, re
from pathlib import Path
import frontmatter

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"

def fix_tags(filepath: Path) -> bool:
    post = frontmatter.load(str(filepath))
    tags = post.metadata.get("tags", [])
    if not isinstance(tags, list):
        return False
    new_tags = []
    changed = False
    for t in tags:
        if isinstance(t, str) and t.strip() == "1-on-1":
            new_tags.append("1:1")
            changed = True
        else:
            new_tags.append(t)
    if not changed:
        return False

    # Rewrite file preserving exact frontmatter YAML structure
    raw = filepath.read_text()
    lines = raw.split("\n")
    in_tags = False
    tag_indent = ""
    out = []
    for line in lines:
        if line.strip() == "tags:" and not in_tags:
            in_tags = True
            out.append(line)
            continue
        if in_tags and line.startswith("-"):
            indent = len(line) - len(line.lstrip())
            tag_indent = " " * indent
            tag_val = line.lstrip()[2:].strip().strip("'\"")
            if tag_val == "1-on-1":
                out.append(f"{tag_indent}- 1:1")
            else:
                out.append(line)
            continue
        if in_tags and not line.startswith("-") and line.strip() != "":
            in_tags = False
        out.append(line)

    new_raw = "\n".join(out)
    if new_raw != raw:
        filepath.write_text(new_raw)
        return True
    return False

total = 0
for mf in sorted(NOTES_DIR.glob("*.md")):
    if mf.name in (".ingest_state.json",):
        continue
    if fix_tags(mf):
        total += 1
print(f"Fixed tag 1-on-1 → 1:1 in {total} files")
