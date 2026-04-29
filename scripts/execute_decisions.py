#!/usr/bin/env python3
"""
Execute all adjudication decisions and give Category C files unique titles.
"""

import re, sys, json, shutil
from pathlib import Path
import frontmatter

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"
ADJ_PATH = NOTES_DIR / ".adjudication.json"
TRASH_DIR = NOTES_DIR / ".dedup_trash"
B_TRASH = TRASH_DIR / "B_deleted"

def make_unique_title(body: str, meta: dict, existing: set) -> str:
    """Derive a unique descriptive title from note content."""
    title = str(meta.get("title", "")).strip()
    created = str(meta.get("created", ""))[:10] if meta.get("created") else ""

    if title and title != "Untitled Note" and title != "New Note":
        base = title
    else:
        # Derive from first line of content
        body_clean = (body or "").strip()
        if not body_clean:
            base = title if title else "Empty Note"
        else:
            first_line = body_clean.split("\n")[0].strip()
            # Strip markdown headers, formatting
            first_line = re.sub(r'^#+\s*', '', first_line)
            first_line = re.sub(r'[*_~`]', '', first_line)
            first_line = re.sub(r'[\[\]\(\)]', '', first_line)
            first_line = first_line.strip()
            if len(first_line) > 80:
                first_line = first_line[:77] + "..."
            if not first_line:
                first_line = body_clean[:80].strip()
                if len(first_line) >= 80:
                    first_line = first_line[:77] + "..."
            base = first_line if first_line else "Empty Note"

    # Append date if available
    if created and re.match(r'\d{4}-\d{2}-\d{2}', created):
        suffix = created
    else:
        sid = str(meta.get("source_id", ""))
        if sid:
            sid_frag = re.sub(r'[^a-zA-Z0-9]', '-', sid)[:20]
            suffix = sid_frag
        else:
            suffix = "no-date"

    candidate = f"{base}__{suffix}"
    candidate = re.sub(r'[<>:"/\\|?*]', '-', candidate)
    candidate = re.sub(r'--+', '-', candidate)

    # Handle collisions
    if candidate not in existing:
        return candidate
    counter = 2
    while f"{candidate}_v{counter}" in existing:
        counter += 1
    return f"{candidate}_v{counter}"

def main():
    if not ADJ_PATH.is_file():
        print("ERROR: Run adjudicate_dupes.py first")
        return 1

    with open(ADJ_PATH) as f:
        adj = json.load(f)

    TRASH_DIR.mkdir(exist_ok=True)
    B_TRASH.mkdir(parents=True, exist_ok=True)

    # ===== Execute B decisions =====
    for fp in adj.get("B_delete_files", []):
        src = Path(fp)
        if src.is_file():
            dest = B_TRASH / src.name
            c = 1
            while dest.exists():
                dest = B_TRASH / f"{src.stem}_{c}{src.suffix}"
                c += 1
            shutil.move(str(src), str(dest))
    print(f"B_delete: {len(adj.get('B_delete_files',[]))} files moved to trash")

    for pair in adj.get("B_copy_from_dup_pairs", []):
        dup_path = Path(pair["dup"])
        base_path = Path(pair["base_dest"])
        if dup_path.is_file() and base_path.is_file():
            base_path.write_text(dup_path.read_text())
            dest = B_TRASH / dup_path.name
            c = 1
            while dest.exists():
                dest = B_TRASH / f"{dup_path.stem}_{c}{dup_path.suffix}"
                c += 1
            shutil.move(str(dup_path), str(dest))
    print(f"B_copy_from_dup: {len(adj.get('B_copy_from_dup_pairs',[]))} files copied over base, dup moved to trash")

    # Also handle README__14 if it exists (no source_id, different note)
    readme14 = NOTES_DIR / "README__14.md"
    if readme14.is_file():
        adj.setdefault("C_renames", []).append({"old": "README__14.md", "new": None})

    # ===== Rename Category C files =====
    # First, collect all existing filenames
    existing = set()
    for f in NOTES_DIR.glob("*.md"):
        if f.name == ".ingest_state.json":
            continue
        existing.add(f.stem)

    renamed = []
    skipped = 0

    for rename_info in adj.get("C_renames", []):
        old_name = rename_info["old"]

        # Find the actual file (it may have been renamed already)
        src = NOTES_DIR / old_name
        if not src.is_file():
            # Try to find by checking __N variants
            skipped += 1
            continue

        meta = frontmatter.load(str(src)).metadata
        body = (frontmatter.load(str(src)).content or "").strip()

        new_stem = make_unique_title(body, dict(meta), existing)

        new_name = f"{new_stem}.md"
        dest = NOTES_DIR / new_name

        if dest.name == src.name:
            skipped += 1
            continue

        if dest.is_file():
            # Already exists — shouldn't happen with make_unique_title, but be safe
            counter = 2
            while dest.is_file():
                dest = NOTES_DIR / f"{new_stem}_v{counter}.md"
                counter += 1

        src.rename(dest)
        existing.add(dest.stem)
        renamed.append((old_name, dest.name))
        print(f"  {old_name} → {dest.name}")

    print(f"\nC_renamed: {len(renamed)} files")
    print(f"C_skipped: {skipped}")

    # ===== Save results =====
    result = {
        "B_deleted": len(adj.get("B_delete_files", [])),
        "B_copied": len(adj.get("B_copy_from_dup_pairs", [])),
        "C_renamed": len(renamed),
        "C_skipped": skipped,
    }
    res_path = NOTES_DIR / ".cleanup_result.json"
    with open(res_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nResults saved to {res_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
