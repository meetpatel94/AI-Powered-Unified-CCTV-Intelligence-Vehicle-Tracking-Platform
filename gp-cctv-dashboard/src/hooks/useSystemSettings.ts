import { useCallback, useSyncExternalStore } from 'react';

import {
  DEFAULT_CONFIG,
  NUMERIC_META_OF,
  SESSION_ACTOR,
  diffPaths,
  fieldLabel,
  formatSettingValue,
} from '@/data/settingsData';

import type {
  ChangeHistoryEntry,
  HistorySource,
  SettingPath,
  SettingValue,
  SystemConfig,
} from '@/types/settings';

/* ------------------------------------------------------------------ *
 * In-memory configuration store.
 *
 * The store lives at module scope (outside React) so navigating away
 * from /system-settings and back keeps the draft, the dirty state and
 * the change history — exactly what a real console would persist. The
 * public action functions are the future seam for API calls:
 *
 *    saveSettings()      → POST /api/v1/settings        (persist draft)
 *    applySettings()     → POST /api/v1/settings/apply  (push live)
 *    recordHistory()     → POST /api/v1/settings/changelog
 * ------------------------------------------------------------------ */

interface SettingsStoreState {
  config: SystemConfig;
  /** Snapshot the draft is compared against (last saved / applied). */
  baseline: SystemConfig;
  history: ChangeHistoryEntry[];
  /** Epoch ms of the last edit; used for "last modified" readouts. */
  changedAt: number | null;
}

let state: SettingsStoreState = {
  config: structuredClone(DEFAULT_CONFIG),
  baseline: structuredClone(DEFAULT_CONFIG),
  history: [],
  changedAt: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettingsSnapshot(): SettingsStoreState {
  return state;
}

let historySeq = 0;

function nowStamp(): string {
  const d = new Date();
  const stamp = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const suffix = hh < 12 ? 'AM' : 'PM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${stamp} · ${String(hour12).padStart(2, '0')}:${mm}:${ss} ${suffix}`;
}

/** Clamp / normalise a value before it enters the config tree. */
export function normaliseValue(path: SettingPath, value: SettingValue, current: SettingValue): SettingValue {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return current;
    const meta = NUMERIC_META_OF(path);
    if (meta) {
      let next = value;
      if (Number.isInteger(meta.step)) next = Math.round(next);
      next = Math.min(Math.max(next, meta.min), meta.max);
      return next;
    }
    return value;
  }
  return value;
}

/** Immutable set along `keys` (group.field or nested leaves like
 *  users.rolePermissions.<role>.<permission>). */
function deepSet(source: unknown, keys: string[], value: SettingValue): unknown {
  const [head, ...tail] = keys;
  if (head === undefined) return value;
  const base = source !== null && typeof source === 'object' ? { ...(source as Record<string, unknown>) } : {};
  base[head] = tail.length > 0 ? deepSet(base[head], tail, value) : value;
  return base;
}

