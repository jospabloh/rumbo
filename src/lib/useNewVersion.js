import { useCallback, useEffect, useState } from 'react';

/**
 * ACACIA portfolio "new version" check — shared, byte-identical across every
 * app (Module 30 of `jospabloh/acacia-app-standard`). Change it there first and
 * copy it out.
 *
 * A tab opened before a deploy keeps running the old bundle until someone
 * reloads it, and nothing tells them. Vite names every built file after its
 * content hash (`/assets/index-Ab12Cd.js`, `/assets/index-Ef34.css`), so the
 * set of hashed files `index.html` points at is a signature of the build. The
 * tab takes that signature when it opens and compares it with what the server
 * serves later. No build step, no version file, nothing per app — it reads the
 * same thing a deploy is verified by. A change confined to `index.html` itself
 * (no hashed file moves) is the one kind it cannot see.
 *
 * In `vite dev` the entry is `/src/main.jsx`, not a hashed asset, so the check
 * turns itself off.
 */

export const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const ASSET_SCRIPT = /\/assets\/[^"'?#]+\.js/;
const ASSET_FILE = /\/assets\/[^"'?#]+\.(?:js|css)/;

/** Path of the hashed entry script in an HTML document's text, or null. */
export function entryScriptFromHtml(html) {
  if (typeof html !== 'string') return null;
  const tags = html.match(/<script\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/type\s*=\s*["']module["']/i.test(tag)) continue;
    const src = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    if (src && ASSET_SCRIPT.test(src[1])) return toPath(src[1]);
  }
  return null;
}

/**
 * Signature of a build: every hashed file under `/assets/` that the document
 * loads as a module script, a stylesheet or a module preload, sorted. A CSS-only
 * deploy changes it even though the entry script keeps its name. Null when the
 * document has no hashed entry script (dev, an error page).
 */
export function assetSignature(html) {
  if (!entryScriptFromHtml(html)) return null;
  const refs = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    const isScript = /^<script/i.test(tag);
    if (isScript && !/type\s*=\s*["']module["']/i.test(tag)) continue;
    if (!isScript && !/rel\s*=\s*["'](?:stylesheet|modulepreload)["']/i.test(tag)) continue;
    const url = tag.match(/(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (url && ASSET_FILE.test(url[1])) refs.add(toPath(url[1]));
  }
  return [...refs].sort().join('|');
}

/** Path of the hashed entry script this tab is running, or null (dev, tests). */
export function currentEntryScript(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return null;
  for (const el of doc.querySelectorAll('script[type="module"][src]')) {
    const src = el.getAttribute('src');
    if (src && ASSET_SCRIPT.test(src)) return toPath(src);
  }
  return null;
}

function toPath(src) {
  try {
    return new URL(src, 'http://x').pathname;
  } catch {
    return src;
  }
}

/**
 * The app's own base path, read off its entry script: everything before
 * `/assets/`. An app served under a sub-path (`/freeware/plink-fx/`) must ask
 * for its own `index.html`, never the domain root's.
 */
export function appBase(entryPath) {
  const i = entryPath ? entryPath.lastIndexOf('/assets/') : -1;
  return i >= 0 ? entryPath.slice(0, i + 1) : '/';
}

/**
 * Whether this tab loaded every file in `signature`. The tab's DOM may hold
 * more (stylesheets the app injects at runtime), never fewer: a file the
 * server lists that the tab never loaded means the tab runs an older build.
 */
export function documentLoads(signature, doc = typeof document !== 'undefined' ? document : null) {
  if (!signature || !doc) return true;
  const loaded = new Set();
  for (const el of doc.querySelectorAll('script[src], link[href]')) {
    loaded.add(toPath(el.getAttribute('src') || el.getAttribute('href')));
  }
  return signature.split('|').every((path) => loaded.has(path));
}

/**
 * `{ available, dismiss, reload }`. Checks once on mount to take the baseline,
 * then every `interval` ms and whenever the tab comes back into view or back
 * online. The baseline is the server's own
 * HTML rather than this tab's DOM, because the DOM also holds stylesheets the
 * app injects at runtime, which the HTML never lists. If the very first check
 * lists a file this tab never loaded (a new script or a new stylesheet), a
 * deploy landed between the page load and that check, and it says so.
 * A failed request (offline, deploy in progress) is ignored, never reported.
 * Dismissing hides that version; a later deploy shows the notice again.
 */
export function useNewVersion({ interval = CHECK_INTERVAL_MS } = {}) {
  const [latest, setLatest] = useState(null);
  const [dismissed, setDismissed] = useState(null);

  useEffect(() => {
    const current = currentEntryScript();
    if (!current) return undefined;
    const base = appBase(current);

    let baseline = null;
    let stopped = false;
    let inFlight = false;
    const check = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const res = await fetch(`${base}?_v=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'text/html' } });
        if (!res.ok) return;
        const html = await res.text();
        const signature = assetSignature(html);
        if (!signature || stopped) return;
        if (baseline === null) {
          if (documentLoads(signature)) baseline = signature;
          else setLatest(signature);
        } else if (signature !== baseline) {
          setLatest(signature);
        }
      } catch {
        // Offline or mid-deploy: try again on the next tick.
      } finally {
        inFlight = false;
      }
    };

    check();
    const timer = setInterval(check, interval);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, [interval]);

  const dismiss = useCallback(() => setDismissed(latest), [latest]);
  const reload = useCallback(() => window.location.reload(), []);

  return { available: Boolean(latest) && latest !== dismissed, dismiss, reload };
}
