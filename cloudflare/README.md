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

Allowed origins (`ALLOWED_ORIGINS`) control which frontend origins may authenticate and read roster data:
- `https://toxinhub.github.io`
- `https://roster-bps.pages.dev`
- Add a branch preview origin only when read-only preview testing is needed; preview origins are not automatically trusted.

Write origins (`ADMIN_WRITE_ORIGINS`) are checked separately for Admin save/archive requests. The Worker defaults this list to the two production origins above. **Do not add Pages preview domains to `ADMIN_WRITE_ORIGINS`**, because previews share the production KV namespace and must remain read-only.

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

## Durable Object coordination

The single roster is one coordination unit, so all authenticated API writes are routed through one named `RosterCoordinator` Durable Object. It serializes:
- Login attempt check-and-increment operations.
- Current-roster revision checks and saves.
- Archive existence checks and creation.
- Session revocation writes.

Workers KV remains the existing persistent data store; this change does not migrate or rewrite roster/archive data. The Durable Object serializes compound operations before they reach KV. All API reads are routed through the same object location to reduce cross-location KV staleness.

Deploy the Worker from this directory with Wrangler after reviewing the PR:

```sh
npx wrangler deploy --config wrangler.toml
```

The first SQLite-backed class migration is additive (`v1`) and does not delete the existing KV namespace. Keep the KV binding: it remains the durable source of roster and archive values. Do not remove the Durable Object binding or set `REQUIRE_COORDINATOR=false` in production; doing so falls back to best-effort KV-only writes.

`ALLOWED_ORIGINS` may include the stable read-only Pages preview origin. `ADMIN_WRITE_ORIGINS` must remain limited to production frontends. Preview deployments must never be granted Admin write access to the shared KV namespace.

Wrangler configuration contains no password or session-secret values. Existing Worker secrets must remain configured in Cloudflare.
