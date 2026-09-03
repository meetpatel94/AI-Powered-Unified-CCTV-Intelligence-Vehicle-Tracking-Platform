"""Indian number-plate normalization and validation.

Indian civilian plates follow the "Bharat" / state series format::

    SS DD  L(L)  NNNN
    │  │   │     └── 1-4 digit unique number
    │  │   └──────── 1-2 letter series
    │  └──────────── 1-2 digit RTO district code
    └─────────────── 2 letter state code (e.g. GJ, MH, DL)

Examples: ``GJ01AB1234``, ``GJ1A1``, ``MH12DE1433``.

OCR output is noisy, so we:
  * upper-case and strip everything that is not ``[A-Z0-9]``,
  * repair the most common OCR confusions positionally (O↔0, I↔1, ...),
  * validate against the state-series regex,
  * return a canonical, space-free normalized plate for use as a join key.
"""

from __future__ import annotations

import re

# Valid Indian state / UT codes (plus BH for the Bharat series).
_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "BH", "CH", "CG", "DD", "DL", "DN", "GA",
    "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN",
    "ML", "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", "SK", "TN", "TS", "TR",
    "UP", "UK", "UA", "WB",
}

# State-series civilian format. Lenient on component widths to tolerate the
# many real-world variants while still rejecting obvious junk.
_PLATE_RE = re.compile(r"^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$")
_BHARAT_RE = re.compile(r"^\d{2}BH\d{4}[A-Z]{1,2}$")

# Position-aware OCR confusion maps.
_LETTER_TO_DIGIT = str.maketrans({"O": "0", "Q": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6", "D": "0"})
_DIGIT_TO_LETTER = str.maketrans({"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"})


def clean_ocr_text(text: str) -> str:
    """Uppercase and keep only ``[A-Z0-9]``."""
    if not text:
        return ""
    # Normalize common separators / OCR noise first.
    text = text.upper().replace("IND", "", 1) if text.upper().startswith("IND") else text.upper()
    return re.sub(r"[^A-Z0-9]", "", text)


def is_valid_indian_plate(plate: str) -> bool:
    if not plate or not (5 <= len(plate) <= 11):
        return False
    if _BHARAT_RE.match(plate):
        return True
    if not _PLATE_RE.match(plate):
        return False
    return plate[:2] in _STATE_CODES


def _repair_state_series(raw: str) -> str | None:
    """Best-effort positional repair of a state-series plate.

    Layout target: [AA][DD][L..][NNNN] — the tail is numeric, the head after
    the state code is numeric, the middle is alphabetic.
    """
    if len(raw) < 5:
        return None

    chars = list(raw)

    # Position 0-1: state letters (fix digits back to letters).
    for i in (0, 1):
        if chars[i].isdigit():
            chars[i] = chars[i].translate(_DIGIT_TO_LETTER)

    # Trailing block: the unique number is numeric — pull up to 4 trailing.
    j = len(chars) - 1
    tail_len = 0
    while j >= 2 and tail_len < 4 and (chars[j].isdigit() or chars[j] in "OQILZSBGD"):
        chars[j] = chars[j].translate(_LETTER_TO_DIGIT)
        j -= 1
        tail_len += 1
    if tail_len == 0:
        return None

    # District code right after the state code: 1-2 digits.
    k = 2
    dist_len = 0
    while k < len(chars) and dist_len < 2 and (chars[k].isdigit() or chars[k] in "OQILZSBGD"):
        chars[k] = chars[k].translate(_LETTER_TO_DIGIT)
        k += 1
        dist_len += 1
    if dist_len == 0:
        return None

    # Middle series letters: fix digits back to letters.
    for m in range(k, j + 1):
        if chars[m].isdigit():
            chars[m] = chars[m].translate(_DIGIT_TO_LETTER)

    return "".join(chars)


def normalize_plate(raw_text: str) -> tuple[str | None, bool]:
    """Return ``(normalized_plate, is_valid)``.

    ``normalized_plate`` is ``None`` only when the input has no alphanumerics.
    When the cleaned text already validates we return it as-is; otherwise we
    attempt a positional repair and validate again. ``is_valid`` tells the
    caller whether the result matches the Indian plate grammar.
    """
    cleaned = clean_ocr_text(raw_text)
    if not cleaned:
        return None, False

    if is_valid_indian_plate(cleaned):
        return cleaned, True

    repaired = _repair_state_series(cleaned)
    if repaired and is_valid_indian_plate(repaired):
        return repaired, True

    # Return the best cleaned candidate even if it fails validation, so callers
    # can decide whether to keep low-quality reads. Marked invalid.
    return cleaned, False
