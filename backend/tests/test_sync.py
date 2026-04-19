import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))
from sync_notes import parse_apple_notes_date, parse_evernote_date, normalize_date, normalize_image_references

import pytest
import re

SIDECAR_PATTERN = re.compile(r"_[0-9]{3}(_kimi)?\.md$")

def check_sidecar(filename):
    return bool(SIDECAR_PATTERN.search(filename))


class TestParseAppleNotesDate:
    def test_parse_apple_notes_date(self):
        result = parse_apple_notes_date("Monday, December 9, 2019 at 5:31:51 PM")
        assert result == "2019-12-09T17:31:51-05:00"

    def test_parse_apple_notes_date_invalid(self):
        result = parse_apple_notes_date("not a date")
        assert result is None


class TestParseEvernoteDate:
    def test_parse_evernote_date(self):
        result = parse_evernote_date("20170903T221744Z")
        assert result == "2017-09-03T22:17:44Z"

    def test_parse_evernote_date_invalid(self):
        result = parse_evernote_date("invalid")
        assert result is None


class TestNormalizeDate:
    def test_normalize_date_apple(self):
        result = normalize_date("Monday, December 9, 2019 at 5:31:51 PM")
        assert result == "2019-12-09T17:31:51-05:00"

    def test_normalize_date_evernote(self):
        result = normalize_date("20170903T221744Z")
        assert result == "2017-09-03T22:17:44Z"

    def test_normalize_date_none(self):
        result = normalize_date(None)
        assert result is None

    def test_normalize_date_passthrough(self):
        result = normalize_date("random string")
        assert result is None


class TestNormalizeImageReferences:
    def test_normalize_image_references_img(self):
        result = normalize_image_references("![image](photo.png)")
        assert result == "![image](../images/photo.png)"

    def test_normalize_image_references_view(self):
        result = normalize_image_references("[View original](photo.png)")
        assert result == "[View original](../images/photo.png)"

    def test_normalize_image_references_no_change(self):
        result = normalize_image_references("[link](https://example.com)")
        assert result == "[link](https://example.com)"


class TestIsSidecar:
    def test_is_sidecar_kimi(self):
        assert check_sidecar("photo_001_kimi.md") is True

    def test_is_sidecar_numbered(self):
        assert check_sidecar("photo_001.md") is True

    def test_is_sidecar_regular(self):
        assert check_sidecar("meeting_notes.md") is False

    def test_is_sidecar_regular_number(self):
        assert check_sidecar("note__2.md") is False
