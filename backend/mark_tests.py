#!/usr/bin/env python3
"""Bulk-add pytest markers to test files."""

import re
from pathlib import Path

ROOT = Path(__file__).parent / "tests"

UNIT_FILES = [
    "test_ingest.py",
    "test_embed.py",
    "test_config.py",
    "test_schema.py",
    "test_create.py",
    "test_sync.py",
]

INTEGRATION_FILES = {
    "test_store.py": "integration",
    "test_store_new.py": "integration",
    "test_graph.py": "integration",
    "test_graph_service.py": "integration",
    "test_watcher.py": "integration",
}

API_INTEGRATION_PATTERNS = re.compile(
    r"^def test_(get_|search_|create_|update_|delete_)"
)


def add_markers_to_file(path: Path, marker: str, skip_pattern=None):
    """
    Add @pytest.mark.<marker> before every top-level test function,
    unless skip_pattern matches the function name.
    """
    content = path.read_text()
    lines = content.splitlines()
    out = []
    added = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect top-level test function
        if re.match(r"^def test_", line):
            func_name = line.split("(")[0].replace("def ", "")
            if skip_pattern and skip_pattern.match(func_name):
                out.append(line)
                i += 1
                continue
            # Check if already marked
            prev_lines = [lines[j] for j in range(max(0, i - 3), i)]
            already_marked = any(
                f"@pytest.mark.{marker}" in l for l in prev_lines
            )
            if not already_marked:
                # Insert blank line if previous line is not blank and not a decorator
                if out and out[-1].strip() != "":
                    pass  # just insert without extra blank for now
                out.append(f"@pytest.mark.{marker}")
                added += 1
            out.append(line)
            i += 1
        else:
            out.append(line)
            i += 1

    path.write_text("\n".join(out) + ("\n" if out and out[-1] != "" else ""))
    return added


def main():
    total = 0
    for fname in UNIT_FILES:
        p = ROOT / fname
        n = add_markers_to_file(p, "unit")
        print(f"  +{n} unit  → {fname}")
        total += n

    for fname, marker in INTEGRATION_FILES.items():
        p = ROOT / fname
        n = add_markers_to_file(p, marker)
        print(f"  +{n} {marker} → {fname}")
        total += n

    # Special case: test_api.py — mark endpoint tests as integration
    p = ROOT / "test_api.py"
    n = add_markers_to_file(p, "integration", skip_pattern=None)
    # Actually we want to mark EVERY test in test_api.py as integration
    # because they all use TestClient + mocked store but hit real FastAPI app
    # Let me just mark all tests in test_api.py
    print(f"  +{n} integration → test_api.py")
    total += n

    print(f"\nTotal markers added: {total}")


if __name__ == "__main__":
    main()
