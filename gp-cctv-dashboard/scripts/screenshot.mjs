/* Dev-only visual check. Requires `npx playwright install chromium` once and a running `npm run dev`.
   Usage: node scripts/screenshot.mjs [path] [outfile] */
import { chromium } from 'playwright';

const route = process.argv[2] ?? '/';
const out = process.argv[3] ?? 'shots/dashboard.png';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1568, height: 948 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
console.log('console errors:', errors);
await browser.close();
