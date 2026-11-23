# Roster Security Audit — Deployment State

## Deployment warning

The connected Cloudflare Pages project currently sets `security/cloudflare-preview` as its `production_branch`. Despite the branch name, that branch is serving as the Pages Production source. The audit changes are in a separate draft PR and have not been merged into Production.

## Current architecture

- Cloudflare Pages serves the frontend and the `functions/api/` proxy.
- The Pages proxy forwards API requests to the deployed Worker `empty-block-84d1`.
- The Worker uses a Cloudflare KV namespace for the current roster, archives, sessions, and best-effort login throttling.
- The Pages Preview and Production deployments currently share the same upstream Worker and KV namespace.
- The audit branch routes Pages deployments through their own same-origin API proxy. Preview Admin Save and Archive writes are blocked in the Pages proxy and in the proposed Worker source.
- The reviewed Worker source was deployed to the existing `empty-block-84d1` script on 23 November 2026 using the content-only endpoint. Existing secret bindings and the KV binding were preserved.

## Verification completed

- Current KV `schedule`, `archive:2026-09`, and `archive:2026-10` records pass the proposed schema validation.
- The September archive legitimately includes an October 1 boundary date; validation checks the first date against the archive key rather than rejecting adjacent-month boundary dates.
- The audit branch's GitHub Actions suite passed all 10 Worker regression tests.
- The latest Cloudflare Pages audit Preview deployment completed successfully with Pages Functions enabled.
- Preview `/api/status` returns HTTP 200; unauthenticated `/api/roster` returns HTTP 401.
- Preview `/api/admin/save` returns HTTP 403 `PREVIEW_READ_ONLY`; Production Admin Save without a token returns HTTP 401.
- The obsolete public `schedule.js` snapshot was removed from `main`, and its GitHub Pages URL now returns HTTP 404.

## Residual privacy and reliability risks

- Public backup branches and Git history still contain historical roster snapshots. A representative public backup branch serves old `schedule.js`, `schedule.json`, and `archive/2026-09.json` files through raw GitHub URLs. This audit has not deleted backup branches or rewritten Git history.
- KV stale-edit checks detect sequential stale saves, but KV does not provide atomic compare-and-swap. Truly simultaneous Admin writes still require a Durable Object or transactional storage.
- KV-backed login throttling is also best-effort under concurrent requests.
- The deployed Worker still needs the reviewed source update before the new schema validation and Worker-level Preview write restriction become active.

## Release sequence

1. Review the open draft PR and its successful CI/Preview checks.
2. Deploy the reviewed Worker source to the existing Worker script without replacing its secret or KV bindings.
3. Verify Production login, roster read, Admin save, archive creation, and Preview read-only behavior.
4. Merge to `security/cloudflare-preview` only after explicit Production approval.
5. Handle backup-branch/history cleanup and Durable Object concurrency coordination as separate, explicitly approved changes.
