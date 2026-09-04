import { useEffect, useRef, useState } from 'react';

import { Loader2, RotateCw, VideoOff } from 'lucide-react';

import type { PlaybackKind } from '@/services/streams';

interface StreamPlayerProps {
  /** Stream kind resolved by `resolvePlaybackSource` (never sniffed here). */
  kind: PlaybackKind;
  /** Browser-compatible stream URL from the API (MJPEG/HLS). Null = no stream. */
  url: string | null;
  /** Accessible label for the feed. */
  title: string;
  /** When true, render a DEMO ribbon over the video (dev demo fixtures only). */
  demo?: boolean;
  className?: string;
  mediaClassName?: string;
  eager?: boolean;
}

/** Cap on automatic reconnect attempts before the manual-retry state. */
const MAX_AUTO_RETRIES = 4;
/** Longest backoff between automatic reconnect attempts (ms). */
const MAX_BACKOFF_MS = 15_000;

/**
 * Per-request hls.js retry policy: fail fast (2 quick retries) so a
 * genuinely unavailable camera surfaces the STREAM UNAVAILABLE state after
 * the (short) reconnect cycle instead of spinning on hls.js's very patient
 * library defaults. Reconnection across cycles is handled above.
 */
const HLS_RETRY = { maxNumRetry: 2, retryDelayMs: 500, maxRetryDelayMs: 2000 };
const HLS_LOAD_POLICY = {
  default: {
    maxTimeToFirstByteMs: 10_000,
    maxLoadTimeMs: 20_000,
    timeoutRetry: HLS_RETRY,
    errorRetry: HLS_RETRY,
  },
};

/**
 * Reusable browser stream player for Dashboard + Live View.
 *
 * Plays the backend-provided browser-compatible stream URL:
 * - `hls`: the backend's same-origin HLS proxy (which resolves server-side
 *   to the camera's real Sentinel `index.m3u8` playlist). Played natively
 *   on Safari; everywhere else (Chrome/Edge/Firefox) through `hls.js`.
 *   Handles loading, automatic reconnect with capped backoff on network
 *   errors, media-error recovery, an explicit stream-unavailable state with
 *   manual retry, and full teardown (hls.js destroy) when the tile
 *   unmounts or the source changes.
 * - `mjpeg`: multipart Motion-JPEG through an `<img>` (the FastAPI stream
 *   gateway's long-lived `/live` endpoint — moving video, no plugin needed).
 * - `none` (or a playback error): the existing NO STREAM empty state.
 *
 * Failures are isolated per tile: a stream error swaps only this player for
 * its fallback — it never throws, never blanks the page, and never affects
 * neighbouring tiles.
 */
