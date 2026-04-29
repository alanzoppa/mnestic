#!/usr/bin/env python3
"""Recover lost Evernote content from ENEX exports for notes tagged 'lost-content'."""
from __future__ import annotations

import os
import re
import sys
import xml.etree.ElementTree as ET

import frontmatter

ENEX_DIR = os.path.expanduser("~/Downloads/Evernote")
NOTES_DIR = "notes"


def find_enex_files(enex_dir: str) -> list[str]:
    paths = []
    for root, _, files in os.walk(enex_dir):
        for f in files:
            if f.endswith(".enex"):
                paths.append(os.path.join(root, f))
    return sorted(paths)


def strip_html(html_text: str) -> str:
    text = re.sub(r"(?i)<br\s*/?>", "\n", html_text)
    text = re.sub(r"(?i)</?(div|p|li|tr)[^>]*>", "\n", text)
    text = re.sub(r"(?i)</?span[^>]*>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text_from_enml(enml: str) -> str:
    enml_clean = enml.strip()
    if not enml_clean:
        return ""
    enml_clean = re.sub(r"<\?xml[^?]*\?>", "", enml_clean)
    enml_clean = re.sub(r"<!DOCTYPE[^>]*>", "", enml_clean, flags=re.IGNORECASE)
    enml_clean = re.sub(r'\s*SYSTEM\s*["\'][^"\']+["\']', "", enml_clean)
    try:
        root = ET.fromstring(enml_clean)
    except ET.ParseError:
        return strip_html(enml)

    text_parts: list[str] = []

    def iter_text(elem: ET.Element) -> None:
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        if tag in ("en-crypt", "en-todo"):
            return
        if tag in ("div", "p", "li", "br"):
            text_parts.append("\n")
        if elem.text and elem.text.strip():
            text_parts.append(elem.text.strip())
        for child in elem:
            iter_text(child)
            if child.tail and child.tail.strip():
                text_parts.append(child.tail.strip())
        if tag in ("div", "p", "li"):
            text_parts.append("\n")

    iter_text(root)
    result = " ".join(text_parts)
    result = re.sub(r" *\n *", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip() or strip_html(enml)


def parse_enex(path: str) -> dict[str, str]:
    titles_to_content: dict[str, str] = {}
    tree = ET.parse(path)
    root = tree.getroot()
    notes = root.findall(".//note")
    for note in notes:
        title_elem = note.find("title")
        content_elem = note.find("content")
        title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""
        if not title or content_elem is None:
            continue
        raw = content_elem.text or ""
        if not raw.strip():
            continue
        plaintext = extract_text_from_enml(raw)
        if plaintext:
            titles_to_content[title] = plaintext
    return titles_to_content


def find_lost_content_notes(notes_dir: str) -> list[dict]:
    lost = []
    for f in os.listdir(notes_dir):
        if not f.endswith(".md"):
            continue
        filepath = os.path.join(notes_dir, f)
        try:
            post = frontmatter.load(filepath)
            tags = post.get("tags", [])
            if isinstance(tags, str):
                tags = [tags]
            if "lost-content" in tags:
                lost.append({
                    "file": f,
                    "path": filepath,
                    "title": post.get("title", "").strip(),
                    "source_id": post.get("source_id", ""),
                })
        except Exception as e:
            print(f"  Warning: could not parse {f}: {e}", file=sys.stderr)
    return lost


def main():
    print("Phase 4: Recovering lost Evernote content from ENEX files")
    print("=" * 60)

    enex_files = find_enex_files(ENEX_DIR)
    print(f"Found {len(enex_files)} ENEX files")

    print("Parsing ENEX files...")
    enex_index: dict[str, str] = {}
    for ef in enex_files:
        try:
            tc = parse_enex(ef)
            enex_index.update(tc)
            print(f"  {os.path.basename(ef)}: {len(tc)} notes indexed")
        except Exception as e:
            print(f"  Warning: failed to parse {os.path.basename(ef)}: {e}", file=sys.stderr)
    print(f"Total indexed: {len(enex_index)} notes from ENEX files")

    lost_notes = find_lost_content_notes(NOTES_DIR)
    print(f"Found {len(lost_notes)} notes tagged 'lost-content'")

    recovered = 0
    missing = 0

    for note in lost_notes:
        title = note["title"]
        match = None
        if title in enex_index:
            match = enex_index[title]
        else:
            for k, v in enex_index.items():
                if k.lower().strip() == title.lower().strip():
                    match = v
                    break
        if match:
            post = frontmatter.load(note["path"])
            post.content = match
            tags = post.get("tags", [])
            if isinstance(tags, str):
                tags = [tags]
            new_tags = [t for t in tags if t != "lost-content"]
            if "recovered" not in new_tags:
                new_tags.append("recovered")
            post.metadata["tags"] = new_tags
            with open(note["path"], "wb") as f:
                frontmatter.dump(post, f, allow_unicode=True)
            recovered += 1
            print(f"  RECOVERED: {title[:70]}")
        else:
            missing += 1
            print(f"  MISSING:   {title[:70]}")

    print()
    print(f"Summary: {recovered} recovered, {missing} missing, {len(lost_notes)} total")


if __name__ == "__main__":
    main()