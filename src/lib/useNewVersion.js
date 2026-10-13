import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ACACIA portfolio "new version" check — shared, byte-identical across every
 * app (Module 30 of `jospabloh/acacia-app-standard`). Change it there first and
 * copy it out.
 *
 * A tab opened before a deploy keeps running the old bundle until someone
 * reloads it, and nothing tells them. This compares the bundle the tab loaded
 * with the one the server is serving now: Vite names the entry chunk after its
 * content hash (`/assets/index-Ab12Cd.js`), so a different name means a
 * different build. No build step, no version file, nothing per app — it reads
 * the same thing a deploy is verified by.
 *
 * In `vite dev` the entry is `/src/main.jsx`, not a hashed asset, so the check
 * turns itself off.
 */

export const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const ASSET_SCRIPT = /\/assets\/[^"'?#]+\.js/;

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

/** True only when both are known and they differ: unknown never means "new". */
export function isNewVersion(current, latest) {
  return Boolean(current && latest && current !== latest);
}

/**
 * `{ available, dismiss, reload }`. Checks every `interval` ms and whenever the
 * tab comes back into view or back online; stops once a new version is found.
 * A failed request (offline, deploy in progress) is ignored, never reported.
 * Dismissing hides that version; a later deploy shows the notice again.
 */
export function useNewVersion({ interval = CHECK_INTERVAL_MS } = {}) {
  const [latest, setLatest] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const current = useRef(null);

  useEffect(() => {
    current.current = currentEntryScript();
    if (!current.current) return undefined;

    let stopped = false;
    let inFlight = false;
    const check = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'text/html' } });
        if (!res.ok) return;
        const found = entryScriptFromHtml(await res.text());
        if (isNewVersion(current.current, found)) setLatest(found);
      } catch {
        // Offline or mid-deploy: try again on the next tick.
      } finally {
        inFlight = false;
      }
    };

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
