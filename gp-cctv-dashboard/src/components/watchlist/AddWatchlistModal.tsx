import { Car, ImagePlus, Package, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { watchlistCategories } from '@/data/watchlistData';
import type { EntryPriority, EntryStatus, WatchlistType } from '@/types/watchlist';

export interface NewWatchlistInput {
  type: WatchlistType;
  categoryId: string;
  label: string;
  alias?: string;
  details: string;
  priority: EntryPriority;
  status: EntryStatus;
  notes: string;
}

interface AddWatchlistModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewWatchlistInput) => void;
}

const inputCls =
  'h-[30px] w-full rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[10.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70';
const labelCls = 'mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8ea1c0]';

const typeOptions: { id: WatchlistType; label: string; icon: typeof Car }[] = [
  { id: 'vehicle', label: 'Vehicle', icon: Car },
  { id: 'person', label: 'Person', icon: UserRound },
  { id: 'other', label: 'Other', icon: Package },
];

/** Polished create form for new watchlist entries. */
export function AddWatchlistModal({ open, onClose, onCreate }: AddWatchlistModalProps) {
  const [type, setType] = useState<WatchlistType>('vehicle');
  const [categoryId, setCategoryId] = useState('high-priority');
  const [label, setLabel] = useState('');
  const [alias, setAlias] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<EntryPriority>('high');
  const [status, setStatus] = useState<EntryStatus>('active');
  const [notes, setNotes] = useState('');

  const categoryOptions = useMemo(
    () => watchlistCategories.filter((category) => category.type === type || type === 'other'),
    [type],
  );

  if (!open) return null;

  const valid = label.trim().length >= 4;

  const submit = () => {
    if (!valid) return;
    onCreate({
      type,
      categoryId,
      label: label.trim().toUpperCase(),
      alias: alias.trim() || undefined,
      details: details.trim() || (type === 'vehicle' ? 'Vehicle details pending verification' : 'Identity details pending verification'),
      priority,
      status,
      notes: notes.trim() || 'Added from command center. Verify against case file within 24 hrs.',
    });
    setLabel('');
    setAlias('');
    setDetails('');
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <button type="button" aria-label="Close modal" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_50px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div>
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-white">Add to Watchlist</h2>
            <p className="mt-[1px] text-[9.5px] text-ink-dim">New entity will be distributed to all matching cameras within 60 seconds</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="max-h-[62vh] overflow-y-auto px-4 py-3.5">
          {/* entity type */}
          <div className="grid grid-cols-3 gap-1.5">
            {typeOptions.map(({ id, label: optionLabel, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setType(id);
                  const first = watchlistCategories.find((category) => category.type === id) ?? watchlistCategories[0];
                  setCategoryId(first.id);
                }}
                className={`flex h-[34px] items-center justify-center gap-1.5 rounded-[5px] border text-[10.5px] font-semibold transition-colors ${
                  type === id
                    ? 'border-accent-blue/70 bg-accent-blue/15 text-[#9fc7ff]'
                    : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-white'
                }`}
              >
                <Icon size={13} />
                {optionLabel}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
            <div>
              <label className={labelCls} htmlFor="wl-category">Watchlist Category</label>
              <select id="wl-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="wl-label">
                {type === 'vehicle' ? 'Plate Number' : type === 'person' ? 'Full Name' : 'Entity Identifier'}
              </label>
              <input
                id="wl-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={type === 'vehicle' ? 'GJ01AB0000' : type === 'person' ? 'e.g. Ramesh Patel' : 'e.g. CONT-5521'}
                className={`${inputCls} ${type === 'vehicle' ? 'uppercase tracking-wider' : ''}`}
              />
            </div>
            {type === 'person' ? (
              <div>
                <label className={labelCls} htmlFor="wl-alias">Alias (optional)</label>
                <input id="wl-alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Known alias" className={inputCls} />
              </div>
            ) : (
              <div>
                <label className={labelCls} htmlFor="wl-priority">Priority</label>
                <select id="wl-priority" value={priority} onChange={(e) => setPriority(e.target.value as EntryPriority)} className={inputCls}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            )}
            <div>
              <label className={labelCls} htmlFor="wl-status">Status</label>
              <select id="wl-status" value={status} onChange={(e) => setStatus(e.target.value as EntryStatus)} className={inputCls}>
                <option value="active">Active</option>
                <option value="monitoring">Monitoring</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {type === 'person' ? (
              <div>
                <label className={labelCls} htmlFor="wl-priority2">Priority</label>
                <select id="wl-priority2" value={priority} onChange={(e) => setPriority(e.target.value as EntryPriority)} className={inputCls}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            ) : null}
            <div className={type === 'person' ? '' : 'col-span-2'}>
              <label className={labelCls} htmlFor="wl-details">
                {type === 'vehicle' ? 'Make / Model / Colour' : 'Description'}
              </label>
              <input
                id="wl-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={type === 'vehicle' ? 'e.g. White Maruti Swift Dzire · 2019' : 'e.g. Male · 34 yrs · distinguishing marks'}
                className={inputCls}
              />
            </div>
          </div>

          {/* photo */}
          <div className="mt-3">
            <span className={labelCls}>Reference Photo</span>
            <button
              type="button"
              className="flex h-[72px] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-edge-strong bg-[#0c1424] text-[#6d7f9e] transition-colors hover:border-accent-blue/60 hover:text-[#9fc7ff]"
            >
              <ImagePlus size={16} strokeWidth={1.7} />
              <span className="text-[9.5px]">Drop photo here or click to browse (JPG / PNG, max 5 MB)</span>
            </button>
          </div>

          <div className="mt-3">
            <label className={labelCls} htmlFor="wl-notes">Operational Notes</label>
            <textarea
              id="wl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Action to take on positive match, linked FIR / NC numbers, caution flags..."
              className="w-full resize-none rounded-[4px] border border-edge bg-[#0c1424] px-2.5 py-2 text-[10.5px] leading-[15px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-edge px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-[30px] rounded-[5px] border border-edge bg-panel px-3 text-[10.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="h-[30px] rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-4 text-[10.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Add to Watchlist
          </button>
        </footer>
      </div>
    </div>
  );
}
