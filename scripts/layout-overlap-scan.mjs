// Layout scan: overlapping interactive elements, horizontal overflow, clipped
// button text and controls covered by fixed chrome (theme switcher, bars), on
// the main Rumbo screens at phone / tablet / desktop widths, in Chromium.
//
// Usage:  node scripts/layout-overlap-scan.mjs [--no-build] [--only substr] [--widths 320,390,768,834,1024,1440] [--shots dir]
//   Builds the app (dist/) and serves it itself, and fulfils EVERY /api/ request locally with schema-
//   generated rows: nothing reaches Base44. Exits 1 on any finding.
//   Needs a Playwright Chromium (PW_CHROMIUM=/path overrides the executable).
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const WIDTHS = (argOf('--widths') || '320,390,768,834,1024,1440').split(',').map(Number);
const SHOTS = argOf('--shots');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = argOf('--only');

// ---------------------------------------------------------------- data --
const TENANT = 'mockTenant';
const today = new Date().toISOString().slice(0, 10);
function sample(name, i) {
  const raw = readFileSync(`base44/entities/${name}.jsonc`, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const schema = JSON.parse(raw);
  const row = { id: `${name}_${i}`, tenant_id: TENANT, created_date: `${today}T10:00:00Z`, updated_date: `${today}T10:00:00Z` };
  for (const [k, p] of Object.entries(schema.properties || {})) {
    if (k === 'tenant_id') continue;
    if (p.enum) row[k] = p.enum[i % p.enum.length];
    else if (p.type === 'number' || p.type === 'integer') row[k] = (i + 1) * 1234;
    else if (p.type === 'boolean') row[k] = i % 2 === 0;
    else if (p.type === 'array') row[k] = [];
    else if (p.type === 'object') row[k] = {};
    else if (p.format === 'date') row[k] = today;
    else if (p.format === 'date-time') row[k] = `${today}T10:00:00Z`;
    else row[k] = `${p.title || k} ${i + 1}`;
  }
  return row;
}
const ENTITIES = readdirSync('base44/entities').map((f) => f.replace('.jsonc', ''));
const db = {};
for (const e of ENTITIES) { try { db[e] = [0, 1, 2, 3].map((i) => sample(e, i)); } catch { db[e] = []; } }
db.Alert.forEach((a, i) => { a.resolved = false; a.severity = i === 0 ? 'critical' : 'warning'; });
db.Message.forEach((m) => { m.read = false; });

const TENANTS = {
  mockTenant: {
    id: TENANT, tenant_name: 'Flotilla de prueba larga', owner_email: 'dueno@example.invalid', plan: 'starter', status: 'active',
    join_code: 'RUMBO-ABC123', members: [{ email: 'a@example.invalid', role: 'driver' }], max_vehicles: 15, max_drivers: 20,
    permissions_config: {}, settings: {},
  },
};
const USERS = {
  owner: { id: 'u1', email: 'dueno@example.invalid', full_name: 'Dueño de Prueba', role: 'owner', data: { tenant_id: TENANT } },
  dispatcher: { id: 'u2', email: 'op@example.invalid', full_name: 'Operador Prueba', role: 'dispatcher', data: { tenant_id: TENANT } },
  driver: { id: 'u3', email: 'cond@example.invalid', full_name: 'Conductor Prueba', role: 'driver', data: { tenant_id: TENANT } },
  investor: { id: 'u4', email: 'socio@example.invalid', full_name: 'Socio Prueba', role: 'investor', data: { tenant_id: TENANT } },
};

async function mockBackend(ctx, who) {
  const me = { ...USERS[who] };
  // Nothing but the local dev server and the mocked API may be reached (fonts etc. hang in sandboxes).
  await ctx.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => route.abort());
  await ctx.route((url) => url.pathname.startsWith('/api/') || /socket\.io/.test(url.href), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (x, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(x) });
    if (/socket\.io/.test(url.href)) return route.abort();
    if (p.includes('public-settings')) return json({ id: 'mockapp', public_settings: {} });
    if (p.endsWith('/entities/User/me')) return json(me);
    let m = p.match(/\/entities\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const rows = db[m[1]] || [];
      if (req.method() !== 'GET') return json({ id: `mock_${Date.now()}` });
      if (m[2]) return json(rows.find((r) => r.id === m[2]) || {});
      return json(rows);
    }
    m = p.match(/\/functions\/(\w+)/);
    if (m) {
      if (m[1] === 'resolveTenant') return json({ ok: true, tenant: TENANTS[TENANT], is_app_owner: who === 'owner' });
      if (m[1] === 'manageMember') return json({ ok: true, users: Object.values(USERS), requests: [] });
      if (m[1] === 'licensesAdmin') return json({ ok: true, tenants: [TENANTS[TENANT], { ...TENANTS[TENANT], id: 't2', tenant_name: 'Otra flotilla' }] });
      if (m[1] === 'ticketsAdmin') return json({ ok: true, tickets: db.SupportTicket });
      if (m[1] === 'fleetUnitMetrics') {
        const body = JSON.parse(req.postData() || '{}');
        const { start, end } = body.range || { start: today, end: today };
        const dates = [];
        for (let d = new Date(start); d <= new Date(end) && dates.length < 40; d = new Date(d.getTime() + 864e5)) dates.push(d.toISOString().slice(0, 10));
        const vehicles = db.Vehicle.map((v, i) => ({
          vehicle_id: v.id, plate: v.plate, unit_number: v.unit_number, status: 'active', assigned_driver_id: null,
          revenue: 5000 + i * 700, cost: 1800, profit: 3200 + i * 700, km_traveled: 900, cost_per_km: 2.1, active_days: 7,
          profit_per_active_day: 450 + i * 50, below_range: i === 3, maintenance_cost: 400, maintenance_reserve_weekly: 300,
          maintenance_fund_reserved: 600, maintenance_fund_balance: 200,
          daily: dates.map((date, k) => ({ date, revenue: 700 + k * 10, cost: 250, profit: 450 + k * 10 })),
          trailing_profit_per_active_day: [400, 420, 440, 460], projected_next_profit_per_active_day: 470, projected_below_range: false,
          next_preventive_estimate: null, next_tire_estimate: null,
        }));
        return json({ range: { start, end }, vehicles, fleet: {
          vehicle_count: 4, active_vehicle_count: 4, median_profit_per_active_day: 480, below_range_ratio: 0.7, below_range_vehicle_ids: [],
          most_productive_vehicle: vehicles[2], least_productive_vehicle: vehicles[0], most_productive_driver: null, least_productive_driver: null,
          driver_rows: [], maintenance_by_category: [{ category: 'general', cost: 400 }], maintenance_by_kind: [{ kind: 'preventive', cost: 400 }],
          total_revenue: 24000, total_cost: 7200, total_profit: 16800 } });
      }
      if (m[1] === 'calculateCostPerKm') return json({ ok: true, results: [] });
      return json({ ok: true });
    }
    return json({ ok: true });
  });
}

