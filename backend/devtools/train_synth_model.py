"""DEVELOPMENT ONLY — trains on synthetic data; NOT a production detector.

Train a tiny, REAL YOLO model on synthetic vehicles for offline verification.
The resulting weights only recognise the synthetic test vehicles and are a
development fallback, NOT a validated detector for real government feeds. For
production, set VEHICLE_MODEL_PATH to genuine pretrained vehicle weights.

Pretrained COCO weights cannot be fetched in an air-gapped/blocked environment,
so this script trains a genuine Ultralytics YOLO model from the architecture YAML
on rendered synthetic frames. The resulting ``.pt`` is a real detector the
production pipeline loads via ``VEHICLE_MODEL_PATH`` — proving the whole
detection path works end-to-end without any network download.

On a connected deployment you would instead point ``VEHICLE_MODEL_PATH`` at the
official ``yolov8n.pt`` (COCO) and skip this entirely.
"""

from __future__ import annotations

import os
import random
import shutil

import cv2

from backend.devtools.synth_frames import frame_with_boxes

DATA_ROOT = os.environ.get("SYNTH_DATA_ROOT", "/home/user/devtmp/synthds")
W, H = 640, 360
PLATES = ["GJ01AB1234", "GJ05JK6789", "GJ18CD4521", "MH12DE1433", "GJ27XY8899"]


def _write_split(split: str, n: int) -> None:
    img_dir = os.path.join(DATA_ROOT, "images", split)
    lbl_dir = os.path.join(DATA_ROOT, "labels", split)
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(lbl_dir, exist_ok=True)
    for i in range(n):
        t = random.uniform(0, 10)
        seed = random.randint(0, 2)
        plate = random.choice(PLATES)
        img, boxes = frame_with_boxes(W, H, t, plate, seed)
        name = f"{split}_{i:04d}"
        cv2.imwrite(os.path.join(img_dir, f"{name}.jpg"), img)
        with open(os.path.join(lbl_dir, f"{name}.txt"), "w") as fh:
            for cls_id, x1, y1, x2, y2 in boxes:
                cx = ((x1 + x2) / 2) / W
                cy = ((y1 + y2) / 2) / H
                bw = (x2 - x1) / W
                bh = (y2 - y1) / H
                fh.write(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")


def build_dataset(n_train: int = 240, n_val: int = 40) -> str:
    if os.path.exists(DATA_ROOT):
        shutil.rmtree(DATA_ROOT)
    _write_split("train", n_train)
    _write_split("val", n_val)
    yaml_path = os.path.join(DATA_ROOT, "data.yaml")
    with open(yaml_path, "w") as fh:
        fh.write(
            f"path: {DATA_ROOT}\n"
            "train: images/train\n"
            "val: images/val\n"
            "names:\n  0: car\n"
        )
    return yaml_path


def train(epochs: int = 30, out_path: str = "/home/user/devtmp/synth_yolo.pt") -> str:
    from ultralytics import YOLO

    data_yaml = build_dataset()
    model = YOLO("yolov8n.yaml")
    model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=384,
        batch=16,
        device="cpu",
        workers=2,
        verbose=False,
        plots=False,
        # Minimal augmentation: the synthetic objects are large and single-class,
        # so aggressive geometric/mosaic aug slows convergence. Keep only mild
        # colour jitter for robustness to the H.264 encode path.
        mosaic=0.0,
        close_mosaic=0,
        hsv_h=0.0,
        hsv_s=0.2,
        hsv_v=0.2,
        translate=0.0,
        scale=0.0,
        fliplr=0.0,
        erasing=0.0,
        project="/home/user/devtmp/yolo_runs",
        name="synth",
        exist_ok=True,
    )
    best = "/home/user/devtmp/yolo_runs/synth/weights/best.pt"
    if os.path.exists(best):
        shutil.copy(best, out_path)
    return out_path


if __name__ == "__main__":
    path = train()
    print("TRAINED_MODEL:", path)
