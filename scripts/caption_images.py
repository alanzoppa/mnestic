#!/usr/bin/env python3
import argparse
import base64
import os
import re
import sys
import time

import httpx

NOTES_DIR = os.path.join(os.path.dirname(__file__), "..", "notes")
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "images")
CAPTION_MARKER = "[AI caption]"
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "kimi-k2.5:cloud"
PROMPT = (
    "Describe this image in detail. Include any visible text (transcribe it exactly), "
    "people, objects, charts/diagrams, and context. Be concise but thorough. "
    "If it's a handwriting/drawing, describe what it depicts. "
    "If it's a screenshot, describe the UI and content."
)


IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}

def find_image_only_notes() -> list[tuple[str, list[str]]]:
    results = []
    for fname in sorted(os.listdir(NOTES_DIR)):
        if not fname.endswith(".md"):
            continue
        path = os.path.join(NOTES_DIR, fname)
        with open(path) as f:
            content = f.read()
        if content.startswith("---"):
            parts = content.split("---", 2)
            body = parts[2].strip() if len(parts) >= 3 else ""
        else:
            body = content.strip()
        if CAPTION_MARKER in body:
            continue
        text_without_images = re.sub(r"!\[.*?\]\(.*?\)", "", body).strip()
        text_without_links = re.sub(r"\[.*?\]\(.*?\)", "", text_without_images).strip()
        if not text_without_links and ("![image]" in body or "![" in body):
            if not text_without_images:
                image_refs = re.findall(r"!\[.*?\]\((.*?)\)", body)
                # Filter out PDFs - only process actual image files
                image_refs = [ref for ref in image_refs 
                             if os.path.splitext(ref)[1].lower() in IMAGE_EXTENSIONS]
                if image_refs:
                    results.append((fname, image_refs))
    return results


def resolve_image_path(ref: str) -> str | None:
    clean = ref.replace("../images/", "").replace("../images\\", "")
    for base in [IMAGES_DIR, NOTES_DIR]:
        candidate = os.path.join(base, clean)
        if os.path.exists(candidate):
            return candidate
    return None


def caption_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    resp = httpx.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": PROMPT,
                    "images": [img_b64],
                }
            ],
            "stream": False,
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["message"]["content"].strip()


def process_note(fname: str, image_refs: list[str], dry_run: bool = False) -> bool:
    path = os.path.join(NOTES_DIR, fname)
    with open(path) as f:
        content = f.read()

    fm_end = content.find("---", 3)
    if fm_end == -1:
        print(f"  skipping {fname}: no frontmatter end found")
        return False

    frontmatter = content[: fm_end + 3]
    body = content[fm_end + 3 :].strip()

    if dry_run:
        print(f"  [dry-run] would caption {fname} ({len(image_refs)} images)")
        return False

    image_blocks = re.split(r"(!\[[^\]]*\]\([^)]+\))", body)

    new_parts = []
    for part in image_blocks:
        # Skip PDF files - vision models don't support them
        if part.lower().endswith('.pdf)'):
            continue
        match = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", part)
        if match:
            img_ref = match.group(2)
            img_path = resolve_image_path(img_ref)
            if img_path:
                print(f"  captioning {os.path.basename(img_path)}...")
                caption = caption_image(img_path)
                print(f"  → {caption[:100]}{'...' if len(caption) > 100 else ''}")
                new_parts.append(f"{CAPTION_MARKER}: {caption}")
                new_parts.append("\n\n")
                new_parts.append(part)
                new_parts.append("\n\n")
            else:
                print(f"  WARNING: image not found: {img_ref}")
                new_parts.append(part)
                new_parts.append("\n\n")
        else:
            stripped = part.strip()
            if stripped:
                new_parts.append(stripped)
                new_parts.append("\n\n")

    new_body = "".join(new_parts).strip()
    new_content = frontmatter + "\n\n" + new_body + "\n"

    with open(path, "w") as f:
        f.write(new_content)

    return True


def main():
    parser = argparse.ArgumentParser(description="Caption image-only notes using Kimi k2.5")
    parser.add_argument("--force", action="store_true", help="Re-caption notes that already have AI captions")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be captioned without modifying files")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of notes to process")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between API calls in seconds")
    args = parser.parse_args()

    notes = find_image_only_notes()
    if not args.force and not args.dry_run:
        already = []
        for fname, refs in notes:
            path = os.path.join(NOTES_DIR, fname)
            with open(path) as f:
                content = f.read()
            if CAPTION_MARKER in content:
                already.append(fname)
        if already:
            print(f"Skipping {len(already)} notes with existing captions (use --force to re-caption)")

    print(f"Found {len(notes)} image-only notes to caption")

    if args.limit:
        notes = notes[: args.limit]

    success = 0
    failed = 0
    for i, (fname, image_refs) in enumerate(notes):
        print(f"[{i+1}/{len(notes)}] {fname} ({len(image_refs)} images)")
        try:
            if process_note(fname, image_refs, dry_run=args.dry_run):
                success += 1
            if not args.dry_run and args.delay and i < len(notes) - 1:
                time.sleep(args.delay)
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            if args.delay:
                time.sleep(args.delay)

    print(f"\nDone: {success} captioned, {failed} failed")


if __name__ == "__main__":
    main()