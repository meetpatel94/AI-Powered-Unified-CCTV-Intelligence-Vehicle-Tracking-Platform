import { type FormEvent, useEffect, useState } from 'react';
import { Search, VideoOff } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { api, type VehicleDto } from '@/services/api';

function clockOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** ANPR plate lookup backed by the real Vehicle Intelligence API. */
export function VehicleSearchPanel() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<VehicleDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Enter a plate number to query backend vehicle intelligence.');

  useEffect(() => {
    let cancelled = false;
    api.getRecentJourneys(1)
      .then((rows) => {
        if (!cancelled && rows[0]) {
          setResult(rows[0]);
          setQuery(rows[0].plate);
          setMessage('Most recent backend vehicle.');
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const plate = query.replace(/\s+/g, '').toUpperCase();
    if (!plate) return;
    setLoading(true);
    setMessage('Searching backend…');
    try {
      const vehicle = await api.getVehicleIdentity(plate);
      setResult(vehicle);
      setMessage('Backend record found.');
    } catch {
      setResult(null);
      setMessage('No backend vehicle record found for this plate.');
    } finally {
      setLoading(false);
    }
  };

  const anprMeta = [
    { label: 'ANPR', value: result?.best_confidence != null ? `${Math.round(result.best_confidence * 1000) / 10}%` : '0%', tone: 'text-accent-green' },
    { label: 'Class', value: result?.vehicle_class ?? '—', tone: 'text-[#dbe5f4]' },
    { label: 'Camera', value: result?.last_camera_id ?? '—', tone: 'text-[#dbe5f4]' },
    { label: 'Sightings', value: String(result?.total_sightings ?? 0), tone: 'text-[#dbe5f4]' },
  ];

  return (
    <Panel title="Vehicle Search" className="h-full" bodyClassName="flex flex-col gap-2 px-2.5 pb-2.5 pt-1">
      <form className="flex shrink-0 items-center gap-1.5" onSubmit={submit}>
        <div className="relative flex-1">
          <Search size={12.5} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Enter plate from backend"
            aria-label="Search number plate"
            className="h-[30px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-7 pr-2 text-[13px] tracking-wide text-ink outline-none transition-colors focus:border-accent-blue/70"
          />
        </div>
        <button type="submit" className="h-[30px] shrink-0 rounded-[4px] bg-[#1d6ce0] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#2a7bf0]">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {result ? (
        <div className="flex shrink-0 items-start gap-2.5">
          <div className="grid h-[96px] w-[40%] shrink-0 place-items-center overflow-hidden rounded-[4px] border border-edge-soft bg-black">
            <VideoOff size={22} className="text-ink-faint" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="tnum text-[15px] font-bold leading-tight tracking-wide text-white">{result.plate}</div>
            <dl className="mt-1.5 space-y-[3px]">
              <div><dt className="text-[11px] leading-[14px] text-[#7286a6]">Vehicle Type</dt><dd className="text-[12.5px] leading-[16px] text-[#dbe5f4]">{result.vehicle_class ?? '—'}</dd></div>
              <div><dt className="text-[11px] leading-[14px] text-[#7286a6]">Current Camera</dt><dd className="text-[12.5px] leading-[16px] text-[#dbe5f4]">{result.last_camera_id ?? '—'}</dd></div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[96px] place-items-center rounded-[4px] border border-dashed border-edge bg-[#071120] px-4 text-center text-[12px] text-ink-dim">{message}</div>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-x-2.5 gap-y-1 rounded-[4px] border border-edge-soft bg-[#0c1424] px-2 py-1.5">
        {anprMeta.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-1">
            <span className="text-[11px] text-[#7286a6]">{item.label}</span>
            <span className={`tnum truncate text-[11.5px] font-medium ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 border-t border-edge-soft pt-1.5">
        <div><div className="text-[11px] text-[#7286a6]">First Seen</div><div className="tnum text-[12.5px] text-[#dbe5f4]">{clockOf(result?.first_seen)}</div></div>
        <div><div className="text-[11px] text-[#7286a6]">Last Seen</div><div className="tnum text-[12.5px] text-[#dbe5f4]">{clockOf(result?.last_seen)}</div></div>
      </div>
    </Panel>
  );
}
