"""Deterministic plate normalization tests (no OCR/model required)."""

from __future__ import annotations

from app.vision.plate_utils import (
    clean_ocr_text,
    is_valid_indian_plate,
    normalize_plate,
)


def test_clean_ocr_text_strips_noise():
    assert clean_ocr_text(" GJ-01-AB-1234 ") == "GJ01AB1234"
    assert clean_ocr_text("g j 0 1 a b 1 2 3 4") == "GJ01AB1234"
    assert clean_ocr_text("IND GJ01AB1234") == "GJ01AB1234"
    assert clean_ocr_text("") == ""


def test_valid_indian_state_series():
    assert is_valid_indian_plate("GJ01AB1234")
    assert is_valid_indian_plate("MH12DE1433")
    assert is_valid_indian_plate("DL3CA1234")
    assert is_valid_indian_plate("GJ1A1")


def test_valid_bharat_series():
    assert is_valid_indian_plate("01BH1234AB")


def test_rejects_junk():
    assert not is_valid_indian_plate("HELLOWORLD")
    assert not is_valid_indian_plate("1234567890")
    assert not is_valid_indian_plate("AB123DEFGHIJKLMN")  # wrong structure
    assert not is_valid_indian_plate("")


def test_normalize_valid_plate_unchanged():
    plate, valid = normalize_plate("gj01ab1234")
    assert plate == "GJ01AB1234"
    assert valid is True


def test_normalize_repairs_common_ocr_confusions():
    # O→0 for digits, I→1, etc. — best-effort positional repair.
    plate, valid = normalize_plate("GJOIABI234")
    assert valid is True
    assert plate == "GJ01AB1234"


def test_normalize_uncertain_candidate_returns_no_invented_plate():
    # Obviously not a plate: we return the cleaned candidate marked invalid
    # (uncertain) instead of inventing characters or claiming a match.
    plate, valid = normalize_plate("!!###")
    assert plate is None
    assert valid is False

    plate, valid = normalize_plate("ABCDEF1234567")
    assert plate == "ABCDEF1234567"
    assert valid is False
