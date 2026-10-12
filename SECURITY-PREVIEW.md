# Security Preview — Cloudflare Workers Free

**Preview-only.** The `main` branch and current GitHub Pages site have not been changed.

- Preview branch: `security/cloudflare-preview`
- Worker: `cloudflare/worker.js`
- Configuration: `cloudflare/wrangler.toml`
- Frontend API config: `api-config.js`
- Setup: [cloudflare/README.md](cloudflare/README.md)

## Current state

- No passwords, password hashes, API tokens, or session secrets are committed.
- The Worker is not deployed from this repository.
- Cloudflare KV has not been created or seeded.
- The frontend API URL is intentionally blank until the Worker is deployed.
- The branch has not passed end-to-end browser testing.

## Critical privacy and hosting limitations

Roster files were removed from this branch's latest snapshot, but this does not remove copies from the public `main` branch, public GitHub Pages, Git history, caches, or anyone's downloads. Data already exposed must be treated as potentially copied.

The current `https://toxinhub.github.io/roster/` URL can be preserved: GitHub Pages can continue serving the static frontend while the frontend reads/writes roster data only through the authenticated Cloudflare Worker API. The current and archived JSON files must be removed from the public deployment before cutover. Previously committed copies remain accessible in Git history unless that history is separately cleaned.

Do not merge this branch, change Production hosting, or delete Production files until the preview is deployed, all tests pass, the public-data exposure is addressed, and the owner explicitly approves the migration.
