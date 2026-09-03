"""Computer-vision building blocks for the Vehicle Intelligence Pipeline.

Each module degrades gracefully: a missing model, a failed OCR call or a bad
frame is logged and skipped, never crashing the stream worker.
"""
