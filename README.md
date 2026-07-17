# SD Market — community systems registry

Catalog of user-created systems for **System Director** (FoundryVTT). It opens right inside Foundry: System settings → Community Market.

## How to publish your system

1. In Foundry: **Market → "Export my system"** — a `*.sd-system.json` package is downloaded (you can choose whether to include NPCs, journals and compendiums).
2. Click **"Publish"** in the Market (or open the [publication form](../../issues/new?template=submit-system.yml)).
3. Fill in the form and drag the package file into the last field (zip it first if GitHub rejects `.json`).
4. The bot validates the package, adds the system to the catalog and closes the issue. Done — your system is live for everyone.

To update a system, submit the form again with the same **ID**.

## Likes

A like = a ⭐ star on the system's repository. Star and download counters are refreshed automatically every hour.

## Structure

- `index.json` — the catalog (read by Foundry)
- `packages/` — system packages
- `.github/workflows/publish.yml` — auto-publishing from issues
- `.github/workflows/refresh-stats.yml` — hourly stars/downloads refresh