/** Read a nested value by dotted path. */
function readPathValue(source: SystemConfig, path: SettingPath): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function equals(a: SettingValue, b: SettingValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

export function patchSetting(path: SettingPath, value: SettingValue): void {
  const keys = path.split('.').filter(Boolean);
  if (keys.length < 2) return;
  const current = readPathValue(state.config, path) as SettingValue | undefined;
  if (current === undefined) return;
  if (equals(current, value)) return;
  const normalised = normaliseValue(path, value, current);

  state = {
    ...state,
    changedAt: Date.now(),
    config: deepSet(state.config, keys, normalised) as unknown as SystemConfig,
  };
  emit();
}

function commitHistory(source: HistorySource): ChangeHistoryEntry[] {
  const previous = state.baseline;
  const next = state.config;
  const changedPaths = diffPaths(previous, next);
  if (changedPaths.length === 0) return [];

  const stamp = nowStamp();
  const rows: ChangeHistoryEntry[] = changedPaths.map((path) => {
    historySeq += 1;
    return {
      id: `CHG-${String(9130 + historySeq).padStart(5, '0')}`,
      path,
      settingLabel: fieldLabel(path),
      previous: formatSettingValue(path, readPathValue(previous, path)),
      next: formatSettingValue(path, readPathValue(next, path)),
      changedBy: SESSION_ACTOR,
      timestamp: stamp,
      source,
      status: source === 'applied' ? 'Applied' : 'Saved',
    };
  });

  state = {
    ...state,
    baseline: structuredClone(next),
    history: [...rows.reverse(), ...state.history],
  };
  emit();
  return rows;
}

/** Persist the current draft (mock: records the change history). */
export function saveSettings(): ChangeHistoryEntry[] {
  return commitHistory('saved');
}

/** Push the current draft to the live subsystems (mock: same as save). */
export function applySettings(): ChangeHistoryEntry[] {
  return commitHistory('applied');
}

/** Discard every unsaved edit back to the last committed snapshot. */
export function resetSettings(): void {
  state = { ...state, config: structuredClone(state.baseline), changedAt: null };
  emit();
}

/** Restore the platform factory defaults for every section. */
export function restoreDefaults(): void {
  state = {
    ...state,
    baseline: structuredClone(DEFAULT_CONFIG),
    config: structuredClone(DEFAULT_CONFIG),
    changedAt: Date.now(),
  };
  emit();
}

/** Record a non-configuration event (e.g. a maintenance run) in the ledger. */
export function recordHistory(
  settingLabel: string,
  previous: string,
  next: string,
  source: HistorySource = 'maintenance',
): void {
  historySeq += 1;
  const row: ChangeHistoryEntry = {
    id: `CHG-${String(9130 + historySeq).padStart(5, '0')}`,
    path: settingLabel,
    settingLabel,
    previous,
    next,
    changedBy: SESSION_ACTOR,
    timestamp: nowStamp(),
    source,
    status: source === 'applied' ? 'Applied' : source === 'saved' ? 'Saved' : 'Live',
  };
  state = { ...state, history: [row, ...state.history] };
  emit();
}

/* ------------------------------------------------------------------ *
 * React binding
 * ------------------------------------------------------------------ */

export interface SystemSettingsApi {
  config: SystemConfig;
  /** Setting paths with pending (unsaved) edits. */
  changedPaths: SettingPath[];
  changedGroups: Set<string>;
  dirtyCount: number;
  savedAt: number | null;
  /** Change-history entries recorded during this session. */
  history: ChangeHistoryEntry[];
  patch: (path: SettingPath, value: SettingValue) => void;
  save: () => ChangeHistoryEntry[];
  apply: () => ChangeHistoryEntry[];
  reset: () => void;
  defaults: () => void;
  /** Append an operational event (maintenance run, key rotation…) to the ledger. */
  record: (label: string, previous: string, next: string, source?: HistorySource) => void;
}

export function useSystemSettings(): SystemSettingsApi {
  // Server snapshot returns the pristine module state (initial config), so
  // SSR smoke renders produce identical markup across requests.
  const snapshot = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);

  const changedPaths = diffPaths(snapshot.baseline, snapshot.config);
  const changedGroups = new Set(changedPaths.map((path) => path.split('.')[0]));

  const patch = useCallback((path: SettingPath, value: SettingValue) => patchSetting(path, value), []);
  const save = useCallback(() => saveSettings(), []);
  const apply = useCallback(() => applySettings(), []);
  const reset = useCallback(() => resetSettings(), []);
  const defaults = useCallback(() => restoreDefaults(), []);
  const record = useCallback(
    (label: string, previous: string, next: string, source: HistorySource = 'maintenance') =>
      recordHistory(label, previous, next, source),
    [],
  );

  return {
    config: snapshot.config,
    changedPaths,
    changedGroups,
    dirtyCount: changedPaths.length,
    savedAt: snapshot.changedAt,
    history: snapshot.history,
    patch,
    save,
    apply,
    reset,
    defaults,
    record,
  };
}
