#!/usr/bin/env python3
"""
Auto-adjudicate Category B (same source_id, different body) and
Category C (different source_id, same title) duplicates.

Heuristics for B (identical note, different import quality):
  - If __N is mostly OCR garbage / HTML tags → delete __N
  - If __N body is a strict subset of base → delete __N
  - If base body is a strict subset of __N → copy __N to base, delete __N
  - If __N is ≥3x longer (better import) → copy __N to base, delete __N
  - If base is ≥3x longer → delete __N (base is better)
  - Otherwise: FLAG for manual review

Heuristics for C (genuinely different notes, same title):
  - Compute unique stem: {title}__{YYYY-MM-DD}__{source_id_fragment}
  - Rename to avoid __N collision
"""

import re, sys, json, shutil, os
from pathlib import Path
import frontmatter

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"
REPORT_PATH = NOTES_DIR / ".dedup_report.json"
TRASH_DIR = NOTES_DIR / ".dedup_trash"
B_TRASH = TRASH_DIR / "B_deleted"
C_RENAMED = TRASH_DIR / "C_renamed_originals"

DUP_SUFFIX_RE = re.compile(r"(__\d+)+$")
OCRX_HTML_RE = re.compile(r'<(div|span|br|p|en-|img|table|tr|td|a|font|b|i|u|h[1-6]|style|meta|body|head|html)', re.I)
OCR_JUNK_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')
CONSECUTIVE_NEWLINES = re.compile(r'\n{4,}')

def body_quality(body: str) -> dict:
    """Score body quality: ratio of real text vs OCR/HTML noise."""
    clean = body.strip()
    if not clean:
        return {"len": 0, "html_ratio": 0, "ocr_ratio": 0, "newline_ratio": 0, "quality": 0}

    html_lines = 0
    lines = clean.split('\n')
    total_lines = len(lines)
    for line in lines:
        if OCRX_HTML_RE.search(line):
            html_lines += 1

    html_ratio = html_lines / total_lines if total_lines else 0
    ocr_ratio = len(OCR_JUNK_RE.findall(clean)) / max(len(clean), 1)
    newline_chunks = CONSECUTIVE_NEWLINES.findall(clean)
    newline_ratio = sum(len(c) for c in newline_chunks) / max(len(clean), 1)

    quality = 1.0
    quality -= html_ratio * 0.8
    quality -= ocr_ratio * 10.0
    quality -= newline_ratio * 5.0
    quality = max(quality, 0.0)

    return {
        "len": len(clean),
        "html_ratio": html_ratio,
        "ocr_ratio": ocr_ratio,
        "newline_ratio": newline_ratio,
        "quality": quality
    }

def load_pair(dup_path: str, base_path: str) -> dict:
    dp = Path(dup_path)
    bp = Path(base_path)
    d = frontmatter.load(str(dp))
    b = frontmatter.load(str(bp))
    d_body = (d.content or '').strip()
    b_body = (b.content or '').strip()
    d_meta = dict(d.metadata)
    b_meta = dict(b.metadata)
    d_dates = (d_meta.get('created', ''), d_meta.get('modified', ''))
    b_dates = (b_meta.get('created', ''), b_meta.get('modified', ''))
    return {
        "dup_file": str(dp),
        "base_file": str(bp),
        "dup_name": dp.name,
        "base_name": bp.name,
        "dup_body": d_body,
        "base_body": b_body,
        "dup_meta": d_meta,
        "base_meta": b_meta,
        "dup_dates": d_dates,
        "base_dates": b_dates,
        "dup_len": len(d_body),
        "base_len": len(b_body),
        "dup_quality": body_quality(d_body),
        "base_quality": body_quality(b_body),
    }

