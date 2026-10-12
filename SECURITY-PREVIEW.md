# Security Preview — Cloudflare Workers Free

This branch replaces the earlier Vercel experiment. **Vercel is not part of this setup.** The current production branch and GitHub Pages URL remain untouched.

See [Cloudflare Preview setup](cloudflare/README.md) for the Worker API, free-tier setup, secrets, KV seeding, and test checklist.

## Current state

- Preview-only branch: `security/cloudflare-preview`
- Backend source: `cloudflare/worker.js`
- Worker configuration: `cloudflare/wrangler.toml`
- Frontend API configuration: `api-config.js`
- Frontend client: `api-client.js`
- No passwords, password hashes, API tokens, or session secrets are committed.
- The Cloudflare Worker has **not** been deployed from this repository; deployment requires the owner to connect their Cloudflare account and set secrets/bindings.
- Do not merge this branch, change GitHub Pages settings, or delete production data until the Preview passes its tests and the owner explicitly approves.

## Critical privacy limitation

The existing public GitHub repository and its commit history may contain current or historical roster data. Moving future reads/writes to private Cloudflare KV does not erase copies already committed or downloaded. The roster must be seeded into KV and the public-data exposure plan reviewed before the setup can be considered secure.
