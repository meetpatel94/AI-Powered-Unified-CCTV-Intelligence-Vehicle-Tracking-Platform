"""In-process realtime event hub bridged to WebSocket clients.

The pipeline threads publish events (``detection``, ``anpr:hit``, ``track``,
``journey``) via :func:`publish`. Connected WebSocket clients each own an
asyncio queue and receive every event as ``{"event": ..., "payload": ...}`` —
the exact frame shape the existing frontend ``services/realtime.ts`` expects.

Publishing is thread-safe and non-blocking: it is called from the FFmpeg/AI
worker threads, marshalled onto the FastAPI event loop, and never blocks the
inference path (slow/full client queues simply drop the frame).
"""

from __future__ import annotations

import asyncio
from collections import deque
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class EventHub:
    def __init__(self, history: int = 200) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: set[asyncio.Queue] = set()
        self._recent: deque[dict[str, Any]] = deque(maxlen=history)
        self._lock = asyncio.Lock()

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def recent(self) -> list[dict[str, Any]]:
        return list(self._recent)

    def _deliver(self, frame: dict[str, Any]) -> None:
        self._recent.append(frame)
        dead: list[asyncio.Queue] = []
        for q in self._subscribers:
            try:
                q.put_nowait(frame)
            except asyncio.QueueFull:
                # Drop for slow consumers rather than blocking inference.
                pass
            except Exception:
                dead.append(q)
        for q in dead:
            self._subscribers.discard(q)

    def publish(self, event: str, payload: Any) -> None:
        """Thread-safe publish. Safe to call from worker threads."""
        frame = {"event": event, "payload": payload}
        loop = self._loop
        if loop is None or loop.is_closed():
            # No event loop yet (e.g. during startup) — still keep history.
            self._recent.append(frame)
            return
        try:
            loop.call_soon_threadsafe(self._deliver, frame)
        except RuntimeError:
            self._recent.append(frame)


hub = EventHub()


def publish(event: str, payload: Any) -> None:
    hub.publish(event, payload)
