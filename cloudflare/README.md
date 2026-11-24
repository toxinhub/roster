# Cloudflare Worker — CCTV Roster

The production and Preview frontends use the Cloudflare Worker API through the Pages same-origin proxy in `functions/api/[[path]].js`.

## Required Worker configuration

Secrets (configure in the Cloudflare dashboard or with Wrangler's secure secret prompt; never commit their values):
- `SITE_PASSWORD`
- `ADMIN_PASSWORD` — must differ from the site password
- `SESSION_SECRET` — at least 32 characters

Persistent binding:
- KV binding: `ROSTER_DATA`
- Existing namespace ID is pinned in `wrangler.toml`. Do not create a replacement namespace or change this ID during this rollout.

Coordination binding:
- Durable Object binding: `ROSTER_COORDINATOR`
- Class: `RosterCoordinator`
- Migration: `v1` (SQLite-backed Durable Object class)
- `REQUIRE_COORDINATOR=true` makes the Worker fail closed if the binding is absent.

Allowed origins (`ALLOWED_ORIGINS`) control which frontend origins may authenticate and read roster data. The Wrangler configuration lists the production frontends and the explicitly approved read-only Preview origins.

Write origins (`ADMIN_WRITE_ORIGINS`) are checked separately for Admin save/archive requests. Keep this list limited to production frontends:
- `https://toxinhub.github.io`
- `https://roster-bps.pages.dev`

**Never add a branch Preview domain to `ADMIN_WRITE_ORIGINS`**. Preview deployments share the production KV namespace and must remain read-only.

## Authenticated API

- `POST /api/login` — returns a short-lived signed token for the site or Admin role.
- `GET /api/session` — validates a session.
- `POST /api/logout` — revokes the current session token.
- `GET /api/roster` — requires a valid site or Admin session.
- `GET /api/archive?month=YYYY-MM` — requires a valid site or Admin session.
- `POST /api/admin/save` — Admin-only current roster save; checks the expected revision when supplied.
- `POST /api/admin/archive` — Admin-only archive creation; an existing archive is never overwritten.
- `GET /api/status` — exposes configuration booleans only, never secret values.

## Coordination and storage guarantees

The roster is modeled as one coordination unit. Requests are routed through one named `RosterCoordinator` Durable Object, which serializes API operations for:
- Login attempt check-and-increment.
- Current-roster revision checks and saves.
- Archive existence checks and creation.
- Session revocation writes.
- Reads and other KV operations made through the API.

**Important consistency boundary:** `ROSTER_DATA` remains the existing Workers KV persistent store to avoid an unsafe data migration. The Durable Object serializes operations that pass through this Worker, but KV is still an eventually consistent store; this is not equivalent to moving the authoritative roster data into Durable Object SQLite. Do not describe this as globally strong or transactional storage. A future SQLite migration would require a separately planned, verified data migration and rollback strategy.

If `ROSTER_COORDINATOR` is missing while `REQUIRE_COORDINATOR=true`, authenticated API routes fail closed with `AUTH_NOT_CONFIGURED`; they do not silently fall back to KV-only writes. Keep `REQUIRE_COORDINATOR=true` in production.

## Current rollout status (2026-11-24)

- [x] Worker code from PR #3 deployed to `empty-block-84d1`.
- [x] SQLite-backed `RosterCoordinator` namespace provisioned and bound.
- [x] `REQUIRE_COORDINATOR=true` and production-only `ADMIN_WRITE_ORIGINS` verified in live Worker settings.
- [x] Existing `ROSTER_DATA` KV namespace ID verified unchanged.
- [x] Existing secret bindings `SITE_PASSWORD`, `ADMIN_PASSWORD`, and `SESSION_SECRET` verified present after deployment; secret values were neither read nor changed.
- [x] Runtime `/api/status` checked in production: `configured=true` and all 10 configuration checks passed, including the existing secrets' presence, KV/Coordinator bindings, coordinator-required mode, and allowed origin.
- [x] Post-deployment KV snapshot created in a separate namespace `roster-production-backup-2026-11-24`; all three keys (`schedule`, `archive:2026-09`, `archive:2026-10`) copied and verified with matching SHA-256 hashes.
- [x] Production unauthenticated API smoke checks passed: `/api/session` returned `authenticated:false`; `/api/roster` and `/api/archive` returned `AUTH_REQUIRED` without a session.
- [ ] Authenticated Admin save/archive/restore/stale-tab tests remain pending because they require an authorized Admin browser session. The backup is in the same Cloudflare account (not an off-site backup); preserve it until the rollout is fully verified.
- [ ] PR #3 remains open/draft; Pages production branch remains `security/cloudflare-preview`.

The deployment was additive: it created the Durable Object namespace and changed Worker code/bindings, but did not copy, delete, or rewrite roster/archive values in KV. Do not treat the configuration checks above as a substitute for the pending runtime and authenticated tests.

## Safe production cutover runbook

Do these steps in order. Do not change the Pages production branch before the Worker has passed the checks below.

### 1. Pre-deployment checks

- [x] Confirm PR #3 is the intended release and all required GitHub Actions checks are green; latest PR-head run for `5fd35bf` completed successfully, including Node tests and Wrangler dry-run.
- [ ] Confirm the deployment identity is authenticated to the correct Cloudflare account and has the required Worker, Durable Object, and KV permissions.
- [ ] Confirm the existing `ROSTER_DATA` namespace ID in `wrangler.toml` matches the live binding.
- [ ] Confirm the existing three Worker secrets are still configured: `SITE_PASSWORD`, `ADMIN_PASSWORD`, and `SESSION_SECRET`. Verify presence only; never print or copy secret values.
- [ ] Confirm `ADMIN_WRITE_ORIGINS` contains only the production frontend origins.
- [x] Before authenticated Admin write tests, a separate KV namespace snapshot was created and hash-verified on 2026-11-24. For stronger disaster recovery, also export an off-site copy before relying on this snapshot. Do not delete, rename, or replace the source KV namespace.

### 2. Deploy the Worker first

From the repository checkout on branch `fix/roster-data-integrity`:

```sh
cd cloudflare
npx --yes wrangler@4 deploy --config wrangler.toml
```

Review the target account and deployment output before confirming. The deployment applies the additive `v1` Durable Object class migration and binds the existing KV namespace. It must not replace the existing secrets or KV data.

If deploying through the Cloudflare API instead of Wrangler, reproduce the complete reviewed metadata: all non-secret bindings, the exact existing KV namespace ID, the Durable Object binding and `v1` migration, and `keep_bindings: ["secret_text"]`. Cloudflare documents that secrets omitted from a deployment are preserved; still verify all three secret binding names immediately afterward. Never upload a partial binding set.

### 3. Verify Worker configuration

Open the production Worker status endpoint:

```
https://empty-block-84d1.toxinmoy.workers.dev/api/status
```

Expected checks:
- `configured: true`
- `dataBindingPresent: true`
- `coordinatorBindingPresent: true`
- `coordinatorRequired: true`
- `strongCoordinationEnabled: true`

The last field means the coordinator binding is present and API operations route through it; it does not mean KV has become strongly consistent.

If any required check is false, stop. Do not merge the PR or change the Pages production branch. Inspect the Worker deployment and bindings first.

### 4. Authenticated production smoke tests

Use the Admin interface directly; do not put passwords or bearer tokens in chat, issue comments, URLs, screenshots, or logs.

- [ ] Site password login succeeds and site role can read the roster.
- [ ] Site role cannot save or archive.
- [ ] Admin login succeeds.
- [ ] Admin can save a harmless test change and the viewer sees the saved result.
- [ ] Two Admin tabs editing the same revision: the stale save is rejected with a conflict rather than overwriting the newer save.
- [ ] Archive creation succeeds once; a second attempt for the same month returns an existing-archive conflict and preserves the first snapshot.
- [ ] Logout revokes the session.
- [ ] Preview remains read-only: authenticated Preview Admin save/archive requests return `PREVIEW_READ_ONLY`.
- [ ] Verify the roster and archive data remain intact after the checks; revert any intentional test edit.

Do not test by overwriting real schedules or archives. Use a safe test change and restore the exact original state immediately.

### 5. Publish the Pages frontend

The current Cloudflare Pages project production branch is `security/cloudflare-preview`, not `main`. Merging PR #3 into `main` alone will therefore not publish it.

Only after steps 1–4 pass:
- [ ] Merge PR #3 into `main`.
- [ ] Change the Pages production branch from `security/cloudflare-preview` to `main` in the Cloudflare Pages project settings.
- [ ] Wait for the production Pages deployment to complete.
- [ ] Verify the production site loads and its `/api/status` request reaches the Worker through the Pages proxy.
- [ ] Verify site login, roster read, Admin login, save, archive, and logout once more on the production domain.

If the production Pages deployment fails, restore the previous production branch setting and investigate. Do not roll back the Worker by deleting the Durable Object migration or changing the KV namespace.

## Pages API proxy and Preview behavior

The Pages project uses a same-origin `/api/*` proxy in `functions/api/[[path]].js`. Production forwards the browser origin unchanged. The named branch Preview maps to the already-allowlisted legacy Preview origin `dc30fdd7.roster-bps.pages.dev` for authentication and read-only API testing; the upstream Worker still denies writes because this origin is not in `ADMIN_WRITE_ORIGINS`. The proxy rejects cross-origin callers to that Preview host and returns the Preview's own CORS origin only for same-origin requests.

Preview deployments share the production KV namespace and must therefore be treated as public, read-only test surfaces. Never use real Admin write credentials in Preview testing.

## Historical data and migration notes

- Do not delete old public `schedule.json` or archive JSON files until the KV copy has been independently verified and a backup exists.
- Deleting a file from the latest Git commit does not erase historical copies from Git history, forks, browser caches, or external caches.
- The Durable Object migration is additive; it does not copy, delete, or rewrite existing roster/archive KV values.
- Keep the existing KV namespace ID and all three Worker secrets throughout this rollout.
