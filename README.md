# CCTV · PJL — Duty Roster

Mobile-first duty roster for the CCTV · PJL team.

**Live site:** https://toxinhub.github.io/roster/

## Security architecture

- `index.html` requires the shared site password.
- `admin.html` requires a separate Admin password.
- `api-client.js` sends the short-lived session token to the Cloudflare Worker.
- `cloudflare/worker.js` validates roles, rate-limits failed login attempts on a best-effort basis, and revokes logged-out sessions.
- Current roster and archived months are served from Cloudflare KV through authenticated API routes.
- Passwords and session secrets must be configured as Worker secrets; never commit them to this repository.

## Current migration note

The Production frontend has been connected to the Cloudflare Worker. The old public files `schedule.json` and `archive/2026-09.json` are intentionally still present temporarily so the September archive can be imported into KV and verified first. **They remain publicly readable until they are removed in a later cleanup step. Do not treat the migration as fully complete until that step is done.**

The Worker is currently using the existing `roster-data-preview` KV binding. Preview and Production therefore share this data store for the migration; a separate Production namespace can be introduced later if environment isolation is needed.

## Roster features

- Current month and archived month navigation.
- Dhaka timezone-based live duty status.
- Shift codes: A (06:00–14:00), B (14:00–22:00), C (22:00–06:00), OFF, L.
- Responsive desktop and mobile roster table.
- Admin editing with a change summary, save, and JSON download.

## Files

- `index.html` — password-protected roster view
- `admin.html` — Admin-only editor
- `api-config.js`, `api-client.js`, `auth.js` — frontend API and authentication
- `cloudflare/worker.js` — authenticated API implementation
- `schedule.json`, `archive/` — legacy public files pending removal after KV verification
- `style.css`, `landscape.css` — responsive styles
