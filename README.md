# CCTV · PJL — Duty Roster

A responsive duty-roster website for the CCTV · PJL team, designed for mobile and desktop.

**Live site:** https://roster-bps.pages.dev/

> **Deployment warning:** The connected Cloudflare Pages project currently uses `security/cloudflare-preview` as its Production branch, despite the branch name. Treat merges to that branch as Production deployments.

## Features

- Shared site-password access for roster viewers.
- Separate Admin password and eight-hour signed sessions.
- Private Cloudflare KV storage for the current roster and archives.
- Dhaka-time duty status and monthly navigation.
- Admin editing, change review, archive creation, and JSON export.
- Preview deployments use their own Pages API proxy and are read-only for Admin writes.

## Shift reference

| Code | Time / meaning |
| --- | --- |
| **A** | 06:00–14:00 |
| **B** | 14:00–22:00 |
| **C** | 22:00–06:00 |
| **OFF** | Scheduled day off |
| **L** | Leave |

Times use the Dhaka time zone.

## Using the site

1. Open the [live roster](https://roster-bps.pages.dev/).
2. Enter the shared site password.
3. Navigate to the month you want to view.
4. Authorized administrators can use the separate Admin interface to update the roster.

If you do not have the required access, contact the roster administrator.

## Project structure

| File / directory | Purpose |
| --- | --- |
| `index.html` | Public roster interface |
| `admin.html` | Admin interface |
| `style.css`, `landscape.css` | Responsive presentation |
| `api-client.js`, `api-config.js`, `auth.js` | Frontend API and authentication |
| `functions/api/` | Cloudflare Pages API proxy |
| `cloudflare/worker.js` | Worker API source |
| `cloudflare/worker.test.mjs` | Worker regression tests |

## Security and deployment notes

- Production secrets remain in Cloudflare Worker secret bindings; never commit them.
- The Pages Preview and Production environments currently share the upstream Worker/KV. Preview Admin Save and Archive writes are blocked in the Pages proxy and by the deployed Worker-level production-origin guard. The audit Pages source is still in a draft PR.
- Changes to `cloudflare/worker.js` are source changes only; the deployed Worker script must be updated separately after review.
- The obsolete public `schedule.js` snapshot was removed from `main`. Older backup branches and Git history may still contain historical roster copies; those require a separate, explicitly approved cleanup.
- KV stale-edit checks reduce accidental overwrites, but truly simultaneous writes still require an atomic coordinator such as a Durable Object.

## Verification

The Worker regression suite runs with `node --test cloudflare/worker.test.mjs`. The current audit branch's CI run passed all 10 tests.
