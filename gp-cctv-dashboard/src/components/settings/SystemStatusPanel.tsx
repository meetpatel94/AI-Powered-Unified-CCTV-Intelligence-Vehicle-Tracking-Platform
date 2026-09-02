import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Globe2,
} from 'lucide-react';

import { DEPLOYMENT_META, RUNTIME_STATUS } from '@/data/settingsData';

import type { SystemState } from '@/types';

const stateTone: Record<SystemState, { chip: string; dot: string; ring: string; text: string }> = {
  operational: {
    chip: 'border-accent-green/35 bg-[#081c14]',
    dot: 'bg-accent-green text-[#4ade80]',
    ring: 'text-[#86efac]',
    text: 'text-[#86efac]',
  },
  good: {
    chip: 'border-accent-cyan/30 bg-[#071c26]',
    dot: 'bg-accent-cyan text-[#67e8f9]',
    ring: 'text-[#a5f3fc]',
    text: 'text-[#a5f3fc]',
  },
  degraded: {
    chip: 'border-[#f59e0b]/35 bg-[#231a08]',
    dot: 'bg-accent-orange text-[#fbbf24]',
    ring: 'text-[#fde2a6]',
    text: 'text-[#fde2a6]',
  },
  down: {
    chip: 'border-accent-red/35 bg-[#26090e]',
    dot: 'bg-accent-red text-[#f87171]',
    ring: 'text-[#ffb4bc]',
    text: 'text-[#ffb4bc]',
  },
};

/**
 * Right-hand SYSTEM STATUS rail: subsystem health readouts with drifting
 * latency / session numbers, plus the deployment identity card.
 */
export function SystemStatusPanel() {
  return (
    <div className="flex flex-col gap-[var(--page-gap)] self-start xl:sticky xl:top-0">
      <SystemHealthCard />
      <DeploymentCard />
    </div>
  );
}

function SystemHealthCard() {
  const [tick, setTick] = useState(0);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
      // WebSocket briefly flaps every ~20 ticks to exercise the state style.
      setConnected((prev) => (tick > 0 && tick % 21 === 0 ? !prev : prev));
    }, 2400);
    return () => window.clearInterval(timer);
  }, [tick]);

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-edge/80 bg-[#0a111f] px-3.5 py-2.5">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#c7d4e8]">
          <span className="relative grid place-items-center text-accent-green">
            <Activity size={13} strokeWidth={2.4} />
            <span className="healthy-ping absolute inline-flex h-3 w-3 opacity-60" />
          </span>
          System Status
        </h2>
        <span className="text-3xs uppercase tracking-wider text-ink-faint">Live</span>
      </header>

      <ul className="space-y-1.5 px-2.5 py-2.5">
        {RUNTIME_STATUS.map((item) => {
          const tone = stateTone[item.state];
          const live = runtimeReadout(item.id, tick);
          return (
            <li
              key={item.id}
              className={`rounded-[6px] border px-2.5 py-2 ${tone.chip}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <item.icon size={13} strokeWidth={2} className={`shrink-0 ${tone.dot}`} />
                  <span className="truncate text-[12.5px] font-semibold text-[#dbe5f4]">
                    {item.label}
                  </span>
                </span>
                <span className={`flex shrink-0 items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.text}`}>
                  <span className={`relative flex h-[6px] w-[6px] rounded-full ${tone.dot.split(' ')[0]}`}>
                    <span className="healthy-ping absolute inset-0 rounded-full opacity-70" />
                  </span>
                  {item.state === 'good' && item.id === 'ws' && !connected ? 'Retrying' : item.badge}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 pl-[22px]">
                <span className="truncate text-[10.5px] text-ink-faint">{item.sublabel}</span>
                <span className="tnum shrink-0 text-[10.5px] font-medium text-ink-dim">{live}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between border-t border-edge/70 bg-[#0a111f] px-3 py-2 text-3xs text-ink-faint">
        <span>Heartbeat every 2.4 s</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={10} className="text-accent-green" />
          Gateway time sync OK
        </span>
      </footer>
    </section>
  );
}

/** Deterministic telemetry drift per subsystem (replaces live WS frames). */
function runtimeReadout(id: string, tick: number): string {
  const seeded = (offset: number) => ((tick * 7 + offset * 13) % 100) / 100;
  switch (id) {
    case 'ai':
      return `${3} models · ${Math.round(28 + seeded(1) * 9)} ms`;
    case 'gateway':
      return `${Math.round(1198 + seeded(2) * 26)} sessions`;
    case 'database':
      return `${Math.round(3 + seeded(3) * 3)} ms · 1.2 M ops/min`;
    case 'storage':
      return `${Math.round(73.2 + seeded(4) * 1.6).toFixed(1)}% used · 41 TB free`;
    case 'network':
      return `${(6.6 + seeded(5) * 0.5).toFixed(1)} Gbps · ${Math.round(11 + seeded(6) * 4)} ms`;
    case 'ws':
      return `${127 + Math.round(seeded(7) * 4)} clients · ${Math.round(12 + seeded(8) * 6)} ms`;
    default:
      return '99.98% uptime · 31 d';
  }
}

/* ------------------------------------------------------------------ *
 * Deployment identity card
 * ------------------------------------------------------------------ */

function DeploymentCard() {
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center justify-between border-b border-edge/80 bg-[#0a111f] px-3.5 py-2.5">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#c7d4e8]">
          <Globe2 size={13} className="text-accent-cyan" />
          Deployment
        </h2>
      </header>
      <dl className="space-y-1.5 px-3.5 py-3 text-[11.5px]">
        <DeploymentRow k="Release" v={DEPLOYMENT_META.version} mono />
        <DeploymentRow k="Deployed" v={DEPLOYMENT_META.deployed} />
        <DeploymentRow k="Core node" v={DEPLOYMENT_META.node} />
        <DeploymentRow k="Operator" v={`${DEPLOYMENT_META.operator} · ${DEPLOYMENT_META.operatorRole}`} />
        <DeploymentRow k="Last config" v={DEPLOYMENT_META.lastConfig} />
      </dl>
      <div className="border-t border-edge/70 bg-[#0a111f] px-3 py-2 text-[10.5px] text-ink-faint">
        Config channel · <span className="font-semibold text-[#86efac]">gp-config-bus · healthy</span>
      </div>
    </section>
  );
}

function DeploymentRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 uppercase tracking-wider text-ink-faint" style={{ fontSize: 9.5 }}>
        {k}
      </dt>
      <dd className={`tnum min-w-0 text-right text-[11.5px] font-medium text-[#c3cfe2] ${mono ? 'font-mono text-[10.5px] text-accent-cyan' : ''}`}>
        {v}
      </dd>
    </div>
  );
}
