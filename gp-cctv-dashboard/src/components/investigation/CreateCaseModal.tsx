import { useMemo, useState } from 'react';
import { Check, FileText, FolderPlus, ShieldAlert, X } from 'lucide-react';

import type { CasePriority, EvidenceItem, InvestigationDossier, NewCasePayload } from '@/types/investigation';

/**
 * The form emits exactly the body of `POST /investigations/:plate/case`
 * (see `services/api.ts`) minus the investigation id the page adds.
 */
export type NewCaseInput = Omit<NewCasePayload, 'investigationId'>;

interface CreateCaseModalProps {
  open: boolean;
  dossier: InvestigationDossier;
  evidence: EvidenceItem[];
  suggestedRef: string;
  onClose: () => void;
  onCreate: (input: NewCaseInput) => void;
}

const inputCls =
  'h-[30px] w-full rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[12.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8ea1c0]';

const priorities: Array<{ id: CasePriority; label: string; tone: string }> = [
  { id: 'critical', label: 'Critical', tone: 'border-accent-red/60 bg-accent-red/15 text-[#ff8b96]' },
  { id: 'high', label: 'High', tone: 'border-accent-orange/60 bg-accent-orange/15 text-[#f7b95f]' },
  { id: 'medium', label: 'Medium', tone: 'border-accent-yellow/60 bg-accent-yellow/15 text-[#eddb6a]' },
  { id: 'low', label: 'Low', tone: 'border-accent-green/60 bg-accent-green/15 text-[#6fe0b0]' },
];

const offences = [
  'Watchlist match — intercept & verify',
  'Vehicle theft / stolen vehicle recovery',
  'ATM skimming / organised property crime',
  'Traffic offences — speed & signal violations',
  'Suspicious movement — surveillance follow-up',
  'Cargo lift / goods conveyance offence',
];

