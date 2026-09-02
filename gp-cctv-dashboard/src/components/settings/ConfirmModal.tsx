import { AlertTriangle, LoaderCircle, ShieldAlert, X } from 'lucide-react';

export type ConfirmTone = 'danger' | 'warning' | 'primary' | 'neutral';

interface ConfirmModalProps {
  open: boolean;
  tone?: ConfirmTone;
  icon?: 'shield' | 'alert' | 'none';
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles: Record<ConfirmTone, { border: string; header: string; button: string }> = {
  danger: {
    border: 'border-accent-red/40',
    header: 'text-[#ff8b96]',
    button:
      'bg-gradient-to-r from-[#dc2626] to-[#991b1b] border border-[#ef4444]/60 shadow-[0_0_16px_-4px_rgba(239,68,68,0.8)] hover:brightness-110',
  },
  warning: {
    border: 'border-[#f59e0b]/40',
    header: 'text-[#f7b95f]',
    button:
      'bg-gradient-to-r from-[#d97706] to-[#b45309] border border-[#f59e0b]/60 shadow-[0_0_16px_-4px_rgba(245,158,11,0.7)] hover:brightness-110',
  },
  primary: {
    border: 'border-accent-blue/40',
    header: 'text-[#9fc7ff]',
    button:
      'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] border border-[#2f7dff]/60 shadow-[0_0_16px_-4px_rgba(47,125,255,0.8)] hover:brightness-110',
  },
  neutral: {
    border: 'border-edge',
    header: 'text-ink-dim',
    button: 'border border-edge bg-panel text-ink hover:border-edge-strong hover:text-white',
  },
};

/**
 * Confirmation dialog used by every destructive / irreversible control
 * (reset draft, clear cache, restart gateway, maintenance mode…).
 * Renders nothing when closed.
 */
export function ConfirmModal({
  open,
  tone = 'danger',
  icon = 'alert',
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel = 'Working…',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const styles = toneStyles[tone];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[#02040a]/82 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="presentation"
    >
      <div
        className={`panel w-full max-w-[440px] overflow-hidden border ${styles.border} animate-drawer-in`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-edge/70 bg-panel-head px-4 py-2.5">
          <span className={`flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.1em] ${styles.header}`}>
            {icon === 'shield' ? (
              <ShieldAlert size={15} />
            ) : icon === 'alert' ? (
              <AlertTriangle size={15} />
            ) : null}
            {title}
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-ink-faint transition-colors hover:text-white disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-4 py-3.5">
          <p className="text-[13px] leading-[18px] text-[#dbe5f4]">{message}</p>
          {detail ? (
            <p className="mt-2 rounded-[5px] border border-edge bg-[#0a1120] px-2.5 py-2 text-[11.5px] leading-[15px] text-ink-dim">
              {detail}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-edge/70 bg-panel-head px-4 py-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex h-[32px] items-center rounded-[5px] border border-edge bg-panel px-3.5 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`relative flex h-[32px] items-center gap-2 overflow-hidden rounded-[5px] px-4 text-[12.5px] font-semibold text-white transition-all disabled:cursor-wait disabled:opacity-80 ${styles.button}`}
          >
            {busy ? (
              <>
                <LoaderCircle size={14} className="animate-spin" />
                {busyLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
