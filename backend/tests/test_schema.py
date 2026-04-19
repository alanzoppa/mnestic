import os

import frontmatter
import pytest

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from schema import discover_schema, _classify_field, EXPECTED_FIELDS


def test_classify_field_created():
    assert _classify_field("created", "low") == "both"
    assert _classify_field("created", "high") == "both"


def test_classify_field_modified():
    assert _classify_field("modified", "low") == "both"
    assert _classify_field("modified", "high") == "both"


def test_classify_field_low_cardinality():
    assert _classify_field("folder", "low") == "metadata"


def test_classify_field_high_cardinality():
    assert _classify_field("title", "high") == "embedded"


def test_discover_schema(tmp_path):
    for i, name in enumerate(["Note1", "Note2"]):
        post = frontmatter.Post("test content")
        post.metadata = {
            "title": f"Test {i}",
            "folder": "Notes",
            "created": "2019-01-01",
            "modified": "2019-01-01",
            "source_id": f"test-{i}",
            "source": "Apple Notes",
            "tags": ["test"],
            "participants": ["Alice"],
        }
        note_path = tmp_path / f"{name}.md"
        frontmatter.dump(post, note_path)

    result = discover_schema(str(tmp_path))

    assert result["total_files"] == 2

    field_names = [f["name"] for f in result["fields"]]
    for expected in EXPECTED_FIELDS:
        assert expected in field_names

    tags_field = next(f for f in result["fields"] if f["name"] == "tags")
    assert tags_field["type"] in ("list", "str")

    source_field = next(f for f in result["fields"] if f["name"] == "source")
    assert source_field["type"] == "str"


def test_discover_schema_empty_dir(tmp_path):
    result = discover_schema(str(tmp_path))

    assert result["total_files"] == 0

    for field in result["fields"]:
        if field["name"] in ("tags", "participants"):
            assert field["samples"] == []
