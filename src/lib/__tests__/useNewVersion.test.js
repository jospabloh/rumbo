// Canonical test for shared/update/useNewVersion.js — copy it next to the app's
// copy (e.g. src/lib/__tests__/useNewVersion.test.js) and fix the import path
// only. Runs under vitest + jsdom.
import { afterEach, describe, expect, it } from 'vitest';
import { currentEntryScript, entryScriptFromHtml, isNewVersion } from '@/lib/useNewVersion';

// What Base44 and Vercel actually serve for a Vite build (rumbo, 2026-10-13).
const SERVED = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-y3lU3rA9.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-Bx1.css">
</head><body><div id="root"></div></body></html>`;

afterEach(() => { document.head.innerHTML = ''; });

describe('entryScriptFromHtml', () => {
  it('finds the hashed entry chunk of a Vite build', () => {
    expect(entryScriptFromHtml(SERVED)).toBe('/assets/index-y3lU3rA9.js');
  });

  it('accepts an absolute URL and attributes in any order', () => {
    const html = '<script src="https://app.example.com/assets/main-9z.js" type="module"></script>';
    expect(entryScriptFromHtml(html)).toBe('/assets/main-9z.js');
  });

  // A plain analytics <script> or the dev entry must not be mistaken for the
  // build: that would announce a "new version" on every check.
  it('ignores classic scripts and the unhashed dev entry', () => {
    const html = '<script src="/assets/legacy.js"></script><script type="module" src="/src/main.jsx"></script>';
    expect(entryScriptFromHtml(html)).toBeNull();
  });

  it('returns null for an error page or no body at all', () => {
    expect(entryScriptFromHtml('<h1>502 Bad Gateway</h1>')).toBeNull();
    expect(entryScriptFromHtml(undefined)).toBeNull();
  });
});

describe('currentEntryScript', () => {
  it('reads the entry chunk this tab loaded', () => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = '/assets/index-OLD.js';
    document.head.appendChild(s);
    expect(currentEntryScript(document)).toBe('/assets/index-OLD.js');
  });

  it('is null in vite dev, which turns the check off', () => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = '/src/main.jsx';
    document.head.appendChild(s);
    expect(currentEntryScript(document)).toBeNull();
  });
});

describe('isNewVersion', () => {
  it('is true only when both builds are known and differ', () => {
    expect(isNewVersion('/assets/index-A.js', '/assets/index-B.js')).toBe(true);
    expect(isNewVersion('/assets/index-A.js', '/assets/index-A.js')).toBe(false);
  });

  // A failed or odd response must never nag someone to reload for nothing.
  it('treats "could not tell" as no new version', () => {
    expect(isNewVersion('/assets/index-A.js', null)).toBe(false);
    expect(isNewVersion(null, '/assets/index-B.js')).toBe(false);
  });
});
