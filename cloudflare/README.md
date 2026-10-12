# Cloudflare Workers Free — Preview setup

This is a **Preview-only** setup. It does not deploy itself and does not change GitHub Pages or the `main` branch. Do not merge this branch into Production.

## What you need to do in Cloudflare

1. Sign in to your own Cloudflare account. Never share your password, recovery codes, or API tokens in chat.
2. Create a **KV namespace** named `roster-data-preview`.
3. Create a Worker named `cctv-roster-security-preview` and deploy the source from `cloudflare/worker.js`. If using the Wrangler file, replace the placeholder KV namespace ID in `cloudflare/wrangler.toml` with the ID shown in your own Cloudflare dashboard before deploying.
4. In the Worker settings, bind that KV namespace using the exact binding name `ROSTER_DATA`.
5. Add these as **Worker secrets**, not plain variables and never in GitHub:
   - `SITE_PASSWORD`: the shared password for viewing the roster
   - `ADMIN_PASSWORD`: a different password for the Admin panel
   - `SESSION_SECRET`: a cryptographically random secret with at least 32 characters (use 32 random bytes or more)
6. Add a normal Worker variable named `ALLOWED_ORIGINS`. For the initial preview, use the exact Cloudflare Pages preview origin once it exists. Separate multiple origins with commas; do not use a wildcard.
7. Deploy this branch as a **separate Cloudflare Pages preview project** (not the Production project). Use the repository root as the static output directory and leave the build command empty.
8. After the Pages preview URL is created, add that exact origin to `ALLOWED_ORIGINS`. In the Preview branch only, set `window.ROSTER_API_BASE` in `api-config.js` to the exact HTTPS Worker URL. Redeploy the Pages preview after changing it.
9. Open the Worker URL ending in `/api/status`. It should report `configured: true` after all required bindings and secrets are set. This endpoint reports configuration booleans only, not the secret values.
10. Seed the KV namespace with the data keys described below, then run the test checklist.

## Seed private KV data

The roster data files have intentionally been removed from this branch's latest snapshot. Use a local copy from a trusted source; do not paste staff roster data into chat.

In Cloudflare KV, add:
- Key `schedule` — value is the full current roster JSON.
- One key per archived month, e.g. `archive:2026-09` — value is that month's full archived roster JSON.

Keep these values in the private KV namespace. Do not add passwords or session tokens as KV values. This does **not** erase any copies already committed to the public GitHub repository or its history.

## API and permissions

- `POST /api/login` — checks the shared site/Admin password and returns an eight-hour signed bearer token.
- `GET /api/session` — validates the bearer token.
- `POST /api/logout` — requires a valid session and records that session ID as revoked in KV until expiry; copied tokens for that session should then fail validation.
- Login failures are counted in KV for a 15-minute window using a hashed IP-derived key, not the raw IP. KV consistency and simultaneous requests mean this remains best-effort, not a strict global limiter.
- `GET /api/roster` and `GET /api/archive?month=YYYY-MM` — require a valid site or Admin session.
- `POST /api/admin/save` and `POST /api/admin/archive` — require the Admin role.
- CORS allows only exact origins listed in `ALLOWED_ORIGINS`.

## Preview test checklist

- [ ] `/api/status` reports `configured: true` and all checks pass.
- [ ] No password, token, or session secret appears in repository files or browser source.
- [ ] A wrong password is rejected.
- [ ] Site password opens the roster but cannot open Admin editing.
- [ ] Admin password opens both roster and Admin editing.
- [ ] Reload preserves the session in the same browser tab.
- [ ] A fresh tab asks for a password.
- [ ] Current roster and an existing archive load from KV.
- [ ] Admin can save a change; the updated value is in KV.
- [ ] Admin can archive a month; duplicate archive creation is rejected.
- [ ] Requests from an unapproved origin are rejected.
- [ ] After logout, replaying the old Bearer token to `/api/session` and `/api/roster` fails.
- [ ] Repeated bad logins across fresh requests trigger `429 TOO_MANY_ATTEMPTS`.
- [ ] Missing KV data and expired/invalid tokens fail safely.
- [ ] Check the Pages deployment output and confirm no roster/archive JSON is published.

## Limits and caveats

- Cloudflare Workers Free has historically included 100,000 requests per day and a 10 ms CPU limit per request; confirm current plan limits in your Cloudflare dashboard before relying on them.
- The login throttle in this preview is best-effort per Worker isolate, not a global rate limiter.
- KV is not a transactional database; simultaneous archive writes can race.
- The signed bearer token is stored in sessionStorage and is accessible to JavaScript running on the page. This is a deliberate compatibility trade-off for a cross-origin Worker API, not equivalent to an HttpOnly cookie.
- Most importantly, the existing public GitHub repository, raw files, and Git history may expose current or historical roster data. Moving new reads/writes to KV does not erase those copies.
- The exact existing `https://toxinhub.github.io/roster/` URL can be retained by keeping the static frontend on GitHub Pages and configuring the frontend to use the authenticated Worker API. For the final cutover, `ALLOWED_ORIGINS` must include `https://toxinhub.github.io`, and the public deployment must contain no roster/archive JSON. This does not erase older copies from Git history; handle that separately before claiming historical roster data is private.
- Do not merge this branch, change Production hosting, or delete Production data unless the owner explicitly approves after the Preview tests.
