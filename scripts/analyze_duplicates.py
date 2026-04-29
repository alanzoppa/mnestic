#!/usr/bin/env python3
"""Analyze __N duplicate note files and categorize them for safe cleanup."""

import re, sys, shutil, json
from pathlib import Path
import frontmatter

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"
MULTI_SUFFIX_RE = re.compile(r"^(.*?)((?:__\d+)+)\.md$")
SUFFIX_RE = re.compile(r"^(.*?)__(\d+)\.md$")

Category = dict  # {status, action, base_file, base_source_id, dup_source_id, body_match}

def find_base(name: str) -> str | None:
    """Strip the last __N suffix to find base filename. Returns None if no suffix."""
    m = SUFFIX_RE.match(name)
    if not m:
        return None
    base_name = f"{m.group(1)}.md"
    return base_name

def main():
    all_files = sorted(NOTES_DIR.glob("*.md"))
    all_files = [f for f in all_files if f.name != ".ingest_state.json"]

    # Only files with __\d+ suffix (or nested __\d+__\d+...) are dup candidates
    DUP_SUFFIX_RE = re.compile(r"(__\d+)+$")
    dup_candidates = [f for f in all_files if DUP_SUFFIX_RE.search(f.stem)]
    non_dup = [f for f in all_files if not DUP_SUFFIX_RE.search(f.stem)]

    print(f"Total .md files: {len(all_files)}")
    print(f"Files with __N suffix: {len(dup_candidates)}")
    print(f"Files without __N suffix: {len(non_dup)}")
    print()

    categories: dict[str, list[dict]] = {"A_delete": [], "B_review": [], "C_rename": [], "D_orphan_rename": []}

    for dup in dup_candidates:
        base_name = find_base(dup.name)
        dup_data = frontmatter.load(str(dup))
        dup_sid = dup_data.metadata.get("source_id", "")
        dup_body = (dup_data.content or "").strip()

        # Find base in our file list
        base = NOTES_DIR / base_name if base_name else None
        base_exists = base is not None and base.is_file()

        if not base_exists:
            # Category D: no base file exists — orphaned original, needs rename
            # But also check if dup is __2__3 etc — find the "true base" by stripping all suffixes
            true_base_stem = re.sub(r"(__\d+)+$", "", dup.stem)
            true_base = NOTES_DIR / f"{true_base_stem}.md"
            if true_base.is_file():
                # There IS a true base (stripping all __N), so this is still a duplicate
                dup_data2 = frontmatter.load(str(true_base))
                true_sid = dup_data2.metadata.get("source_id", "")
                true_body = (dup_data2.content or "").strip()
                if true_sid == dup_sid:
                    body_match = dup_body == true_body
                    cat = "A_delete" if body_match else "B_review"
                else:
                    cat = "C_rename"
                categories[cat].append({
                    "dup_file": str(dup),
                    "base_file": str(true_base),
                    "dup_source_id": dup_sid,
                    "base_source_id": true_sid,
                    "body_match": body_match if cat in ("A_delete", "B_review") else None,
                })
                continue

            categories["D_orphan_rename"].append({
                "dup_file": str(dup),
                "expected_base": str(base) if base else str(true_base),
                "dup_source_id": dup_sid,
            })
            continue

        base_data = frontmatter.load(str(base))
        base_sid = base_data.metadata.get("source_id", "")
        base_body = (base_data.content or "").strip()

        body_match = dup_body == base_body
        same_sid = base_sid == dup_sid

        if same_sid:
            if body_match:
                categories["A_delete"].append({
                    "dup_file": str(dup),
                    "base_file": str(base),
                    "dup_source_id": dup_sid,
                    "base_source_id": base_sid,
                    "body_match": True,
                })
            else:
                categories["B_review"].append({
                    "dup_file": str(dup),
                    "base_file": str(base),
                    "dup_source_id": dup_sid,
                    "base_source_id": base_sid,
                    "body_match": False,
                    "dup_body_len": len(dup_body),
                    "base_body_len": len(base_body),
                })
        else:
            categories["C_rename"].append({
                "dup_file": str(dup),
                "base_file": str(base),
                "dup_source_id": dup_sid,
                "base_source_id": base_sid,
            })

    # Print report
    for cat_name, label, icon in [
        ("A_delete", "SAFE TO DELETE — same source_id, identical body", "🗑 "),
        ("B_review", "NEEDS REVIEW — same source_id, DIFFERENT body", "⚠️ "),
        ("C_rename", "DISTINCT NOTES — different source_id, same title", "✏️ "),
        ("D_orphan_rename", "ORPHAN ORIGINALS — no base file, rename to drop __N", "📄 "),
    ]:
        items = categories[cat_name]
        print(f"{icon}{label}: {len(items)} files")
        print("-" * 60)

    print()
    print("CATEGORY B — NEEDS REVIEW (different body, same source_id):")
    for item in categories["B_review"]:
        print(f"  DUP:  {Path(item['dup_file']).name}")
        print(f"  BASE: {Path(item['base_file']).name}")
        print(f"  source_id: {item['dup_source_id']}")
        print(f"  dup body: {item['dup_body_len']} chars, base body: {item['base_body_len']} chars")
        print()

    print()
    print("CATEGORY C — DISTINCT NOTES (different source_id):")
    for item in categories["C_rename"]:
        print(f"  FILE: {Path(item['dup_file']).name}")
        print(f"  BASE: {Path(item['base_file']).name} (title collision)")
        print(f"  DUP source_id: {item['dup_source_id']}")
        print(f"  BASE source_id: {item['base_source_id']}")
        print()

    # Write JSON report for scripted cleanup
    report = {k: len(v) for k, v in categories.items()}
    report["A_delete_files"] = [item["dup_file"] for item in categories["A_delete"]]
    report["D_orphan_rename_files"] = [item["dup_file"] for item in categories["D_orphan_rename"]]
    report["C_rename_files"] = [item["dup_file"] for item in categories["C_rename"]]
    report["B_review_files"] = [item["dup_file"] for item in categories["B_review"]]

    report_path = NOTES_DIR / ".dedup_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"\nFull report saved to {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
