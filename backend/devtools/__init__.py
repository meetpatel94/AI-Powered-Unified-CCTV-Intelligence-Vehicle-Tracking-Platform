"""Developer tooling for local, offline end-to-end verification.

Nothing in this package is imported by the production application. It exists so
the full pipeline can be exercised without the real Gujarat Police Sentinel
network or physical cameras:

* ``synth_frames``  – render synthetic vehicle + Indian-plate frames.
* ``rtsp_server``   – a minimal real RTSP/RTP (TCP-interleaved, H.264) server.
* ``mock_sentinel`` – a stand-in Sentinel ``/api/ingest`` catalogue.
* ``run_demo``      – wires them together and drives the whole flow.

Point ``SENTINEL_BASE_URL`` at the mock catalogue and the app consumes the
synthetic cameras exactly as it would consume real ones — no camera URL is
hard-coded anywhere in the application.
"""
