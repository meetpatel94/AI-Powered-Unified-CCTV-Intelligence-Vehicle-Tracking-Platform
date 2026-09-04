import { Camera, Maximize2, Scan, Video, VideoOff } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { StreamPlayer } from '@/components/common/StreamPlayer';
import { useGatewayLiveCameras } from '@/hooks/useGatewayLiveCameras';
import { useTelemetryTick } from '@/hooks/useTelemetryTick';
import type { LiveCamera } from '@/types/liveView';

function FeedTile({ feed }: { feed: LiveCamera }) {
  const title = feed.city ? `${feed.id} | ${feed.location}, ${feed.city}` : `${feed.id} | ${feed.location}`;
  // Playable = gateway-live stream OR backend demo playback feed (DEMO badge).
  // The stream URL itself always comes from the API via useGatewayLiveCameras.
  const online = feed.status === 'online' && !!feed.liveFrameUrl;
  const playable = !!feed.liveFrameUrl && (online || feed.isDemoPlayback === true);

  return (
    <figure className="group relative grid min-h-[110px] overflow-hidden rounded-[5px] border border-edge-soft bg-black">
      {playable ? (
        <StreamPlayer
          kind="mjpeg"
          url={feed.liveFrameUrl ?? null}
          title={title}
          demo={feed.isDemoPlayback === true}
          mediaClassName="opacity-95 transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="grid h-full min-h-[110px] place-items-center bg-[#050914] text-center">
          <div>
            <VideoOff size={24} className="mx-auto mb-2 text-ink-faint" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink">No stream</div>
            <div className="mt-1 max-w-[150px] truncate text-[10px] text-ink-dim">{title}</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/75 to-transparent px-1.5 pb-4 pt-1">
        <figcaption className="max-w-[82%] truncate text-[10px] font-medium text-white/95 drop-shadow">
          {title}
        </figcaption>
        <span className={`flex items-center gap-1 rounded-[2px] px-1 py-px text-[9.5px] font-bold uppercase tracking-wide ${playable ? 'bg-accent-green text-black/85' : 'bg-slate-600 text-white/85'}`}>
          <span className={`h-1 w-1 rounded-full ${playable ? 'bg-black/70 animate-pulse-dot' : 'bg-white/70'}`} />
          {feed.isDemoPlayback && playable ? 'Demo' : playable ? 'Live' : feed.status === 'reconnecting' ? 'Connecting' : 'Offline'}
        </span>
      </div>

      {playable && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
          <div className="h-6 w-full bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent animate-sweep" />
        </div>
      )}

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

/** 2 x 2 wall of backend camera feeds. Empty registries render an honest empty state. */
export function LiveFeedsPanel() {
  const tick = useTelemetryTick(4000);
  const { cameras, health, gatewayOnline, demoActive } = useGatewayLiveCameras(tick);
  const visible = cameras.slice(0, 4);
  const total = cameras.length;
  const live = health.liveCount;

  return (
    <Panel
      title="Live CCTV Feeds"
      tools={
        <span className="flex items-center gap-1 text-3xs text-ink-dim">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-accent-green animate-pulse-dot' : gatewayOnline ? 'bg-accent-orange' : 'bg-slate-500'}`} />
          {demoActive ? 'demo mode' : `${live} of ${total} streaming`}
        </span>
      }
      className="h-full"
      bodyClassName="grid grid-cols-2 grid-rows-2 gap-2 p-2 pt-1"
    >
      {visible.length ? (
        visible.map((feed) => <FeedTile key={feed.id} feed={feed} />)
      ) : (
        <div className="col-span-2 row-span-2 grid min-h-[240px] place-items-center rounded-[5px] border border-dashed border-edge bg-[#071120] px-6 text-center">
          <div>
            <VideoOff size={30} className="mx-auto mb-3 text-ink-faint" />
            <div className="text-[14px] font-semibold text-white">No cameras currently connected</div>
            <div className="mt-1 text-[12px] text-ink-dim">The backend camera registry and stream gateway returned zero live feeds.</div>
          </div>
        </div>
      )}
    </Panel>
  );
}
