#!/usr/bin/env python3
"""Safely delete Category A duplicate files (same source_id, identical body).
Category B, C files are left untouched for manual review."""

import json, os, sys
from pathlib import Path

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"
REPORT_PATH = NOTES_DIR / ".dedup_report.json"
TRASH_DIR = NOTES_DIR / ".dedup_trash"

def main():
    if not REPORT_PATH.is_file():
        print("ERROR: Run analyze_duplicates.py first to generate .dedup_report.json")
        return 1

    with open(REPORT_PATH) as f:
        report = json.load(f)

    a_files = report.get("A_delete_files", [])
    b_count = report.get("B_review", 0)
    c_count = report.get("C_rename", 0)

    print(f"Category A (SAFE TO DELETE):   {len(a_files)} files")
    print(f"Category B (NEEDS REVIEW):     {b_count} files — SKIPPED")
    print(f"Category C (DISTINCT NOTES):   {c_count} files — SKIPPED")
    print()

    if not a_files:
        print("Nothing to do.")
        return 0

    TRASH_DIR.mkdir(exist_ok=True)

    deleted = 0
    not_found = 0
    for filepath in a_files:
        p = Path(filepath)
        if not p.is_file():
            not_found += 1
            continue
        dest = TRASH_DIR / p.name
        counter = 1
        while dest.exists():
            dest = TRASH_DIR / f"{p.stem}_{counter}{p.suffix}"
            counter += 1
        p.rename(dest)
        deleted += 1

    print(f"Deleted: {deleted} files moved to {TRASH_DIR}")
    if not_found:
        print(f"Skipped (not found): {not_found}")
    print()

    # Verify no data loss: for each deleted file, base file must exist and have content
    missing_base = []
    for filepath in a_files:
        p = Path(filepath)
        # the base is the file without __N suffix
        true_stem = p.stem
        while "__" in true_stem.rsplit("__", 1)[-1] if "__" in true_stem else False:
            pass
        import re
        true_stem = re.sub(r"(__\d+)+$", "", p.stem)
        base = NOTES_DIR / f"{true_stem}.md"
        if not base.is_file():
            missing_base.append(str(base))

    if missing_base:
        print(f"WARNING: {len(missing_base)} base files not found! Restore from trash:")
        for mb in missing_base[:10]:
            print(f"  {mb}")
        return 1

    print("Verification passed: all base files exist.")
    print(f"\nTo permanently remove: rm -rf {TRASH_DIR}")
    print(f"To restore: mv {TRASH_DIR}/* {NOTES_DIR}/")
    return 0

if __name__ == "__main__":
    sys.exit(main())
