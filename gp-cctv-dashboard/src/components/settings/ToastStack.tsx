import { useEffect } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const toastStyle: Record<ToastKind, { border: string; icon: LucideIcon; iconCls: string; bar: string; title: string }> = {
  success: {
    border: 'border-accent-green/50',
    icon: CheckCircle2,
    iconCls: 'text-[#4ade80]',
    bar: 'bg-accent-green',
    title: 'text-[#b7f2cd]',
  },
  error: {
    border: 'border-accent-red/50',
    icon: CircleAlert,
    iconCls: 'text-[#f87171]',
    bar: 'bg-accent-red',
    title: 'text-[#ffb4bc]',
  },
  warning: {
    border: 'border-[#f59e0b]/50',
    icon: CircleAlert,
    iconCls: 'text-[#fbbf24]',
    bar: 'bg-accent-orange',
    title: 'text-[#fde2a6]',
  },
  info: {
    border: 'border-accent-cyan/40',
    icon: Info,
    iconCls: 'text-[#67e8f9]',
    bar: 'bg-accent-cyan',
    title: 'text-[#bfeefb]',
  },
};

/** Auto-dismissing notification stack (bottom-right, above all panels). */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const style = toastStyle[toast.kind];
  const Icon = style.icon;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 4200);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`toast-in pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-[6px] border bg-[#0a1324]/95 px-3 py-2.5 pr-8 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.9)] backdrop-blur ${style.border}`}
      role="status"
    >
      <span className={`absolute left-0 top-0 h-full w-[3px] ${style.bar}`} />
      <Icon size={16} className={`mt-px shrink-0 ${style.iconCls}`} strokeWidth={2.2} />
      <div className="min-w-0">
        <div className={`text-[12.5px] font-semibold leading-[16px] ${style.title}`}>{toast.title}</div>
        {toast.detail ? (
          <div className="mt-0.5 text-[11.5px] leading-[14.5px] text-ink-dim">{toast.detail}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="absolute right-2 top-2 text-ink-faint transition-colors hover:text-white"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  );
}
