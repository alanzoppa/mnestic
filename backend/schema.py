from __future__ import annotations

import glob
import logging
from typing import Any

import frontmatter

logger = logging.getLogger(__name__)

EXPECTED_FIELDS = [
    "title",
    "folder",
    "created",
    "modified",
    "source_id",
    "source",
    "tags",
    "participants",
    "source_url",
]


def _classify_field(name: str, cardinality: str) -> str:
    if name in ("created", "modified"):
        return "both"
    if cardinality == "low":
        return "metadata"
    return "embedded"


def discover_schema(notes_dir: str) -> dict:
    unique_values: dict[str, set[Any]] = {f: set() for f in EXPECTED_FIELDS}
    sample_values: dict[str, list[Any]] = {f: [] for f in EXPECTED_FIELDS}
    total_files = 0

    for path in glob.glob(f"{notes_dir}/**/*.md", recursive=True):
        try:
            fm = frontmatter.load(path)
            total_files += 1
            for field in EXPECTED_FIELDS:
                val = fm.get(field)
                if val is not None:
                    if isinstance(val, list):
                        for item in val:
                            unique_values[field].add(item)
                    else:
                        unique_values[field].add(val)
                    if len(sample_values[field]) < 3:
                        if isinstance(val, list):
                            sample_values[field].append(val[:3])
                        else:
                            sample_values[field].append(val)
        except Exception as e:
            logger.debug("Skipping unparseable note %s: %s", path, e)
            continue

    fields = []
    for name in EXPECTED_FIELDS:
        unique_count = len(unique_values[name])
        cardinality = "low" if unique_count < 50 else "high"
        samples = sample_values[name]
        fields.append(
            {
                "name": name,
                "type": "list" if samples and isinstance(samples[0], list) else "str",
                "cardinality": cardinality,
                "samples": samples,
                "classification": _classify_field(name, cardinality),
            }
        )

    sources = sorted(v for v in unique_values["source"] if isinstance(v, str))
    folders = sorted(v for v in unique_values["folder"] if isinstance(v, str))

    return {"total_files": total_files, "fields": fields, "sources": sources, "folders": folders}