/** Polished case-filing form: title, priority, offence, notes and evidence set. */
export function CreateCaseModal({ open, dossier, evidence, suggestedRef, onClose, onCreate }: CreateCaseModalProps) {
  const defaults = useMemo(
    () => ({
      title: `${dossier.target.plate} — ${dossier.title}`,
      notes: `${dossier.caseId} · ${dossier.sightings.length} sightings across ${
        new Set(dossier.sightings.map((s) => s.cameraId)).size
      } cameras (${dossier.target.plate}, ${dossier.target.label}). Watchlist category: ${
        dossier.target.watchlist.category
      }. Standing instruction: ${dossier.target.watchlist.action}`,
    }),
    [dossier],
  );

  /*
   * The page remounts this form every time it is opened (keyed on the case
   * token), so the initial state below is always the prefilled draft.
   */
  const [title, setTitle] = useState(defaults.title);
  const [priority, setPriority] = useState<CasePriority>(dossier.priority);
  const [offence, setOffence] = useState(offences[0]);
  const [fir, setFir] = useState('');
  const [unit, setUnit] = useState(dossier.unit);
  const [officer, setOfficer] = useState(dossier.openedBy);
  const [notes, setNotes] = useState(defaults.notes);
  const [selected, setSelected] = useState<string[]>(
    evidence.filter((item) => item.primary || item.watchlistHit).map((item) => item.id),
  );

  if (!open) return null;

  const valid = title.trim().length >= 8 && selected.length > 0;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const submit = () => {
    if (!valid) return;
    onCreate({
      title: title.trim(),
      priority,
      offence,
      fir: fir.trim() || 'Pending — to be allotted by the duty officer',
      unit: unit.trim() || dossier.unit,
      officer: officer.trim() || dossier.openedBy,
      notes: notes.trim() || defaults.notes,
      evidenceIds: selected,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button type="button" aria-label="Close case form" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative flex max-h-[94vh] w-[680px] max-w-[96vw] flex-col overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_50px_rgba(0,0,0,0.75)]">
        <header className="flex shrink-0 items-center justify-between border-b border-edge px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-blue/40 bg-accent-blue/15">
              <FolderPlus size={13} className="text-[#9fc7ff]" />
            </span>
            <div>
              <h2 className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-white">Create Case</h2>
              <p className="mt-[1px] text-[11.5px] text-ink-dim">
                Files {dossier.caseId} into the case register · suggested reference{' '}
                <span className="tnum font-semibold text-[#9fc7ff]">{suggestedRef}</span>
              </p>
            </div>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          <div>
            <label className={labelCls} htmlFor="case-title">Case title</label>
            <input id="case-title" value={title} onChange={(event) => setTitle(event.target.value)} className={inputCls} />
          </div>

          <div className="mt-3">
            <span className={labelCls}>Priority</span>
            <div className="grid grid-cols-4 gap-1.5">
              {priorities.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPriority(option.id)}
                  className={`flex h-[30px] items-center justify-center gap-1.5 rounded-[5px] border text-[12px] font-semibold transition-colors ${
                    priority === option.id ? option.tone : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-white'
                  }`}
                >
                  {option.id === 'critical' ? <ShieldAlert size={11} /> : null}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
            <div>
              <label className={labelCls} htmlFor="case-offence">Offence / classification</label>
              <select id="case-offence" value={offence} onChange={(event) => setOffence(event.target.value)} className={inputCls}>
                {offences.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="case-fir">FIR / NC number</label>
              <input
                id="case-fir"
                value={fir}
                onChange={(event) => setFir(event.target.value)}
                placeholder="e.g. FIR 214/2026 · Police Station"
                className={`${inputCls} tnum`}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="case-unit">Investigating unit</label>
              <input id="case-unit" value={unit} onChange={(event) => setUnit(event.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="case-officer">Investigating officer</label>
              <input id="case-officer" value={officer} onChange={(event) => setOfficer(event.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className={labelCls}>Selected evidence</span>
              <span className="flex items-center gap-1.5">
                <span className="tnum text-[11px] text-[#7f93b3]">
                  {selected.length} of {evidence.length} frames
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(evidence.map((item) => item.id))}
                  className="link-action text-[11px]"
                >
                  select all
                </button>
                <button type="button" onClick={() => setSelected([])} className="link-action text-[11px]">
                  clear
                </button>
              </span>
            </div>
            <div className="grid max-h-[168px] grid-cols-2 gap-1.5 overflow-y-auto rounded-[5px] border border-edge bg-[#0c1424] p-1.5">
              {evidence.map((item) => {
                const checked = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`flex items-center gap-1.5 rounded-[4px] border px-1.5 py-1 text-left transition-colors ${
                      checked ? 'border-accent-blue/60 bg-[#12233f]' : 'border-edge bg-[#0d1626] hover:border-edge-strong'
                    }`}
                  >
                    <span className="relative h-[26px] w-[42px] shrink-0 overflow-hidden rounded-[3px] border border-edge-soft">
                      <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="tnum flex items-center gap-1 font-mono text-[11px] font-semibold text-[#dbe6f5]">
                        {item.cameraId}
                        <span className="text-[10px] text-[#7f93b3]">{item.time}</span>
                      </span>
                      <span className="truncate text-[10px] text-[#7f93b3]">
                        {item.location} · {item.confidence.toFixed(1)}%
                      </span>
                    </span>
                    <span
                      className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border ${
                        checked ? 'border-accent-blue bg-accent-blue text-white' : 'border-edge-strong bg-[#0c1424]'
                      }`}
                    >
                      {checked ? <Check size={10} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <label className={labelCls} htmlFor="case-notes">Investigation notes</label>
            <textarea
              id="case-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-[4px] border border-edge bg-[#0c1424] px-2.5 py-2 text-[12.5px] leading-[15px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-edge px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[#7f93b3]">
            <FileText size={10} className="text-accent-cyan" />
            {selected.length} evidence frames will be attached to {suggestedRef}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[30px] rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!valid}
              className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-4 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <FolderPlus size={12} strokeWidth={2.4} />
              Create Case
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
