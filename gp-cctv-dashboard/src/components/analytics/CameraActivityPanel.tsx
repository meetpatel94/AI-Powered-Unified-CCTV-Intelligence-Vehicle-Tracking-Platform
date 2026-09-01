import { useNavigate } from 'react-router-dom';

import { formatIn } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { CameraActivityRow } from '@/types/analytics';

interface CameraActivityPanelProps {
  cameras: CameraActivityRow[];
  onSelectCamera: (code: string) => void;
}

const statusDot: Record<CameraActivityRow['status'], string> = {
  online: 'bg-accent-green',
  warning: 'bg-accent-orange',
  critical: 'bg-accent-red animate-pulse-dot',
  offline: 'bg-[#64748b]',
};

/** Ranked most-active cameras: ID, location, detection count. */
export function CameraActivityPanel({ cameras, onSelectCamera }: CameraActivityPanelProps) {
  const navigate = useNavigate();
  const max = Math.max(1, cameras[0]?.detections ?? 1);

  return (
    <Panel
      title="Camera Activity"
      action={<span className="tnum text-3xs text-ink-dim">most active · {cameras.length}</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col justify-between gap-px overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {cameras.length === 0 ? (
        <div className="grid h-full place-items-center text-[10px] text-ink-dim">No cameras in this filter.</div>
      ) : (
        cameras.map((camera, index) => (
          <div
            key={camera.id}
            className="group flex items-center gap-2 rounded-[5px] border border-transparent px-1.5 py-[4px] transition-colors hover:border-edge hover:bg-panel-hover"
          >
            <span className="tnum w-[14px] shrink-0 text-right text-[9px] font-bold text-[#6d82a3]">{index + 1}</span>
            <button
              type="button"
              title={`Filter to ${camera.code}`}
              onClick={() => onSelectCamera(camera.code)}
              className="tnum w-[46px] shrink-0 text-left text-[10.5px] font-bold text-[#9fc7ff] transition-colors hover:text-white"
            >
              {camera.code}
            </button>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[camera.status]}`} />
                <span className="truncate text-[10px] font-semibold text-[#dbe6f5]">{camera.location}</span>
                <span className="truncate text-[8px] text-[#6d7f9e]">· {camera.city}</span>
              </span>
              <span className="mt-[3px] block h-[4px] overflow-hidden rounded-full bg-[#14243c]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-cyan transition-all duration-500"
                  style={{ width: `${(camera.detections / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end leading-none">
              <span className="tnum text-[11px] font-bold text-white">{formatIn(camera.detections)}</span>
              <span className="tnum text-[7.5px] text-[#6d82a3]">{camera.events} AI</span>
            </span>
            <button
              type="button"
              title={`Open ${camera.code} on Live View`}
              onClick={() => navigate(`/live-view?camera=${camera.code}`)}
              className="hidden text-[8px] font-semibold uppercase tracking-wide text-accent-blue opacity-0 transition-opacity group-hover:opacity-100 xl:inline"
            >
              Live
            </button>
          </div>
        ))
      )}
    </Panel>
  );
}
