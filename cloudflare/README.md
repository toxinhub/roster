# Cloudflare Deployment and Security Notes

## Verified live architecture

The connected Cloudflare account currently has:

- Pages project: `roster`
- Production hostname: `https://roster-bps.pages.dev`
- Production branch: `security/cloudflare-preview` (the name is misleading; Cloudflare currently treats it as Production)
- Pages Functions: `functions/api/`
- Upstream Worker: `empty-block-84d1` at `https://empty-block-84d1.toxinmoy.workers.dev`
- KV binding: `ROSTER_DATA`
- Worker secrets: `SITE_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`
- Worker plain-text variable: `ALLOWED_ORIGINS`

The current Worker uses KV for the current schedule, archived months, session revocation, and best-effort login throttling. Do not recreate the Worker or replace its bindings when deploying code.

## Preview isolation

Pages Preview and Production currently share the upstream Worker and KV namespace.

The audit branch changes the frontend API base so each Cloudflare Pages deployment uses its own same-origin Pages Functions proxy. GitHub Pages continues to use the Production Pages API.

- The Pages proxy rejects Admin Save and Archive writes from Preview hostnames and Preview origins.
- The proposed Worker source adds a second production-origin check for Admin writes. That Worker change is **not active** until the deployed Worker script is updated.
- Preview can read authenticated roster data through the shared Worker. Do not use Preview for Admin changes.
- The current deployed Worker allowlist still includes an older Preview origin. Avoid Admin operations from that legacy Preview URL until the Worker update and origin cleanup are complete.

## Worker configuration

Keep these values in Cloudflare settings, never in GitHub:

- `SITE_PASSWORD`: shared viewer password.
- `ADMIN_PASSWORD`: a different password for Admin access.
- `SESSION_SECRET`: cryptographically random secret with at least 32 characters.
- `ROSTER_DATA`: existing KV namespace binding.
- `ALLOWED_ORIGINS`: exact allowed frontend origins, comma-separated; no wildcard.

The proposed Worker code defaults Admin write origins to:

- `https://toxinhub.github.io`
- `https://roster-bps.pages.dev`

If a legitimate Production domain changes, set `ADMIN_WRITE_ORIGINS` explicitly. Do not include Preview origins.

## Private KV data

The existing KV namespace contains:

- `schedule` — current roster JSON.
- `archive:YYYY-MM` — archived roster JSON for each month.
- Session revocation and login-throttle records.

Do not commit roster JSON, passwords, session tokens, or other secrets to the repository.

## API and permissions

- `POST /api/login` — validates the shared viewer or Admin password and issues an eight-hour signed bearer token.
- `GET /api/session` — validates the bearer token.
- `POST /api/logout` — revokes the current session token in KV.
- `GET /api/roster` and `GET /api/archive?month=YYYY-MM` — require a valid viewer or Admin session.
- `POST /api/admin/save` and `POST /api/admin/archive` — require the Admin role and a Production write origin.
- `GET /api/status` — exposes configuration booleans only, not secret values.

CORS origin checks are not a substitute for bearer-token authentication.

## Verification completed on the audit branch

- GitHub Actions Worker regression suite: **11 tests passed, 0 failed**.
- Current KV `schedule`, `archive:2026-09`, and `archive:2026-10` values pass the proposed schema validation, including displayed-date and weekday consistency.
- The September archive includes an October 1 boundary date; archive validation permits adjacent-month boundary dates when the first date matches the archive key.
- Latest Cloudflare Pages audit Preview deployment completed with Pages Functions enabled.
- Preview `/api/status` returns HTTP 200; unauthenticated `/api/roster` returns HTTP 401.
- Preview Admin Save returns HTTP 403 `PREVIEW_READ_ONLY` from the Pages proxy.
- Production Admin Save without a token returns HTTP 401 `ADMIN_AUTH_REQUIRED`.

## Remaining risks

- The deployed Worker has not yet been updated with the reviewed source changes.
- KV does not provide atomic compare-and-swap. The `updatedAt` check detects sequential stale edits but cannot fully serialize truly simultaneous writes. A Durable Object or transactional database is required for that.
- KV-backed login throttling remains best-effort under concurrent requests.
- A public backup branch still exposes old roster snapshot files through raw GitHub URLs. Git history and other backup branches may contain further copies. Removing the current `main/schedule.js` file does not erase those historical copies.
- Do not claim historical roster data is private until backup branches and Git history have been reviewed and, if approved, cleaned.

## Release sequence

1. Review the open draft PR and its green CI/Preview checks.
2. Update the existing Worker script content only, preserving its secret bindings and KV binding.
3. Verify Production viewer login, Admin login, save, archive creation, and Preview write rejection.
4. Merge to `security/cloudflare-preview` only after explicit Production approval.
5. Review public backup branches and Git history separately; history rewriting or backup deletion requires explicit approval.
6. Consider Durable Object coordination as a separate reliability upgrade.
