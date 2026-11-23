# CCTV · PJL — Duty Roster

A responsive monthly duty-roster application for the CCTV · PJL team.

## Live sites

- **Cloudflare Pages Production:** https://roster-bps.pages.dev/
- **GitHub Pages site:** https://toxinhub.github.io/roster/

Both frontends use the same authenticated Cloudflare Worker API and private KV roster data.

## Access

- Viewers need the shared site password.
- Administrators use a separate Admin password.
- Sessions expire after eight hours.
- The roster and monthly archives are stored in Cloudflare KV, not in public static JSON files.

## Shift reference

| Code | Time / meaning |
| --- | --- |
| **A** | 06:00–14:00 |
| **B** | 14:00–22:00 |
| **C** | 22:00–06:00 |
| **OFF** | Scheduled day off |
| **L** | Leave |

Times use the Dhaka time zone.

## Project structure

| File / directory | Purpose |
| --- | --- |
| `index.html` | Public roster interface |
| `admin.html` | Admin editor |
| `style.css`, `landscape.css` | Responsive styling |
| `api-config.js`, `api-client.js`, `auth.js` | API and authentication |
| `cloudflare/worker.js` | Deployed Worker source |
| `cloudflare/worker.test.mjs` | Worker regression tests |
| `functions/api/` | Cloudflare Pages API proxy (Production branch) |

## Branch and deployment notes

- GitHub Pages uses `main`.
- Cloudflare Pages currently uses `security/cloudflare-preview` as its Production branch, despite the branch name.
- The Worker is deployed separately from the static frontend. Do not overwrite its secret bindings or KV binding when updating its code.
- Pages Preview and Production share the upstream Worker/KV. Preview Admin writes are blocked; use Production for authorized changes.
- The Worker regression suite runs with `node --test cloudflare/worker.test.mjs`.

## Security note

The obsolete public `schedule.js` snapshot was removed from the current `main` branch. Historical roster snapshots still exist in public backup branches and Git history. Do not assume those older copies are private.
