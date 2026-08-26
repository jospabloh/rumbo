// Rumbo-specific additions to the live-site smoke suite. smoke.spec.js next to
// this file is the shared portfolio suite (title/theme/switcher) and stays
// byte-identical everywhere — this file is where this app's own regressions
// get a permanent check, per that file's own comment ("put app-specific checks
// in a sibling spec file").
//
// Directly born from the 2026-08-26 incident (see CLAUDE.md): two real users
// hit "Continuar con Apple" throwing Base44's raw platform error before any
// account existed. The fix merged the same day but sat unserved because
// merging doesn't deploy (Module 11) — this suite is what would have caught
// that gap the next morning's cron run, instead of a third user finding it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import config from './smoke.config.js';

const BASE_URL = process.env.SMOKE_URL || config.url;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Read straight from the deploy config rather than hardcoding it a second
// time — this ID has to stay correct for the register-endpoint check below
// regardless of which Base44 app is behind SMOKE_URL.
const { appId } = JSON.parse(readFileSync(path.join(ROOT, 'base44.app.json'), 'utf8'));

test.describe('Login screen — social providers', () => {
  test('offers Google, never Apple', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByRole('button', { name: /continuar con google/i })).toBeVisible();
    // The regression this guards: this button existed, unconditionally, for
    // months after Sign in with Apple was ever configured on this app's
    // Base44 backend — clicking it threw the platform's raw "not enabled"
    // error before any account was created. If this ever reappears without
    // the provider actually being enabled, a real user hits that dead end
    // again before this suite's next scheduled run would otherwise catch it.
    await expect(page.getByRole('button', { name: /continuar con apple/i })).toHaveCount(0);
  });

  test('"Continuar con Google" reaches a real Google OAuth screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await Promise.all([
      page.waitForURL(/accounts\.google\.com/, { timeout: 15_000 }),
      page.getByRole('button', { name: /continuar con google/i }).click(),
    ]);
    expect(page.url()).toContain('accounts.google.com');
  });
});

test.describe('Auth endpoints — live and validating', () => {
  test('email/password registration endpoint is reachable and validates', async ({ request }) => {
    // An empty body, never real credentials: this proves the endpoint is live
    // and enforcing its own schema, without ever creating an account against
    // production. A 404/500 here means the endpoint itself is down, not just
    // a bad request — that distinction is the entire point of the check.
    const res = await request.post(`${BASE_URL}/api/apps/${appId}/auth/register`, {
      data: {},
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    const fields = (body.detail || []).map((d) => d.loc?.[d.loc.length - 1]);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });
});
