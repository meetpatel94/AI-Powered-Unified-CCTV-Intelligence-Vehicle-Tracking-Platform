import { ShieldAlert, Timer } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { toneInk } from '@/components/camerahealth/healthTones';

import type { CriticalCamera } from '@/types/cameraHealth';

/**
 * CRITICAL CAMERAS — feeds that need an operator right now: what is wrong,
 * how long it has been wrong, and the remediation action.
 */
export function CriticalCamerasPanel({
  items,
  busyId,
  onAct,
  onSelect,
  selectedId,
}: {
  items: CriticalCamera[];
  busyId: string | null;
  onAct: (item: CriticalCamera) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <Panel
      title="Critical Cameras"
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col"
      tools={
        <span className="tnum flex items-center gap-1 font-mono text-[9px]">
          <ShieldAlert size={10} className={items.length ? 'text-[#ff8b96]' : 'text-[#6fe0b0]'} />
          <span className={items.length ? 'text-[#ff8b96]' : 'text-[#6fe0b0]'}>
            {items.length} {items.length === 1 ? 'feed' : 'feeds'} need action
          </span>
        </span>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const color = toneInk[item.tone];
            const isSelected = item.cameraId === selectedId;
            const busy = busyId === item.cameraId;
            return (
              <li
                key={item.cameraId}
                className={`rounded-[5px] border px-2 py-1.5 transition-colors ${
                  isSelected ? 'border-edge-strong bg-panel-hover' : 'border-edge-soft hover:border-edge'
                }`}
                style={{ backgroundColor: isSelected ? undefined : `${color}0a` }}
              >
                <button type="button" onClick={() => onSelect(item.cameraId)} className="w-full text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse-dot" style={{ backgroundColor: color }} />
                    <span className="font-mono text-[10px] font-bold text-white">{item.cameraId}</span>
                    <span className="truncate text-[10px] text-[#c3cfe2]">{item.location}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[9px]" style={{ color }}>
                      <Timer size={9} />
                      {item.durationLabel}
                    </span>
                  </span>
                  <span className="mt-[2px] block truncate text-[9.5px] font-medium" style={{ color }}>
                    {item.issue}
                  </span>
                  <span className="mt-[1px] block truncate font-mono text-[8.5px] text-ink-faint">{item.detail}</span>
                </button>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAct(item)}
                    title={`${item.action} on ${item.cameraId}`}
                    className="flex h-[22px] flex-1 items-center justify-center gap-1 rounded-[4px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-2 text-[9.5px] font-semibold text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.85)] transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {busy ? 'Working…' : item.action}
                  </button>
                  <span className="tnum shrink-0 font-mono text-[8.5px] text-ink-faint">{item.camera.city}</span>
                </div>
              </li>
            );
          })}

          {items.length === 0 ? (
            <li className="rounded-[5px] border border-accent-green/30 bg-[#08180f] px-2 py-3 text-center">
              <p className="text-[10px] font-medium text-[#6fe0b0]">All monitored feeds nominal</p>
              <p className="mt-[2px] text-[9px] text-ink-faint">No camera is past a critical threshold right now.</p>
            </li>
          ) : null}
        </ul>
      </div>
    </Panel>
  );
}
