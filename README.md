# CCTV · PJL — Duty Roster

A responsive duty-roster website for the CCTV · PJL team, designed for quick access on mobile and desktop.

**Live site:** https://toxinhub.github.io/roster/

## Features

- View the current roster and navigate between available months.
- See duty status using the Dhaka time zone.
- Use the roster on mobile phones, tablets, and desktop screens.
- Manage roster entries through a separate admin interface.
- Review changes before saving and download a JSON copy when needed.

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

1. Open the [live roster](https://toxinhub.github.io/roster/).
2. Enter the site password when prompted.
3. Navigate to the month you want to view.
4. For roster updates, use the authorized admin interface and save changes after reviewing them.

If you do not have the required access, contact the roster administrator.

## Project structure

| File / directory | Purpose |
| --- | --- |
| `index.html` | Main roster interface |
| `admin.html` | Admin interface |
| `style.css`, `landscape.css` | Responsive presentation and layout |
| `api-client.js`, `api-config.js`, `auth.js` | Frontend API and access-control integration |
| `cloudflare/worker.js` | Server-side API implementation |

## Security

- Do not commit passwords, API tokens, session secrets, or other credentials.
- Keep production secrets in the appropriate hosting-platform secret settings.
- Restrict administrative access to authorized users.
- Review repository files and deployment settings before making the repository public.

## Maintenance

Keep this README aligned with the deployed site. Document user-facing features and setup guidance here; keep private operational notes, environment details, migration status, and secret configuration values out of the public README.
