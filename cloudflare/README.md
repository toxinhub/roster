# Cloudflare Workers Preview — shared-password roster

This is a **Preview-only** replacement for the Vercel experiment. It does not deploy itself and does not change GitHub Pages.

## Free-tier setup

1. In Cloudflare, create a KV namespace and bind it as `ROSTER_DATA`.
2. Deploy this repository branch as a **separate Cloudflare Pages Preview project** for the frontend (production GitHub Pages settings remain unchanged). Use the repository root as the static output directory and leave the build command empty. Do not point the production project at this branch.
3. Deploy `cloudflare/worker.js` as a separate Worker using `cloudflare/wrangler.toml` (or set up the Worker from the dashboard). Replace the KV namespace placeholder first.
4. Add these **Worker secrets** in Cloudflare (never in GitHub or chat):
   - `SITE_PASSWORD`: shared roster password
   - `ADMIN_PASSWORD`: a different admin password
   - `SESSION_SECRET`: random value with at least 32 characters
5. Add `ALLOWED_ORIGINS` as a normal Worker variable containing exact allowed origins, comma-separated. Include both `https://toxinhub.github.io` and the exact Cloudflare Pages Preview origin. Do not use wildcard origins.
6. Set `window.ROSTER_API_BASE` in the Preview copy of `api-config.js` to the exact HTTPS Worker URL. This URL is public; it must contain no secrets. Commit this change only to the Preview branch.
7. Open `/api/status` on the Worker URL. It reports configuration booleans only.
8. Seed the private KV data keys below, then test login, roster reads, archives, admin save and logout on the Pages Preview URL.

## Seed private data

In the Cloudflare KV dashboard, add a key named `schedule` with the complete JSON value from a **local copy** of the current schedule. For each archive, add a key named `archive:YYYY-MM` with that archive's JSON value. Do not upload passwords or tokens as KV data. The Worker returns roster data only after authentication.

## API behavior

- `POST /api/login`: accepts a password, returns a short-lived signed bearer token.
- `GET /api/session`: validates the bearer token.
- `POST /api/logout`: client removes the token; tokens expire after 8 hours.
- `GET /api/roster` and `GET /api/archive?month=YYYY-MM`: require a site/admin session.
- `POST /api/admin/save` and `POST /api/admin/archive`: require admin role.
- CORS allows only exact origins listed in `ALLOWED_ORIGINS`.

## Security and cost notes

- Workers Free currently includes 100,000 requests per day and a 10 ms CPU limit per request. Limits and terms can change.
- The login throttle in this first Preview is best-effort per Worker isolate, not a global rate limiter.
- KV archive creation checks for an existing key before writing, but KV does not provide a transactional compare-and-set; avoid simultaneous archive writes.
- The public GitHub repository and its old commit history can still expose previously committed roster data. This Preview does not erase that history. Do not call the system secure until the data has been moved to private KV and public data exposure has been addressed.
- Do not merge this branch to `main`, change GitHub Pages settings, or delete production files until the Preview is tested and the owner explicitly approves.