def main():
    if not REPORT_PATH.is_file():
        print("ERROR: Run analyze_duplicates.py first")
        return 1

    with open(REPORT_PATH) as f:
        report = json.load(f)

    TRASH_DIR.mkdir(exist_ok=True)
    B_TRASH.mkdir(exist_ok=True)
    C_RENAMED.mkdir(exist_ok=True)

    decisions = {"B_delete": [], "B_copy_from_dup": [], "B_manual": [], "C_renamed": [], "B_keep_both": []}

    # ===== PROCESS CATEGORY B =====
    b_raw = report.get("B_review_files", [])
    print(f"=== Category B: {len(b_raw)} files ===\n")

    # Map each B file to its true base using the approach from analyze_duplicates.py
    b_pairs = []
    for filepath in b_raw:
        dp = Path(filepath)
        true_stem = re.sub(r"(__\d+)+$", "", dp.stem)
        bp = NOTES_DIR / f"{true_stem}.md"
        if not bp.is_file():
            print(f"  SKIP: base not found for {dp.name}")
            continue
        # Skip if already same file (shouldn't happen with B)
        if dp.resolve() == bp.resolve():
            continue
        pair = load_pair(str(dp), str(bp))
        b_pairs.append(pair)

    for pair in b_pairs:
        dn, bn = pair["dup_name"], pair["base_name"]
        dq = pair["dup_quality"]
        bq = pair["base_quality"]
        dl, bl = pair["dup_len"], pair["base_len"]

        # Check subset relationship
        dup_in_base = pair["dup_body"] in pair["base_body"] and dl > 0
        base_in_dup = pair["base_body"] in pair["dup_body"] and bl > 0 and dl > bl

        # Check OCR quality
        dup_is_ocr = dq["html_ratio"] > 0.3 or dq["ocr_ratio"] > 0.01 or dq["quality"] < 0.3
        base_is_ocr = bq["html_ratio"] > 0.3 or bq["ocr_ratio"] > 0.01 or bq["quality"] < 0.3

        decision = None
        reason = ""

        if dup_in_base and not base_in_dup:
            decision = "B_delete"
            reason = f"dup is strict subset of base ({dl} ⊆ {bl})"
        elif base_in_dup and not dup_in_base:
            decision = "B_copy_from_dup"
            reason = f"base is strict subset of dup ({bl} ⊂ {dl})"
        elif dup_is_ocr and not base_is_ocr:
            # Both have content, but dup is OCR junk
            if dup_in_base:
                decision = "B_delete"
                reason = f"dup is OCR subset, base is clean"
            else:
                decision = "B_delete"
                reason = f"dup is OCR garbage (html={dq['html_ratio']:.2f}), base is clean"
        elif base_is_ocr and not dup_is_ocr:
            decision = "B_copy_from_dup"
            reason = f"base is OCR garbage (html={bq['html_ratio']:.2f}), dup is clean(er)"
        elif dl >= bl * 3 and dq["quality"] >= bq["quality"]:
            decision = "B_copy_from_dup"
            reason = f"dup is {dl}/{bl}={dl/bl if bl else 0:.1f}x larger and equal quality"
        elif bl >= dl * 3 and bq["quality"] >= dq["quality"]:
            decision = "B_delete"
            reason = f"base is {bl}/{dl}={bl/dl if dl else 0:.1f}x larger and equal quality"
        elif dl == 0 and bl > 0:
            decision = "B_delete"
            reason = "dup is empty, base has content"
        elif bl == 0 and dl > 0:
            decision = "B_copy_from_dup"
            reason = "base is empty, dup has content"
        elif dup_is_ocr and base_is_ocr:
            if dl >= bl:
                decision = "B_copy_from_dup"
                reason = f"both OCR, dup is longer ({dl} vs {bl})"
            else:
                decision = "B_delete"
                reason = f"both OCR, base is longer ({bl} vs {dl})"
        elif dq["quality"] >= 0.9 and bq["quality"] >= 0.9:
            if dl >= bl:
                decision = "B_copy_from_dup"
                reason = f"both clean, dup longer ({dl} vs {bl})"
            else:
                decision = "B_delete"
                reason = f"both clean, base longer ({bl} vs {dl})"
        elif dq["quality"] > bq["quality"] + 0.15:
            decision = "B_copy_from_dup"
            reason = f"dup quality ({dq['quality']:.2f}) >> base ({bq['quality']:.2f})"
        elif bq["quality"] > dq["quality"] + 0.15:
            decision = "B_delete"
            reason = f"base quality ({bq['quality']:.2f}) >> dup ({dq['quality']:.2f})"
        else:
            decision = "B_manual"
            reason = f"ambiguous — dup({dl}c,q={dq['quality']:.2f}) vs base({bl}c,q={bq['quality']:.2f})"

        print(f"  {decision}: {dn} → {bn}")
        print(f"    {reason}")

        decisions[decision].append(pair)

    # ===== PROCESS CATEGORY C =====
    c_raw = report.get("C_rename_files", [])
    print(f"\n=== Category C: {len(c_raw)} files ===\n")

    for filepath in c_raw:
        dp = Path(filepath)
        d = frontmatter.load(str(dp))
        meta = dict(d.metadata)
        sid = meta.get("source_id", "")
        created = str(meta.get("created", ""))[:10]

        # Compute unique stem
        title_base = re.sub(r"(__\d+)+$", "", dp.stem)

        if created and re.match(r'\d{4}-\d{2}-\d{2}', created):
            new_stem = f"{title_base}__{created}"
        else:
            # Use source_id fragment
            sid_frag = sid.replace("evernote:note:", "").replace("x-coredata://", "").replace("/", "-")[:20]
            if sid_frag:
                new_stem = f"{title_base}__{sid_frag}"
            else:
                new_stem = f"{title_base}__{dp.stem.split('__')[-1]}"

        new_name = f"{new_stem}.md"
        new_path = NOTES_DIR / new_name

        # Avoid collision: append counter if needed
        counter = 2
        final_new_path = new_path
        while (NOTES_DIR / final_new_path.name).is_file():
            final_new_path = NOTES_DIR / f"{new_stem}_v{counter}.md"
            counter += 1

        # Check if it already has the right name
        if final_new_path.name == dp.name:
            print(f"  ALREADY OK: {dp.name}")
            continue

        decisions["C_renamed"].append({
            "dup_file": str(dp),
            "new_name": final_new_path.name,
            "old_name": dp.name,
            "title_base": title_base,
            "created": created,
            "sid": sid,
        })
        print(f"  RENAME: {dp.name} → {final_new_path.name}")

    # ===== DISPLAY B MANUAL FLAGS =====
    print(f"\n=== B_MANUAL (needs human): {len(decisions['B_manual'])} files ===")
    for pair in decisions["B_manual"]:
        print(f"  {pair['dup_name']} vs {pair['base_name']}")
        print(f"    dup:  {pair['dup_len']}c, html={pair['dup_quality']['html_ratio']:.2f}, ocr={pair['dup_quality']['ocr_ratio']:.3f}, q={pair['dup_quality']['quality']:.2f}")
        print(f"    base: {pair['base_len']}c, html={pair['base_quality']['html_ratio']:.2f}, ocr={pair['base_quality']['ocr_ratio']:.3f}, q={pair['base_quality']['quality']:.2f}")

    # ===== SAVE DECISIONS REPORT =====
    decision_report = {
        "B_delete_count": len(decisions["B_delete"]),
        "B_delete_files": [p["dup_file"] for p in decisions["B_delete"]],
        "B_copy_from_dup_count": len(decisions["B_copy_from_dup"]),
        "B_copy_from_dup_pairs": [{"dup": p["dup_file"], "base_dest": p["base_file"]} for p in decisions["B_copy_from_dup"]],
        "B_manual_count": len(decisions["B_manual"]),
        "B_manual_files": [p["dup_file"] for p in decisions["B_manual"]],
        "C_renamed_count": len(decisions["C_renamed"]),
        "C_renames": [{"old": d["old_name"], "new": d["new_name"]} for d in decisions["C_renamed"]],
    }
    dec_path = NOTES_DIR / ".adjudication.json"
    with open(dec_path, "w") as f:
        json.dump(decision_report, f, indent=2)

    print(f"\n=== SUMMARY ===")
    print(f"B_delete:        {len(decisions['B_delete'])}  — safe to delete")
    print(f"B_copy_from_dup: {len(decisions['B_copy_from_dup'])} — copy dup over base, then delete")
    print(f"B_manual:        {len(decisions['B_manual'])} — need human review")
    print(f"C_renamed:       {len(decisions['C_renamed'])} — unique names computed")
    print(f"\nDecisions saved to {dec_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