export function StreamPlayer({
  kind,
  url,
  title,
  demo = false,
  className = '',
  mediaClassName = '',
  eager = false,
}: StreamPlayerProps) {
  // Failure latch keyed to the resolved source: a failure only sticks while
  // the same url/kind is being played (a new source starts fresh, without
  // needing a reset effect).
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sourceKey = `${kind}:${url}`;
  const failed = failedSource !== null && failedSource === sourceKey;
  const playable = !failed && url != null && kind !== 'none';

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {playable && kind === 'mjpeg' && (
        <MjpegImage
          key={`${url}-${attempt}`}
          url={url}
          title={title}
          mediaClassName={mediaClassName}
          eager={eager}
          onError={() => setFailedSource(sourceKey)}
        />
      )}
      {playable && kind === 'hls' && (
        <HlsVideo
          key={`${url}-${attempt}`}
          url={url}
          title={title}
          mediaClassName={mediaClassName}
        />
      )}
      {!playable && (
        <div className="grid h-full min-h-[110px] place-items-center bg-[#050914] text-center">
          <div>
            <VideoOff size={24} className="mx-auto mb-2 text-ink-faint" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink">No stream</div>
            <div className="mt-1 max-w-[150px] truncate text-[10px] text-ink-dim">{title}</div>
            {failed && (
              <button
                type="button"
                onClick={() => {
                  setFailedSource(null);
                  setAttempt((a) => a + 1);
                }}
                className="mt-2 inline-flex items-center gap-1 rounded-[3px] border border-edge px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-edge-strong hover:text-white"
              >
                <RotateCw size={9} strokeWidth={2.4} />
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      {demo && playable && (
        <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-[#f5b83d] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-black/85">
          Demo
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * MJPEG preview (stream gateway `/live` endpoint) via a long-lived <img>.
 * ------------------------------------------------------------------ */
function MjpegImage({
  url,
  title,
  mediaClassName,
  eager,
  onError,
}: {
  url: string;
  title: string;
  mediaClassName: string;
  eager: boolean;
  onError: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <img
        src={url}
        alt={title}
        className={`h-full w-full object-cover ${mediaClassName}`}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        onError={onError}
      />
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
            <Loader2 size={12} className="animate-spin" />
            Connecting
          </span>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * HLS playback: native <video> on Safari, hls.js everywhere else.
 * ------------------------------------------------------------------ */
type HlsPhase = 'connecting' | 'playing' | 'failed';

/** Type-only view of the hls.js default export (runtime import is dynamic). */
type HlsCtor = typeof import('hls.js')['default'];

function HlsVideo({
  url,
  title,
  mediaClassName,
}: {
  url: string;
  title: string;
  mediaClassName: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<HlsPhase>('connecting');
  const [reloadKey, setReloadKey] = useState(0);
  // Reconnect bookkeeping lives in refs so effect re-runs (source change,
  // manual retry) can reset it deliberately.
  const autoRetriesRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let hls: InstanceType<HlsCtor> | null = null;
    let retryTimer: number | undefined;
    autoRetriesRef.current = 0;
    setPhase('connecting');

    const clearRetryTimer = () => {
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };
    const fail = () => {
      if (!disposed) setPhase('failed');
    };
    /** Capped exponential backoff around a reconnect action. */
    const scheduleRetry = (reconnect: () => void) => {
      if (autoRetriesRef.current >= MAX_AUTO_RETRIES) {
        fail();
        return;
      }
      const delay = Math.min(1000 * 2 ** autoRetriesRef.current, MAX_BACKOFF_MS);
      autoRetriesRef.current += 1;
      retryTimer = window.setTimeout(reconnect, delay);
    };

    const onPlaying = () => {
      if (!disposed) setPhase('playing');
    };
    const onWaiting = () => {
      // Buffering mid-stream is a transient state, not a failure.
      if (!disposed) setPhase((p) => (p === 'failed' ? p : 'connecting'));
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);

    // Safari/iOS play HLS natively; every other engine needs hls.js.
    const nativeHls =
      video.canPlayType('application/vnd.apple.mpegurl') === 'probably' ||
      video.canPlayType('application/x-mpegURL') === 'probably';

    if (nativeHls) {
      video.src = url;
      const onVideoError = () => {
        if (disposed) return;
        scheduleRetry(() => {
          if (disposed) return;
          video.load();
          void video.play().catch(() => undefined);
        });
      };
      video.addEventListener('error', onVideoError);
      return () => {
        disposed = true;
        clearRetryTimer();
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('error', onVideoError);
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }

    let removeHlsErrorListener: (() => void) | null = null;
    import('hls.js')
      .then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) {
          // No MediaSource extensions (very old browser): honest failure.
          fail();
          return;
        }
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          manifestLoadPolicy: HLS_LOAD_POLICY,
          playlistLoadPolicy: HLS_LOAD_POLICY,
          fragLoadPolicy: HLS_LOAD_POLICY,
        });
        const onError = (_event: unknown, data: { fatal: boolean; type: unknown }) => {
          if (disposed || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Manifest/segment fetch failed (camera offline, proxy 502, …):
            // reconnect with backoff — the stream may come back. When the
            // manifest never parsed (no levels yet) startLoad() would be a
            // no-op, so the source is reloaded instead.
            scheduleRetry(() => {
              if (disposed || !hls) return;
              if (hls.levels && hls.levels.length > 0) {
                hls.startLoad();
              } else {
                hls.loadSource(url);
              }
            });
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // First media error: in-place recovery; repeated: rebuild.
            scheduleRetry(() => {
              if (disposed || !hls) return;
              hls.recoverMediaError();
            });
          } else {
            fail();
          }
        };
        hls.on(Hls.Events.ERROR, onError);
        removeHlsErrorListener = () => hls?.off(Hls.Events.ERROR, onError);
        hls.loadSource(url);
        hls.attachMedia(video);
      })
      .catch(() => fail());

    return () => {
      disposed = true;
      clearRetryTimer();
      removeHlsErrorListener?.();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      // Full teardown: stops network activity and frees MSE buffers.
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, reloadKey]);

  return (
    <>
      <video
        ref={videoRef}
        title={title}
        className={`h-full w-full object-cover ${mediaClassName}`}
        data-stream-url={url}
        muted
        autoPlay
        playsInline
      />
      {phase === 'connecting' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
            <Loader2 size={12} className="animate-spin" />
            Connecting
          </span>
        </div>
      )}
      {phase === 'failed' && (
        <div className="absolute inset-0 grid place-items-center bg-[#050914]/95 text-center">
          <div>
            <VideoOff size={22} className="mx-auto mb-1.5 text-accent-red/80" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink">
              Stream unavailable
            </div>
            <div className="mt-1 max-w-[170px] truncate text-[10px] text-ink-dim">{title}</div>
            <button
              type="button"
              onClick={() => {
                autoRetriesRef.current = 0;
                setReloadKey((k) => k + 1);
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-[3px] border border-edge px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-edge-strong hover:text-white"
            >
              <RotateCw size={9} strokeWidth={2.4} />
              Retry
            </button>
          </div>
        </div>
      )}
    </>
  );
}
