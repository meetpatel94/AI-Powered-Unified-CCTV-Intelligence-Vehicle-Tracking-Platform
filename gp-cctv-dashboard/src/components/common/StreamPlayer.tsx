import { useEffect, useState } from 'react';

import { VideoOff } from 'lucide-react';

import type { PlaybackKind } from '@/services/streams';

interface StreamPlayerProps {
  /** Stream kind resolved by `resolvePlaybackSource` (never sniffed here). */
  kind: PlaybackKind;
  /** Browser-compatible stream URL from the API (MJPEG/HLS). Null = no stream. */
  url: string | null;
  /** Accessible label for the feed. */
  title: string;
  /** When true, render a DEMO ribbon over the video (demo playback feeds). */
  demo?: boolean;
  className?: string;
  mediaClassName?: string;
  eager?: boolean;
}

/**
 * Reusable browser stream player for Dashboard + Live View.
 *
 * Plays the backend-provided browser-compatible stream URL:
 * - `mjpeg`: multipart Motion-JPEG through an `<img>` (the FastAPI stream
 *   gateway's long-lived `/live` endpoint — moving video, no plugin needed).
 * - `hls`: native HLS through `<video>` (muted autoplay, inline) on browsers
 *   with native HLS support (Safari); other browsers fall back to the
 *   NO STREAM state instead of a broken player — no extra dependency.
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
  const [failed, setFailed] = useState(false);
  const playable = !failed && url != null && kind !== 'none';

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {playable && kind === 'mjpeg' && (
        <img
          src={url}
          alt={title}
          className={`h-full w-full object-cover ${mediaClassName}`}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
        />
      )}
      {playable && kind === 'hls' && (
        <NativeHlsVideo url={url} title={title} mediaClassName={mediaClassName} onError={() => setFailed(true)} />
      )}
      {!playable && (
        <div className="grid h-full min-h-[110px] place-items-center bg-[#050914] text-center">
          <div>
            <VideoOff size={24} className="mx-auto mb-2 text-ink-faint" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink">No stream</div>
            <div className="mt-1 max-w-[150px] truncate text-[10px] text-ink-dim">{title}</div>
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

/** Native-HLS `<video>` (no third-party player); errors degrade to NO STREAM. */
function NativeHlsVideo({
  url,
  title,
  mediaClassName,
  onError,
}: {
  url: string;
  title: string;
  mediaClassName: string;
  onError: () => void;
}) {
  // Browsers without native HLS (Chrome/Firefox report '' or 'maybe' for
  // mpegurl — only 'probably' genuinely plays) degrade to the NO STREAM
  // state via the parent's error path instead of a broken player.
  useEffect(() => {
    const probe = document.createElement('video');
    if (probe.canPlayType('application/vnd.apple.mpegurl') !== 'probably') {
      onError();
    }
    // Run once per mounted source; `onError` is a stable setState wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return (
    <video
      src={url}
      title={title}
      className={`h-full w-full object-cover ${mediaClassName}`}
      muted
      autoPlay
      playsInline
      disablePictureInPicture={false}
      onError={onError}
    />
  );
}
