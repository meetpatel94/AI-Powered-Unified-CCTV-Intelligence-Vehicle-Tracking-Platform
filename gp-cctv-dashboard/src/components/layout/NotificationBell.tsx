import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Loader2, WifiOff } from 'lucide-react';

import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const SEVERITY_STYLES: Record<AppNotification['severity'], { dot: string; text: string }> = {
  critical: { dot: 'bg-accent-red', text: 'text-[#f87171]' },
  high: { dot: 'bg-accent-orange', text: 'text-[#fbbf24]' },
  medium: { dot: 'bg-accent-yellow', text: 'text-[#facc15]' },
  info: { dot: 'bg-accent-cyan', text: 'text-[#67e8f9]' },
};

/**
 * Live alert bell. Shows the real/current alert count, opens a compact panel
 * of recent alerts from the existing alert API/WebSocket flow, lets the
 * operator open the related alert, and updates as new `alert:new` /
 * `alert:update` events arrive. Handles loading, empty and offline states.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { items, count, loading, error, live } = useNotifications();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openAlert = (id: string) => {
    setOpen(false);
    navigate(`/alerts?alert=${encodeURIComponent(id)}`);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications (${count})`}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
      >
        <Bell size={18} strokeWidth={1.8} />
        {count > 0 ? (
          <span className="tnum absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent-red px-1 text-[11.5px] font-bold text-white shadow-[0_0_8px_-1px_rgba(239,68,68,0.9)]">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-fade-in absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-md border border-edge bg-[#0b1222] shadow-panel">
          <div className="flex items-center justify-between border-b border-edge px-3.5 py-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#dbe5f4]">
              Live Alerts
            </span>
            <span className="flex items-center gap-1.5">
              {!live && error ? (
                <span className="flex items-center gap-1 text-[10.5px] text-ink-faint">
                  <WifiOff size={11} /> offline
                </span>
              ) : live ? (
                <span className="relative h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-accent-green" />
                  <span className="healthy-ping absolute inset-0 rounded-full text-accent-green" />
                </span>
              ) : null}
              <span className="tnum text-[11.5px] text-ink-dim">{count} open</span>
            </span>
          </div>

          <div className="max-h-[340px] overflow-y-auto scroll-thin">
            {loading && items.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-[12.5px] text-ink-dim">
                <Loader2 size={14} className="animate-spin text-accent-blue" />
                Loading alerts…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12.5px] text-ink-dim">
                No open alerts.
                <span className="mt-1 block text-[11.5px] text-ink-faint">All clear for the current window.</span>
              </div>
            ) : (
              items.map((item) => {
                const sev = SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.info;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openAlert(item.id)}
                    className="group flex w-full items-start gap-2.5 border-b border-edge-soft/60 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-panel-hover"
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sev.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[12.5px] font-semibold text-ink">{item.title}</span>
                        <span className={`tnum shrink-0 text-[11px] font-medium ${sev.text}`}>{item.subject}</span>
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-dim">
                        {item.camera} · {item.location}
                      </span>
                      <span className="block text-[10.5px] text-ink-faint">{item.ago}</span>
                    </span>
                    <ChevronRight
                      size={14}
                      className="mt-1.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/alerts');
            }}
            className="flex w-full items-center justify-center gap-1 border-t border-edge px-3.5 py-2.5 text-[12px] font-medium text-accent-blue transition-colors hover:bg-panel-hover"
          >
            View all alerts
          </button>
        </div>
      ) : null}
    </div>
  );
}
