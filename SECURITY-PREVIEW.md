# Secure Preview setup checklist

This branch is for a **Preview-only test**. Do not merge it to `main`, promote it, or change the production branch/domain until the owner explicitly approves after testing.

## Required Vercel Preview environment variables

Create these in **Vercel → roster → Settings → Environment Variables**. Select **Preview only** and, where Vercel offers branch-specific Preview variables, scope them to `security/preview-shared-password`.

| Name | Value |
| --- | --- |
| `SITE_PASSWORD_HASH` | scrypt hash for the shared site password |
| `ADMIN_PASSWORD_HASH` | scrypt hash for a different Admin password |
| `SESSION_SECRET` | random secret of at least 32 characters |
| `GITHUB_TOKEN` | fine-grained token limited to `toxinhub/roster`, Contents read/write only |
| `GITHUB_OWNER` | `toxinhub` |
| `GITHUB_REPO` | `roster` |
| `GITHUB_BRANCH` | `security/preview-shared-password` |

**Never** paste passwords, password hashes, session secrets, or GitHub tokens into a chat, issue, commit, or client-side file. Generate each password hash locally with `node scripts/hash-password.js` in a trusted terminal; enter the resulting hash directly into Vercel. Use distinct site and admin passwords. Set the Preview variables only—do not add these values to Production.

After adding/changing variables, redeploy the security branch Preview so the functions receive them. Keep Vercel Deployment Protection enabled while configuring; for functional browser testing, use the authenticated Vercel preview access flow. Do not disable protection globally merely to make a test convenient.

## Preview acceptance tests

Run these against the exact Preview deployment URL after the environment variables are configured:

1. Logged out, `GET /api/session` returns 401; the app shows the password form.
2. Wrong password returns 401; repeated attempts are throttled. The current in-memory throttle is best-effort per serverless instance, not a distributed rate limiter.
3. Site password opens the roster but does not grant Admin writes.
4. Admin password opens both roster and Admin.
5. Logged out, `GET /api/roster` and `GET /api/archive?month=YYYY-MM` return 401.
6. Direct requests for `/schedule.json`, `/schedule.js`, and `/archive/YYYY-MM.json` return 404; no roster data is present in static deployment files.
7. A site-only session calling `POST /api/admin/save` or `POST /api/admin/archive` returns 401.
8. Admin can make a harmless test edit and save to the **security branch only**; verify the commit branch and inspect the data. Confirm an existing archive is never overwritten.
9. Logout clears the session; the cookie is HttpOnly, Secure, SameSite=Strict, and expires after eight hours.
10. Verify current schedule and every historical archive still parse and match the expected roster structure. Do not test by editing real staff shifts unless you first use a disposable test copy.

## Important limitations before production approval

- The Preview URL is currently protected by Vercel Deployment Protection. That is separate from the shared-password login in this app.
- The source files are read/written via the GitHub Contents API on the configured branch. A misconfigured `GITHUB_BRANCH` could target the wrong branch; confirm it is the security branch before every test.
- Login throttling uses per-instance memory and is not a global/distributed rate limiter.
- This is not production-approved until the Preview acceptance tests pass, environment variable scopes are verified, and archive integrity is checked.
- The old GitHub Pages URL is not protected by this branch. Leave it alone until a separate migration/cutover plan is approved.
