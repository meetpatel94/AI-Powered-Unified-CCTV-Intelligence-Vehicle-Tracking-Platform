/* Dev-only client runtime check: mounts the app on /system-settings inside
   a happy-dom window and exercises real interactions (toggle, edit, save,
   reset confirm, maintenance confirm). Requires happy-dom (dev-only).
   Usage: npx vite build --ssr scripts/settings-runtime.tsx --outDir .smoke-out --emptyOutDir && node .smoke-out/settings-runtime.js */
import { Window } from 'happy-dom';
import { renderToString } from 'react-dom/server';

import App from '@/App';
import { MemoryRouter } from 'react-router-dom';

const window = new Window({ url: 'http://localhost/system-settings' });
(globalThis as Record<string, unknown>).window = window;
(globalThis as Record<string, unknown>).document = window.document;
(globalThis as Record<string, unknown>).HTMLElement = window.HTMLElement;
(globalThis as Record<string, unknown>).Event = window.Event;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as Record<string, unknown>).window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) console.log(`OK   ${message}`);
  else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// SSR sanity (same as smoke) then client-side behavior verification:
const ssr = renderToString(
  <MemoryRouter initialEntries={['/system-settings']}>
    <App />
  </MemoryRouter>,
);
assert(ssr.includes('System Settings'), 'ssr renders settings page');

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');

const container = window.document.createElement('div');
window.document.body.appendChild(container);
const root = createRoot(container);

await act(async () => {
  root.render(
    <MemoryRouter initialEntries={['/system-settings']}>
      <App />
    </MemoryRouter>,
  );
});
await wait(50);

const text = () => container.textContent ?? '';
assert(text().includes('SYSTEM SETTINGS') || text().includes('System Settings'), 'client mount shows title');
assert(text().includes('All Systems Operational'), 'status indicator rendered');
assert(text().includes('Configuration Change History'), 'history table rendered');
assert(text().includes('14 modules'), 'nav module count');

// 1 — toggle a switch: first [role=switch] is "Exponential backoff"
const switches = container.querySelectorAll('[role="switch"]');
assert(switches.length > 5, `found ${switches.length} toggles`);
const backoff = switches[0] as HTMLElement;
const before = backoff.getAttribute('aria-checked');
await act(async () => backoff.click());
await wait(10);
const after = backoff.getAttribute('aria-checked');
assert(before !== after, `toggle flips state (${before} -> ${after})`);
assert(text().includes('unsaved change'), 'unsaved indicator appears');

// 2 — edit the platform name (unique by placeholder inside General panel)
const nameInput = container.querySelector('input[placeholder*="Gujarat Police Unified"]') as HTMLInputElement;
assert(Boolean(nameInput), 'platform-name input present');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
setter?.call(nameInput, 'Gujarat Police Unified Platform');
nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
nameInput.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(10);
assert(text().includes('2 unsaved'), 'dirty count reaches 2');

// 3 — Save Changes -> toast + history rows
const saveButton = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Save Changes')) as HTMLElement;
await act(async () => saveButton.click());
await wait(120);
assert(text().includes('Configuration saved'), 'save toast shown');
assert(text().includes('new this session'), 'history shows new entries');

// 4 — change again then Reset confirm modal -> discard
setter?.call(nameInput, 'GJ Unified CCTV Platform');
nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
nameInput.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(10);
const resetButton = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Reset')) as HTMLElement;
await act(async () => resetButton.click());
await wait(20);
assert(text().includes('Discard unsaved changes?'), 'reset confirmation modal opens');
const discard = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Discard changes')) as HTMLElement;
assert(Boolean(discard), 'discard button present');
await act(async () => discard.click());
await wait(60);
const pillGone = ![...container.querySelectorAll('span')].some((s) => /\d+ unsaved change/.test(s.textContent ?? ''));
assert(pillGone, 'draft reset clears pending edits');
assert(text().includes('All changes committed'), 'committed state restored');

// 5 — maintenance confirm opens for destructive action
const maintenance = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('System Maintenance')) as HTMLElement;
await act(async () => maintenance.click());
await wait(150);
const clearCache = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Clear Cache')) as HTMLElement;
assert(Boolean(clearCache), 'maintenance tile found');
await act(async () => clearCache.click());
await wait(20);
assert(text().includes('Confirm — Clear Cache'), 'destructive confirm modal opens');

console.log(failed === 0 ? 'RUNTIME OK' : `RUNTIME FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
