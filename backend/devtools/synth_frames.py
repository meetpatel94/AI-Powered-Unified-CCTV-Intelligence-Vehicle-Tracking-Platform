"""DEVELOPMENT ONLY — synthetic imagery, NOT real CCTV footage.

Render synthetic CCTV frames with vehicles and Indian number plates. These are
computer-drawn test images used solely for offline pipeline verification; they
must never be presented as, or mistaken for, genuine camera evidence.

Used only by the local demo/RTSP server so the pipeline has realistic content
to detect and OCR without any real camera. Not used in production.
"""

from __future__ import annotations

import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None


def render_frame(width: int, height: int, t: float, plate: str, seed: int = 0) -> "np.ndarray":
    """Return a BGR frame with a moving 'vehicle' carrying ``plate``."""
    img = np.full((height, width, 3), (48, 32, 24), np.uint8)
    if cv2 is None:
        return img

    # Road band
    cv2.rectangle(img, (0, int(height * 0.5)), (width, height), (60, 60, 65), -1)
    for lx in range(0, width, 80):
        off = int((t * 120 + lx) % width)
        cv2.rectangle(img, (off, height - 30), (off + 40, height - 26), (200, 200, 200), -1)

    # Vehicle body — moves left→right, wraps around. Kept well inside the frame
    # so the plate is never clipped at the edges.
    bw, bh = 220, 130
    margin = 20
    span = width - bw - 2 * margin
    x = margin + int((t * 70 + seed * 137) % max(1, span))
    y = int(height * 0.42)
    color = [(200, 200, 210), (40, 40, 200), (60, 160, 60)][seed % 3]
    cv2.rectangle(img, (x, y), (x + bw, y + bh), color, -1)
    cv2.rectangle(img, (x + 22, y + 12), (x + bw - 22, y + 52), (30, 30, 30), -1)  # windshield
    cv2.circle(img, (x + 44, y + bh), 20, (20, 20, 20), -1)  # wheels
    cv2.circle(img, (x + bw - 44, y + bh), 20, (20, 20, 20), -1)

    # Number plate — large white background, black text, high contrast for OCR.
    pw, ph = 150, 40
    px = x + (bw - pw) // 2
    py = y + bh - ph - 8
    cv2.rectangle(img, (px, py), (px + pw, py + ph), (255, 255, 255), -1)
    cv2.rectangle(img, (px, py), (px + pw, py + ph), (0, 0, 0), 2)
    cv2.putText(
        img, plate, (px + 6, py + 28), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 0, 0), 2, cv2.LINE_AA
    )
    return img


def frame_with_boxes(width: int, height: int, t: float, plate: str, seed: int = 0):
    """Return ``(frame, [(cls_id, x1, y1, x2, y2)])`` for training-label export."""
    img = render_frame(width, height, t, plate, seed)
    bw, bh = 220, 130
    margin = 20
    span = width - bw - 2 * margin
    x = margin + int((t * 70 + seed * 137) % max(1, span))
    y = int(height * 0.42)
    # class 0 == "car" in our tiny synthetic dataset. Box includes wheels.
    return img, [(0, x, y, x + bw, y + bh + 20)]
