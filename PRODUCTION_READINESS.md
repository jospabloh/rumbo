# Production Readiness — Rumbo

Branch: `prod-readiness` · Date: 2026-06-16

## Status at a glance

| Item | State |
|------|-------|
| Lint | ✅ pass |
| Unit tests (282) | ✅ pass |
| Production build | ✅ pass |
| `User` entity RLS hardening | ✅ **deployed to Base44 + verified via MCP** |
| Backend functions + frontend + tests + CI | 🟡 committed/ready — need `git push` + `npx base44 deploy` to go live |
| Live end-to-end auth test | 🔴 pending (needs deploy + a non-owner test user) — checklist below |

> Honest note: only the `User` schema is live so far. The function-code and frontend
> changes are NOT deployed until you run the deploy steps below.

## What changed and why

### Security (P0)

1. **Cross-tenant exposure via service-role functions — FIXED.**
   `supabaseData` and `githubRepos` gated on `user.role === 'owner'`. But `resolveTenant`
   grants `'owner'` to *every* tenant's owner, so any tenant owner could read your entire
   Supabase database and your whole GitHub account. Both now gate on `APP_OWNER_EMAIL`
   (the pattern `licensesAdmin` already used correctly). `createTestData` likewise.

2. **`tenant_id` was client-writable → cross-tenant data access — FIXED.**
   Every tenant-scoped entity isolates by `data.tenant_id == {{user.data.tenant_id}}`.
   `tenant_id` lived in the user's self-updatable profile, so a user could `updateMe({tenant_id})`
   to repoint at another tenant and read its data through normal RLS. `tenant_id` is now
   field-level `write: false` (server-authoritative — only `resolveTenant` sets it via
   service role). Onboarding now binds the tenant server-side via `resolveTenant` instead
   of a client write.

3. **`role` self-escalation — FIXED.** A non-admin could `updateMe({role:'owner'})`.
   `role` is now field-level write-restricted to `owner`/`admin`.

4. **Missing route guards — FIXED.** `/github`, `/supabase`, `/licenses`, `/test-data`
   were only hidden from the nav, not access-controlled. Added a `RequireAppOwner` guard.

### Resilience
- Top-level `ErrorBoundary` so a single render error can't white-screen the app.

### Tests + CI
- Vitest added. 282 tests asserting real business rules: role permissions, the license
  state machine (active → past_due → readonly → disabled), and module permissions.
- GitHub Actions CI (`.github/workflows/ci.yml`): lint + test + build on every push/PR.

## Not done this pass (deliberately)
- `npm run typecheck` has ~14 pre-existing type-only errors in untyped JSX components.
  They do **not** block the build (Vite builds via esbuild). Left as a separate cleanup.
- Live end-to-end auth test — see checklist; requires the app deployed + a test user.

## Deploy (run on your machine)

```bash
cd ~/projects/rumbo
rm -f .git/*.lock                      # clear stale locks left by the sandbox
git add -A
git commit -m "prod-readiness: tenant_id/role RLS hardening, ErrorBoundary, vitest, CI"
git checkout main && git merge --no-ff prod-readiness -m "Merge prod-readiness"
git push origin main
git push origin prod-readiness
npx base44 login                       # one-time device login
npx base44 deploy -y                   # deploys entities, functions, and site
```

## Post-deploy verification (check-prompts)

1. `npx base44 functions list` → confirm `supabaseData`, `githubRepos`, `createTestData`
   show a fresh deploy timestamp.
2. **Already testable now (schema is live):** in a *non-app-owner* tenant user's session,
   run `await base44.auth.updateMe({ tenant_id: '<another-tenant-id>' })` in the console →
   `tenant_id` must NOT change (write:false). Their data view stays scoped to their tenant.
3. As a `driver` user, run `await base44.auth.updateMe({ role: 'owner' })` → role must stay `driver`.
4. As a non-app-owner, open `/supabase` and `/github` → "Acceso restringido"; backend returns 403.
5. Sanity: a normal tenant owner/admin can still onboard and CRUD their own vehicles/drivers
   (tenant binding via `resolveTenant` works).
