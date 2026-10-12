# CCTV · PJL — Duty Roster

> **Security preview only.** This branch is being prepared for a shared-password login with Cloudflare Workers and private KV. The live GitHub Pages site and `main` branch have not been changed. Do not merge or use this branch as Production yet.

Setup and test instructions: [Cloudflare Preview guide](cloudflare/README.md). Security caveats: [SECURITY-PREVIEW.md](SECURITY-PREVIEW.md).

## What this preview is intended to do

- Require a shared site password to view the roster.
- Require a separate Admin password to edit it.
- Keep roster and archive JSON in a private Cloudflare KV namespace, not in the static frontend.
- Use an eight-hour signed session token stored in the current browser tab's session storage.
- Route reads and writes through the Cloudflare Worker API.

## Important limitations

- The Worker has not been deployed and this branch has not passed end-to-end tests.
- The current public GitHub Pages deployment and Git history may still expose roster data.
- The existing `github.io` URL cannot itself be protected by Cloudflare Pages; keeping that exact URL while putting the whole site behind Cloudflare would require a separately controlled custom domain or an alternative approved migration plan.
- Do not put passwords, tokens, or session secrets in this repository or send them in chat.
- Do not merge this branch, change Production hosting, or remove Production files without explicit approval.

## Preview links

- [Cloudflare Worker source](cloudflare/worker.js)
- [Worker configuration](cloudflare/wrangler.toml)
- [Setup and test checklist](cloudflare/README.md)
