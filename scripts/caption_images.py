#!/usr/bin/env python3
"""
Caption image-only notes using Kimi k2.5:cloud vision model.

This script scans markdown notes that contain only image references (no text content),
sends each image to Ollama Cloud's kimi-k2.5:cloud model for description generation,
and prepends the generated caption to the note body.

The script handles:
    - PDF filtering (vision models don't support PDFs)
    - Image resizing for large files (>5MB)
    - Timeout retries (up to 5 minutes per image)
    - Multi-image notes (per-image captions)
"""
import base64
import os
import re
import sys
import time

import httpx

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

import typer

app = typer.Typer(help="Caption image-only notes using Kimi k2.5:cloud vision model")

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


def resize_image_if_needed(image_path: str, max_size_mb: float = 5.0) -> bytes:
    import io
    from PIL import Image

    file_size = os.path.getsize(image_path)
    max_bytes = max_size_mb * 1024 * 1024

    if file_size <= max_bytes:
        with open(image_path, "rb") as f:
            return f.read()

    img = Image.open(image_path)
    scale = 0.7
    while True:
        new_width = int(img.width * scale)
        new_height = int(img.height * scale)
        img_resized = img.resize((new_width, new_height), Image.LANCZOS)

        buf = io.BytesIO()
        if img.mode in ('RGBA', 'LA', 'P'):
            img_resized = img_resized.convert('RGB')
        img_resized.save(buf, format='JPEG', quality=85)
        img_bytes = buf.getvalue()

        if len(img_bytes) <= max_bytes or scale < 0.3:
            return img_bytes
        scale *= 0.7


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=15),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
def caption_image(image_path: str) -> str:
    img_bytes = resize_image_if_needed(image_path)
    img_b64 = base64.b64encode(img_bytes).decode()
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
        timeout=300,
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

    frontmatter_text = content[: fm_end + 3]
    body = content[fm_end + 3 :].strip()

    if dry_run:
        print(f"  [dry-run] would caption {fname} ({len(image_refs)} images)")
        return False

    image_blocks = re.split(r"(!\[[^\]]*\]\([^)]+\))", body)

    new_parts = []
    for part in image_blocks:
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
    new_content = frontmatter_text + "\n\n" + new_body + "\n"

    with open(path, "w") as f:
        f.write(new_content)

    return True


@app.command()
def main(
    force: bool = typer.Option(False, "--force", help="Re-caption notes that already have AI captions"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be captioned without modifying files"),
    limit: int = typer.Option(0, "--limit", help="Limit number of notes to process"),
    delay: float = typer.Option(1.0, "--delay", help="Delay between API calls in seconds"),
):
    notes = find_image_only_notes()
    if not force and not dry_run:
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

    if limit:
        notes = notes[:limit]

    success = 0
    failed = 0
    for i, (fname, image_refs) in enumerate(notes):
        print(f"[{i+1}/{len(notes)}] {fname} ({len(image_refs)} images)")
        try:
            if process_note(fname, image_refs, dry_run=dry_run):
                success += 1
            if not dry_run and delay and i < len(notes) - 1:
                time.sleep(delay)
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            if delay:
                time.sleep(delay)

    print(f"\nDone: {success} captioned, {failed} failed")


if __name__ == "__main__":
    app()