// -------------------------------------------------------------- screens --
const SCREENS = {
  owner: ['/', '/alerts', '/messages', '/location', '/links', '/help', '/drivers', '/vehicles', '/maintenance', '/rentas', '/financial', '/expenses', '/reports', '/import', '/catalogs', '/billing', '/admin', '/licenses', '/tickets'],
  dispatcher: ['/', '/vehicles', '/rentas'],
  driver: ['/driver/home', '/driver/profile', '/driver/trips', '/driver/messages'],
  investor: ['/investor/home'],
};
const AUTH = ['/login', '/register', '/forgot-password'];
const OPENERS = /^\s*(nuevo|nueva|agregar|añadir|registrar|invitar|crear|\+)/i;

// Runs in the page. Returns findings for the current viewport / scroll state.
function measure(scopeSel) {
  const scope = (scopeSel && document.querySelector(scopeSel)) || document;
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=combobox]';
  const label = (el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 36)}"`;
  const modal = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]');
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
    if (el.closest('[aria-hidden="true"], [inert], [hidden]')) return false;
    if (modal && !modal.contains(el)) return false;
    // inside a scroll container, only count what is actually painted on screen
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false;
    return true;
  };
  const els = [...scope.querySelectorAll(SEL)].filter(vis);
  // peers inside a scroll container may be clipped by it
  const clippedAway = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
        const ar = a.getBoundingClientRect(); const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
        // centre scrolled out of its scroller: a half-hidden peek is scroll state, not layout
        if (cx < ar.left || cx > ar.right || cy < ar.top || cy > ar.bottom) return true;
      }
    }
    return false;
  };
  const partlyScrolledOut = (el) => {
    const r = el.getBoundingClientRect();
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 2) {
        const ar = a.getBoundingClientRect();
        if (r.top < ar.top - 1 || r.bottom > ar.bottom + 1) return true;
      }
    }
    return false;
  };
  // The rect that is actually visible: clipped by every scrolling / overflow-hidden ancestor.
  const visRect = (el) => {
    const r = el.getBoundingClientRect();
    let L = r.left; let T = r.top; let R = r.right; let B = r.bottom;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
        const ar = a.getBoundingClientRect();
        L = Math.max(L, ar.left); T = Math.max(T, ar.top); R = Math.min(R, ar.right); B = Math.min(B, ar.bottom);
      }
    }
    return { left: L, top: T, right: R, bottom: B };
  };
  const live = els.filter((e) => !clippedAway(e));
  // Painted at its own centre: not hidden behind an overlay (an open drawer, a menu). Used for the pair test.
  const painted = (e) => { const r = e.getBoundingClientRect(); const at = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return !!at && (at === e || e.contains(at) || at.contains(e)); };
  const out = { overlap: [], covered: [], clipped: [], overflow: [] };
  const mainEl = document.querySelector('main');
  const sc = mainEl && mainEl.scrollHeight > mainEl.clientHeight + 2 ? mainEl : document.scrollingElement;
  const scrollable = sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2;
  // 1. intersecting pairs of unrelated interactive elements
  for (let i = 0; i < live.length; i++) {
    const a = live[i]; const ra = visRect(a);
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (!painted(a) || !painted(b)) continue;
      if (a.closest('label') && a.closest('label') === b.closest('label')) continue;
      const rb = visRect(b);
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      const sw = a.closest('[data-theme-switcher]') || b.closest('[data-theme-switcher]');
      if (sw && scrollable) continue; // content scrolling beneath the floating switcher is inherent; checked again at the bottom
      if (w > 3 && h > 3) out.overlap.push(`${label(a)} [${Math.round(ra.left)},${Math.round(ra.top)} ${Math.round(ra.width)}x${Math.round(ra.height)}] x ${label(b)} [${Math.round(rb.left)},${Math.round(rb.top)} ${Math.round(rb.width)}x${Math.round(rb.height)}]`);
    }
  }
  // 2. control whose centre is painted over by something else
  for (const el of live) {
    const r = el.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.bottom - 3]];
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const at = document.elementFromPoint(x, y);
      if (!at || at === el || el.contains(at) || at.contains(el)) continue;
      if (partlyScrolledOut(el)) continue;
      if (el.tagName === 'LABEL' || at.closest('label')?.contains(el)) continue;
      const fixed = (() => { for (let a = at; a; a = a.parentElement) { if (['fixed', 'sticky'].includes(getComputedStyle(a).position)) return true; } return false; })();
      if (scrollable && at.closest('[data-theme-switcher]')) continue;
      out.covered.push(`${label(el)} under ${at.tagName.toLowerCase()}${at.closest('[data-theme-switcher]') ? '[theme-switcher]' : ''}${fixed ? ' (fixed)' : ''} "${(at.textContent || '').trim().slice(0, 20)}"`);
      break;
    }
  }
  // 3. text clipped inside a button / link / tab
  for (const el of live) {
    if (!/^(BUTTON|A)$/.test(el.tagName) && el.getAttribute('role') !== 'tab') continue;
    const cs = getComputedStyle(el);
    if (el.getAttribute('role') === 'combobox') continue; // select triggers truncate with an ellipsis by design
    if (el.scrollWidth > el.clientWidth + 2 && /(hidden|clip)/.test(cs.overflowX)) out.clipped.push(`${label(el)} scroll ${el.scrollWidth} > ${el.clientWidth}`);
    // text running outside its button's box
    const rng = document.createRange(); rng.selectNodeContents(el);
    const tr = rng.getBoundingClientRect(); const er = el.getBoundingClientRect();
    if (tr.width && (tr.right > er.right + 2 || tr.left < er.left - 2) && cs.whiteSpace === 'nowrap') out.clipped.push(`${label(el)} text spills ${Math.round(tr.right - er.right)}px`);
  }
  // 4. horizontal overflow of the page / app shell
  const de = document.documentElement;
  if (de.scrollWidth > innerWidth + 1) out.overflow.push(`document ${de.scrollWidth} > ${innerWidth}`);
  const main = document.querySelector('main');
  if (main && main.scrollWidth > main.clientWidth + 1) {
    const mr = main.getBoundingClientRect();
    const culprits = [...main.querySelectorAll('*')].filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.right <= mr.right + 1) return false;
      for (let a = e.parentElement; a && a !== main; a = a.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return false; }
      return true;
    }).slice(0, 3);
    for (const c of culprits) out.overflow.push(`culprit ${c.tagName.toLowerCase()}.${String(c.className).split(' ').slice(0, 4).join('.')} "${(c.textContent || '').trim().slice(0, 24)}" right ${Math.round(c.getBoundingClientRect().right)}`);
  }
  if (main && main.scrollWidth > main.clientWidth + 1) out.overflow.push(`main ${main.scrollWidth} > ${main.clientWidth}`);
  for (const el of live) {
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.left < -1) out.overflow.push(`${label(el)} off-screen x ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  out.crashed = /Algo salió mal/.test(document.body.innerText);
  return out;
}

async function scanState(page, scopeSel = null) {
  const res = await page.evaluate(measure, scopeSel);
  // and again with the scroll container at the bottom (fixed chrome sits on the tail)
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = m.scrollHeight; window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(150);
  const res2 = await page.evaluate(measure, scopeSel);
  for (const k of ['overlap', 'covered', 'clipped', 'overflow']) for (const v of res2[k]) if (!res[k].includes(v)) res[k].push(`${v} @bottom`);
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0; });
  return res;
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
}

async function main() {
  // A production build on a static server: the dev server's optimiser is far too
  // heavy for sandboxes, `vite preview` hangs under the Base44 plugin, and the
  // build is what ships anyway.
  if (!args.includes('--no-build')) await build({ logLevel: 'error' });
  const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = createServer(async (req, res) => {
    const clean = normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, '');
    let file = join('dist', clean);
    let body = await readFile(file).catch(() => null);
    if (!body) { file = join('dist', 'index.html'); body = await readFile(file); } // SPA fallback
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  let bad = 0;
  const report = (tag, res, errors = []) => {
    if (res.crashed) res.overflow.push('app crashed to the error boundary');
    const n = ['overlap', 'covered', 'clipped', 'overflow'].reduce((s, k) => s + res[k].length, 0);
    if (n) bad++;
    console.log(`${n ? 'FAIL' : 'ok  '} ${tag}`);
    for (const [k, v] of Object.entries(res)) if (Array.isArray(v)) for (const line of [...new Set(v)].slice(0, 8)) console.log(`       ${k}: ${line}`);
    if (errors.length) console.log(`       errors: ${errors.slice(0, 3).join(' || ')}`);
  };
  try {
    for (const width of WIDTHS) {
      const tablet = width >= 600 && width < 1400;
      const height = width === 1024 ? 768 : width >= 768 && width < 1024 ? 1100 : width >= 1400 ? 900 : 740;
      const sizes = width === 1024 ? [[1024, 1366], [1024, 768]] : [[width, height]];
      for (const [w, h] of sizes) {
        const W = `${w}x${h}`;
        // anonymous auth screens
        {
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 1400, locale: 'es-MX' });
          await mockBackend(ctx, 'owner');
          const page = await ctx.newPage();
          for (const path of AUTH) {
            if (ONLY && !ONLY.split(',').includes(path)) continue;
            await page.goto(base + path, { waitUntil: 'domcontentloaded' }); await settle(page);
            report(`${W} anon ${path}`, await scanState(page));
            if (SHOTS) await page.screenshot({ path: `${SHOTS}/${w}x${h}-anon${path.replace(/\//g, '_')}.png` });
          }
          await ctx.close();
        }
        for (const [who, paths] of Object.entries(SCREENS)) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 1400, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
          await ctx.addInitScript(() => { localStorage.setItem('base44_access_token', 'mock-token'); try { localStorage.removeItem('rumbo.lastPath'); } catch { /* */ } });
          await mockBackend(ctx, who);
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
          page.on('console', (m) => { if (m.type() === 'error' && /Error:|error boundary/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
          for (const path of paths) {
            if (ONLY && !ONLY.split(',').includes(path)) continue;
            errors.length = 0;
            await page.goto(base + path, { waitUntil: 'domcontentloaded' }); await settle(page);
            report(`${W} ${who} ${path}`, await scanState(page), errors);
            if (SHOTS) await page.screenshot({ path: `${SHOTS}/${w}x${h}-${who}${path.replace(/\//g, '_') || '_root'}.png` });
            // open the first "add" dialog on the page and scan it too
            const opener = page.locator('main button:visible').filter({ hasText: OPENERS }).first();
            if (await opener.count()) {
              await opener.click({ timeout: 2000 }).catch(() => {});
              await page.waitForTimeout(500);
              if (await page.locator('[role="dialog"][data-state="open"]').count()) {
                report(`${W} ${who} ${path} [dialog]`, await scanState(page));
                if (SHOTS) await page.screenshot({ path: `${SHOTS}/${w}x${h}-${who}${path.replace(/\//g, '_') || '_root'}-dialog.png` });
                await page.keyboard.press('Escape'); await page.waitForTimeout(250);
              }
            }
          }
          // mobile/tablet drawer + command palette
          if (who === 'owner' && w < 1024 && (!ONLY || ONLY.split(',').includes('menu'))) {
            await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await settle(page);
            await page.locator('header button').first().click().catch(() => {});
            await page.waitForTimeout(400);
            report(`${W} owner [drawer]`, await scanState(page, 'aside.relative'));
            if (SHOTS) await page.screenshot({ path: `${SHOTS}/${w}x${h}-owner-drawer.png` });
          }
          await ctx.close();
        }
      }
      void tablet;
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(bad ? `\n${bad} screens with findings` : '\nno findings');
  process.exit(bad ? 1 : 0);
}
main();
