// Canonical test for shared/update/useNewVersion.js — copy it next to the app's
// copy (e.g. src/lib/__tests__/useNewVersion.test.js) and fix the import path
// only. Runs under vitest + jsdom.
import { afterEach, describe, expect, it } from 'vitest';
import { appBase, assetSignature, currentEntryScript, documentLoads, entryScriptFromHtml } from '@/lib/useNewVersion';

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

describe('assetSignature', () => {
  // The case Codex raised: a deploy that only touches global CSS (a theme
  // token, say) keeps the entry script's name. It must still count as new.
  it('changes when only the stylesheet changes', () => {
    const cssOnly = SERVED.replace('index-Bx1.css', 'index-Cy2.css');
    expect(entryScriptFromHtml(cssOnly)).toBe(entryScriptFromHtml(SERVED));
    expect(assetSignature(cssOnly)).not.toBe(assetSignature(SERVED));
  });

  it('is stable for the same build, whatever the attribute order', () => {
    const reordered = '<link href="/assets/index-Bx1.css" rel="stylesheet">'
      + '<script src="/assets/index-y3lU3rA9.js" type="module"></script>';
    expect(assetSignature(reordered)).toBe(assetSignature(SERVED));
  });

  it('ignores files outside /assets and non-stylesheet links', () => {
    const extra = SERVED.replace('</head>',
      '<link rel="icon" href="/assets/favicon-1.css"><link rel="stylesheet" href="https://fonts.example.com/x.css"></head>');
    expect(assetSignature(extra)).toBe(assetSignature(SERVED));
  });

  it('is null without a hashed entry script', () => {
    expect(assetSignature('<link rel="stylesheet" href="/assets/a-1.css">')).toBeNull();
  });
});

describe('documentLoads', () => {
  function load(...paths) {
    for (const p of paths) {
      const el = p.endsWith('.css') ? document.createElement('link') : document.createElement('script');
      if (p.endsWith('.css')) { el.rel = 'stylesheet'; el.href = p; } else { el.type = 'module'; el.src = p; }
      document.head.appendChild(el);
    }
  }

  it('is true when the tab loaded the build the server serves', () => {
    load('/assets/index-y3lU3rA9.js', '/assets/index-Bx1.css');
    expect(documentLoads(assetSignature(SERVED), document)).toBe(true);
  });

  // Codex, second round: a CSS-only deploy that lands between the page load
  // and the first check must not become the baseline.
  it('is false when the server lists a stylesheet this tab never loaded', () => {
    load('/assets/index-y3lU3rA9.js', '/assets/index-Bx1.css');
    const cssOnly = SERVED.replace('index-Bx1.css', 'index-Cy2.css');
    expect(documentLoads(assetSignature(cssOnly), document)).toBe(false);
  });

  it('ignores extra stylesheets the app injected at runtime', () => {
    load('/assets/index-y3lU3rA9.js', '/assets/index-Bx1.css', '/assets/Chart-Dz9.css');
    expect(documentLoads(assetSignature(SERVED), document)).toBe(true);
  });
});

describe('appBase', () => {
  it('is the root for an app served at the root', () => {
    expect(appBase('/assets/index-y3lU3rA9.js')).toBe('/');
  });

  // Codex: a sub-path app fetching "/" would read the domain root's site.
  it('keeps the sub-path of an app served under one', () => {
    expect(appBase('/freeware/plink-fx/assets/index-9z.js')).toBe('/freeware/plink-fx/');
  });

  it('falls back to the root when it cannot tell', () => {
    expect(appBase(null)).toBe('/');
  });
});

describe('relative asset URLs (Vite base "./")', () => {
  // Codex: under a sub-path, "./assets/x.js" must keep the sub-path, both in
  // the fetched HTML and in this tab's DOM, or the check polls the domain root.
  const APP = 'https://acaciaco.com.mx/freeware/plink-fx/';
  const RELATIVE = '<script type="module" src="./assets/index-9z.js"></script>'
    + '<link rel="stylesheet" href="./assets/index-1a.css">';

  it('resolves fetched HTML against the URL it was fetched from', () => {
    expect(entryScriptFromHtml(RELATIVE, APP)).toBe('/freeware/plink-fx/assets/index-9z.js');
    expect(appBase(entryScriptFromHtml(RELATIVE, APP))).toBe('/freeware/plink-fx/');
  });

  it('matches the DOM and the HTML when both use relative URLs', () => {
    const fakeDoc = {
      baseURI: APP,
      querySelectorAll: () => [
        { getAttribute: (a) => (a === 'src' ? './assets/index-9z.js' : null) },
        { getAttribute: (a) => (a === 'href' ? './assets/index-1a.css' : null) },
      ],
    };
    expect(documentLoads(assetSignature(RELATIVE, APP), fakeDoc)).toBe(true);
  });
});
