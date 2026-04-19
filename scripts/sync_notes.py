import argparse
import os
import re
import shutil
from datetime import datetime, timezone, timedelta

import frontmatter


APPLE_NOTES_FORMAT = "%A, %B %d, %Y at %I:%M:%S %p"
EVERNOTE_FORMAT = "%Y%m%dT%H%M%SZ"
TZ_CHICAGO = timezone(timedelta(hours=-5))


def parse_apple_notes_date(date_str):
    try:
        dt = datetime.strptime(date_str, APPLE_NOTES_FORMAT)
        dt = dt.replace(tzinfo=TZ_CHICAGO)
        return dt.isoformat()
    except ValueError:
        return None


def parse_evernote_date(date_str):
    try:
        dt = datetime.strptime(date_str, EVERNOTE_FORMAT)
        dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def normalize_date(date_str):
    if date_str is None:
        return None
    if " at " in date_str and date_str.endswith(("AM", "PM")):
        result = parse_apple_notes_date(date_str)
        if result:
            return result
    if re.match(r"^\d{8}T\d{6}Z$", date_str):
        result = parse_evernote_date(date_str)
        if result:
            return result
    return None


def normalize_image_references(content):
    content = re.sub(r'!\[image\]\(([^)]+)\)', r'![image](../images/\1)', content)
    content = re.sub(r'\[View original\]\(([^)]+)\)', r'[View original](../images/\1)', content)
    return content


def get_destination_path(dest_dir, filename):
    dest_path = os.path.join(dest_dir, filename)
    if not os.path.exists(dest_path):
        return dest_path

    base, ext = os.path.splitext(filename)
    counter = 2
    while True:
        new_filename = f"{base}__{counter}{ext}"
        dest_path = os.path.join(dest_dir, new_filename)
        if not os.path.exists(dest_path):
            return dest_path
        counter += 1


def process_md_file(src_path, dest_dir, force):
    filename = os.path.basename(src_path)
    dest_path = get_destination_path(dest_dir, filename)

    if not force and os.path.exists(dest_path):
        if os.path.getmtime(src_path) <= os.path.getmtime(dest_path):
            return "skipped"

    try:
        post = frontmatter.load(src_path)

        metadata = post.metadata
        if "created" in metadata:
            normalized = normalize_date(metadata["created"])
            if normalized:
                metadata["created"] = normalized
        if "modified" in metadata:
            normalized = normalize_date(metadata["modified"])
            if normalized:
                metadata["modified"] = normalized

        post.content = normalize_image_references(post.content)

        with open(dest_path, "wb") as f:
            frontmatter.dump(post, f, allow_unicode=True)

        shutil.copystat(src_path, dest_path)
        return "copied"

    except Exception as e:
        return f"errored: {e}"


def sync_notes(source, dest, force):
    notes_dest = os.path.join(dest, "notes")
    images_dest = os.path.join(dest, "images")

    os.makedirs(notes_dest, exist_ok=True)
    os.makedirs(images_dest, exist_ok=True)

    md_files = []
    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".pdf"}
    image_files = []

    SIDECAR_PATTERN = re.compile(r"_[0-9]{3}(_kimi)?\.md$")

    def is_sidecar(filename):
        return bool(SIDECAR_PATTERN.search(filename))

    for root, dirs, files in os.walk(source):
        for filename in files:
            filepath = os.path.join(root, filename)
            ext = os.path.splitext(filename)[1].lower()
            if ext in image_extensions:
                image_files.append(filepath)
            elif ext == ".md" and not is_sidecar(filename):
                md_files.append(filepath)

    copied = skipped = errored = 0

    for filepath in md_files:
        result = process_md_file(filepath, notes_dest, force)
        if result == "copied":
            copied += 1
        elif result == "skipped":
            skipped += 1
        else:
            errored += 1
            print(f"Error processing {filepath}: {result}")

    for filepath in image_files:
        filename = os.path.basename(filepath)
        dest_path = get_destination_path(images_dest, filename)

        if not force and os.path.exists(dest_path):
            if os.path.getmtime(filepath) <= os.path.getmtime(dest_path):
                skipped += 1
                continue

        try:
            shutil.copy2(filepath, dest_path)
            copied += 1
        except Exception as e:
            errored += 1
            print(f"Error copying image {filepath}: {e}")

    print(f"Results: {copied} copied, {skipped} skipped, {errored} errored")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="/Users/alanzoppa/Desktop/notes/Apple Notes")
    parser.add_argument("--dest", default="/Users/alanzoppa/Codes/notes-browser")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    sync_notes(args.source, args.dest, args.force)


if __name__ == "__main__":
    main()