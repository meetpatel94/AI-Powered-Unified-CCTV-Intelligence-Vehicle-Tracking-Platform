// Usage: node scripts/shot.js <tag> <w>x<h> [routes...]
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tag = process.argv[2] ?? 'x';
const [w, h] = (process.argv[3] ?? '1366x768').split('x').map(Number);
const routes = process.argv.slice(4);
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', tag);

const all = [
  ['dashboard', '/'],
  ['liveview', '/live-view'],
  ['cameramap', '/camera-map'],
  ['watchlist', '/watchlist'],
  ['alerts', '/alerts'],
  ['analytics', '/analytics'],
  ['investigation', '/investigation'],
  ['camhealth', '/camera-health'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('pageerror', (err) => console.log(`PAGEERROR ${err.message}`));

for (const [name, route] of routes.length ? routes.map((r) => [r, r]) : all) {
  await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${name}-${w}x${h}.png` });
  // overflow diagnostics
  const diag = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    docH: document.documentElement.scrollHeight,
    winW: innerWidth,
    winH: innerHeight,
    bodyScrollX: document.body.scrollLeft,
    hOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    vOverflow: document.documentElement.scrollHeight > innerHeight + 1,
  }));
  console.log(`${name} ${w}x${h}:`, JSON.stringify(diag));
}
await browser.close();
