# Cloudflare Worker — CCTV Roster

The Production and Preview frontend currently use the Worker URL configured in `api-config.js`.

## Required Worker configuration

Secrets (configure in the Cloudflare dashboard; never commit their values):
- `SITE_PASSWORD`
- `ADMIN_PASSWORD` — must differ from the site password
- `SESSION_SECRET` — at least 32 characters

KV binding:
- Variable name: `ROSTER_DATA`
- Current namespace: `roster-data-preview`

Allowed origins must include:
- `https://toxinhub.github.io`
- `https://dc30fdd7.roster-bps.pages.dev`
- `https://roster-bps.pages.dev`

## Authenticated API

- `POST /api/login` — returns a short-lived signed token for the site or Admin role.
- `GET /api/session` — validates a session.
- `POST /api/logout` — revokes the current session token.
- `GET /api/roster` — requires a valid site or Admin session.
- `GET /api/archive?month=YYYY-MM` — requires a valid site or Admin session.
- `POST /api/admin/save` — Admin-only current roster save.
- `POST /api/admin/archive` — Admin-only archive creation; existing archives are not overwritten.
- `GET /api/status` — exposes configuration booleans only.

## Migration checklist

- [ ] Site password is different from Admin password.
- [ ] Wrong passwords are rejected.
- [ ] Site role cannot save roster changes.
- [ ] Admin can save the current roster.
- [ ] September 2026 archive is present in KV and visible after login.
- [ ] Old public `schedule.json` and archive JSON files are removed only after KV verification.
- [ ] Test that unauthenticated API requests cannot read roster or archive data.
- [ ] Review Git history separately: deleting files from the latest commit does not erase historical copies.

## Important limitations

- The login rate limiter uses KV and is best-effort under simultaneous requests.
- Production and Preview currently share the same KV namespace. Consider a separate Production namespace after the migration.
- Existing copies in Git history, browser caches, forks, and external caches are not erased by deleting the current public files.
