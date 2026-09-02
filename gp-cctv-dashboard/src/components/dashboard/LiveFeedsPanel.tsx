import { Camera, Maximize2, Scan, Video } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { liveFeeds } from '@/data/mockData';
import type { CameraFeed } from '@/types';

function FeedTile({ feed }: { feed: CameraFeed }) {
  const title = feed.city ? `${feed.code} | ${feed.location}, ${feed.city}` : `${feed.code} | ${feed.location}`;

  return (
    <figure className="group relative overflow-hidden rounded-[5px] border border-edge-soft bg-black">
      <img
        src={feed.thumbnail}
        alt={title}
        className="h-full w-full object-cover opacity-95 transition-transform duration-500 group-hover:scale-[1.03]"
        loading="lazy"
      />

      {/* top gradient + label */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/75 to-transparent px-1.5 pb-4 pt-1">
        <figcaption className="max-w-[82%] truncate text-[10px] font-medium text-white/95 drop-shadow">
          {title}
        </figcaption>
        <span className="flex items-center gap-1 rounded-[2px] bg-accent-green px-1 py-px text-[9.5px] font-bold uppercase tracking-wide text-black/85">
          <span className="h-1 w-1 rounded-full bg-black/70 animate-pulse-dot" />
          Live
        </span>
      </div>

      {/* scan sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
        <div className="h-6 w-full bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent animate-sweep" />
      </div>

      {/* bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-white/70">
        <div className="flex items-center gap-1.5">
          <Maximize2 size={9} strokeWidth={2.2} />
          <Scan size={9} strokeWidth={2.2} />
          <Video size={9} strokeWidth={2.2} />
        </div>
        <div className="flex items-center gap-1.5">
          <Camera size={9} strokeWidth={2.2} />
          <Scan size={9} strokeWidth={2.2} />
        </div>
      </div>
    </figure>
  );
}

/** 2 x 2 wall of live camera feeds (static thumbnails until the RTSP gateway is wired). */
export function LiveFeedsPanel() {
  return (
    <Panel
      title="Live CCTV Feeds"
      tools={
        <span className="flex items-center gap-1 text-3xs text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />4 of 12,842 streaming
        </span>
      }
      className="h-full"
      bodyClassName="grid grid-cols-2 grid-rows-2 gap-2 p-2 pt-1"
    >
      {liveFeeds.map((feed) => (
        <FeedTile key={feed.id} feed={feed} />
      ))}
    </Panel>
  );
}
