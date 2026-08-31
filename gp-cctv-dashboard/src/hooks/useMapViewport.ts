import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Framing target: the Ahmedabad–Gandhinagar metro belt. The map fills the
 * viewport by satisfying whichever of these spans is more constraining, so the
 * canvas never shows empty gutters on wide command-center displays.
 */
const FRAME = { cx: 852, cy: 470, spanW: 1580, spanH: 726 };

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 6;

/**
 * Pan / zoom viewport for the GIS canvas.
 *
 * Keeps a single {scale, tx, ty} transform and exposes `project()` so markers,
 * routes and popups can be laid out in screen space. When real tiles arrive,
 * only `project()` has to become a Web-Mercator transform.
 */
export function useMapViewport() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const fitted = useRef(false);
  const panOrigin = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const computeFit = (w: number, h: number) => {
    const scale = Math.min(w / FRAME.spanW, h / FRAME.spanH);
    return { scale, tx: w / 2 - FRAME.cx * scale, ty: h / 2 - FRAME.cy * scale };
  };

  const fitScale = size.w && size.h ? Math.min(size.w / FRAME.spanW, size.h / FRAME.spanH) : 1;

  const fit = useCallback(
    (w = size.w, h = size.h) => {
      if (!w || !h) return;
      setView(computeFit(w, h));
    },
    [size.w, size.h],
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
      if (!fitted.current && width && height) {
        fitted.current = true;
        setView(computeFit(width, height));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((prev) => {
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale * factor));
      const ratio = nextScale / prev.scale;
      const px = cx ?? 0;
      const py = cy ?? 0;
      return {
        scale: nextScale,
        tx: px - (px - prev.tx) * ratio,
        ty: py - (py - prev.ty) * ratio,
      };
    });
  }, []);

  const zoomIn = useCallback(() => zoomAt(1.35, size.w / 2, size.h / 2), [zoomAt, size.w, size.h]);
  const zoomOut = useCallback(() => zoomAt(1 / 1.35, size.w / 2, size.h / 2), [zoomAt, size.w, size.h]);

  /** Centre the view on a world coordinate, optionally changing zoom. */
  const centerOn = useCallback(
    (wx: number, wy: number, targetScale?: number) => {
      setView((prev) => {
        const scale = targetScale ?? prev.scale;
        return { scale, tx: size.w / 2 - wx * scale, ty: size.h / 2 - wy * scale };
      });
    },
    [size.w, size.h],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    panOrigin.current = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty };
    setIsPanning(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const origin = panOrigin.current;
    if (!origin) return;
    setView((prev) => ({
      ...prev,
      tx: origin.tx + (event.clientX - origin.x),
      ty: origin.ty + (event.clientY - origin.y),
    }));
  };

  const endPan = () => {
    panOrigin.current = null;
    setIsPanning(false);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(event.deltaY < 0 ? 1.14 : 1 / 1.14, event.clientX - rect.left, event.clientY - rect.top);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const project = useCallback(
    (wx: number, wy: number) => ({ x: wx * view.scale + view.tx, y: wy * view.scale + view.ty }),
    [view],
  );

  /** Zoom level relative to the "fit" scale — drives clustering thresholds. */
  const zoomLevel = fitScale ? view.scale / fitScale : 1;

  return {
    containerRef,
    size,
    view,
    zoomLevel,
    isPanning,
    project,
    zoomIn,
    zoomOut,
    zoomAt,
    centerOn,
    fit,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPan,
      onPointerLeave: endPan,
      onPointerCancel: endPan,
    },
  };
}
